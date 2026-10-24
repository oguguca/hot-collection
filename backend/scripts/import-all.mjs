// Importador geral do catálogo (Hot Wheels Wiki, Fandom, CC BY-SA).
//   node scripts/import-all.mjs            -> MODO TESTE: não grava nada, escreve import-report.txt
//   node scripts/import-all.mjs --save     -> grava no banco
//   node scripts/import-all.mjs --refresh  -> ignora o cache local e busca tudo de novo na Wiki
//   node scripts/import-all.mjs --verbose  -> relatório com a lista completa de páginas
//   node scripts/import-all.mjs --offline  -> usa só as páginas do cache local, sem acessar a Wiki
import fs from 'fs';
import crypto from 'crypto';
import { PrismaClient } from '@prisma/client';
import {
  sleep,
  fetchWikitext,
  listCategoryPages,
  listPagesByPrefix,
  extractTables,
  parseTable,
  splitVariation,
  deriveLine,
  deriveYear,
  deriveSection,
  resolveCollectionNumber,
  sameCar,
  treasureHuntKind,
} from './lib/wiki-parser.mjs';

const prisma = new PrismaClient();
const SAVE = process.argv.includes('--save');
const REFRESH = process.argv.includes('--refresh');
const VERBOSE = process.argv.includes('--verbose');
const OFFLINE = process.argv.includes('--offline');
const SOURCE = 'Hot Wheels Wiki (Fandom)';
const STH = 'Super Treasure Hunt';

if (OFFLINE && REFRESH) {
  console.log('--offline e --refresh não podem ser usados juntos.');
  process.exit(1);
}

// Anos futuros são anúncios que ainda podem mudar: ficam de fora até o lançamento
const MAX_YEAR = 2026;
// Linhas que não são carrinhos (skates e fingerboards)
const EXCLUDED_LINES = [/^Hot Wheels Skate$/i];

const CACHE_DIR = '.wiki-cache';
fs.mkdirSync(CACHE_DIR, { recursive: true });

const CATEGORIES = [
  'Lists of Hot Wheels by year',
  'Car Culture by Year',
  'Hot Wheels Premium Series/ Sets',
  'Premium Collector Sets',
];

const EXTRA_PAGES = ['Premium Collector Set', 'Car Culture 2-Packs'];
for (let year = 2013; year <= MAX_YEAR; year++) EXTRA_PAGES.push(`${year} Pop Culture`);

const EXCLUDE = /\(by Series\)|new castings/i;
const KEYWORDS =
  /(Culture|Skate|Pack|Collection|Series|Set\b|Boulevard|Exclusive|Premium|Mix|Treasure|Mystery|Elite|Entertainment|Collector|Convention|Replica|Retro|Neon|Anniversary|Edition|Release|Models|Lineup|Assortment)/i;

const normalizeName = (text) =>
  text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '');

const sameName = (a, b) =>
  a === b || (a.length >= 4 && b.length >= 4 && (a.includes(b) || b.includes(a)));

// Unifica grafias diferentes da mesma linha
function normalizeLine(raw) {
  const line = raw.replace(/^[^A-Za-z0-9]+/, '').replace(/\s+/g, ' ').trim();
  if (/^HotWheelsCollectors\.com( Special Editions)?$/i.test(line)) {
    return 'HotWheelsCollectors.com Special Editions';
  }
  if (/^(Retro|Replica|Hot Wheels) Entertainment$/i.test(line)) return 'Entertainment';
  if (/^treasure hunts?( series)?$/i.test(line)) return 'Treasure Hunts';
  if (/^mystery (models|cars)$/i.test(line)) return 'Mystery Models';
  return line;
}

// Páginas que listam subconjuntos de carrinhos que também aparecem nas listas principais.
// Quando o carrinho já existe numa linha principal, ele só ganha a etiqueta (tag).
const SUBSET_RULES = [
  { re: /^super treasure hunts?$/i, tag: 'Super Treasure Hunt' },
  { re: /^treasure hunts$/i, tag: 'Treasure Hunt' },
  { re: /^new models/i, tag: 'New Model' },
  { re: /first editions$/i, tag: 'First Edition' },
  { re: /^mystery models$/i, tag: 'Mystery Model' },
  { re: /^race world world earth series$/i, tag: null },
  { re: /^red line series$/i, tag: null },
];
const subsetOf = (line) => SUBSET_RULES.find((rule) => rule.re.test(line)) ?? null;

// Offline: as páginas do cache, pelo título real (depois dos redirecionamentos)
const cachedByTitle = new Map();
if (OFFLINE) {
  for (const file of fs.readdirSync(CACHE_DIR)) {
    const page = JSON.parse(fs.readFileSync(`${CACHE_DIR}/${file}`, 'utf8'));
    if (page.ok) cachedByTitle.set(page.title, page);
  }
}

async function fetchPage(title) {
  if (OFFLINE) return cachedByTitle.get(title) ?? { ok: false, error: 'fora do cache' };
  const hash = crypto.createHash('sha1').update(title).digest('hex');
  const file = `${CACHE_DIR}/${hash}.json`;
  if (!REFRESH && fs.existsSync(file)) return JSON.parse(fs.readFileSync(file, 'utf8'));

  const page = await fetchWikitext(title);
  if (page.ok) fs.writeFileSync(file, JSON.stringify(page));
  await sleep(400);
  return page;
}

console.log(SAVE ? 'MODO GRAVAÇÃO' : 'MODO TESTE (nada será gravado)');
if (OFFLINE) console.log(`OFFLINE: ${cachedByTitle.size} páginas do cache, sem acessar a Wiki`);

// 1. Quais páginas examinar
const titles = new Set(OFFLINE ? [...cachedByTitle.keys()].filter((t) => !EXCLUDE.test(t)) : EXTRA_PAGES);
const discoveredTitles = new Set();

for (const category of OFFLINE ? [] : CATEGORIES) {
  try {
    const members = await listCategoryPages(category);
    console.log(`Categoria "${category}": ${members.length} páginas`);
    members.filter((t) => !EXCLUDE.test(t)).forEach((t) => titles.add(t));
  } catch (error) {
    console.log(`Falha ao ler a categoria "${category}": ${error.message}`);
  }
}

for (let year = 1968; year <= (OFFLINE ? 0 : MAX_YEAR); year++) {
  try {
    for (const title of await listPagesByPrefix(String(year))) {
      if (titles.has(title) || EXCLUDE.test(title) || !KEYWORDS.test(title)) continue;
      titles.add(title);
      discoveredTitles.add(title);
    }
  } catch (error) {
    console.log(`Falha ao procurar páginas de ${year}: ${error.message}`);
  }
}
console.log(`Páginas descobertas por nome: ${discoveredTitles.size}`);
console.log(`Total de páginas a examinar: ${titles.size}`);

// 2. Ler as páginas (usa o cache local quando existe)
const candidates = [];
const pageRows = [];
const unrecognized = new Map();
const seenPages = new Set();
let index = 0;

for (const title of [...titles].sort()) {
  index++;
  if (index % 25 === 0) console.log(`  ...${index}/${titles.size}`);

  try {
    const page = await fetchPage(title);
    if (!page.ok) {
      pageRows.push({ title, error: page.error });
      continue;
    }

    // Vários títulos redirecionam para a mesma página ("2007 Super Treasure Hunts" ->
    // "2007 Treasure Hunts Series"): vale o título real, e cada página é lida uma vez só
    const pageTitle = page.title ?? title;
    if (seenPages.has(pageTitle)) continue;
    seenPages.add(pageTitle);

    const line = normalizeLine(deriveLine(pageTitle));
    const url = `https://hotwheels.fandom.com/wiki/${encodeURIComponent(pageTitle.replace(/ /g, '_'))}`;
    const tables = extractTables(page.wikitext).map(parseTable);
    let rowsRead = 0;
    let skipped = 0;
    let recognized = 0;

    for (const table of tables) {
      if (!table.recognized) {
        const key = table.headers.join(' | ') || '(sem cabeçalho)';
        unrecognized.set(key, (unrecognized.get(key) ?? 0) + 1);
        continue;
      }
      recognized++;
      skipped += table.skipped;

      const year = deriveYear(pageTitle, table.headings);
      const section = deriveSection(pageTitle, table.headings);
      // Página de Treasure Hunts: a etiqueta (TH ou STH) depende da tabela, não da página
      const thKind = line === 'Treasure Hunts' ? treasureHuntKind(table.headings) : null;

      for (const item of table.items) {
        rowsRead++;
        const { name, variation } = splitVariation(item.name);
        // Número e total separados; o total só entra quando a Wiki o informa
        const { collectionNumber, collectionTotal } = resolveCollectionNumber(
          item.colNumber,
          table.headings,
        );
        candidates.push({
          code: item.toyNumber,
          toyNumber: item.toyNumber,
          name,
          line,
          year,
          series: item.series ?? section,
          seriesNumber: item.seriesNumber,
          collectionNumber,
          collectionTotal,
          theme: item.theme,
          bodyColor: item.bodyColor,
          description: item.notes,
          variation,
          collection: [year, line].filter(Boolean).join(' '),
          source: SOURCE,
          sourceUrl: url,
          _page: pageTitle,
          _thKind: thKind,
        });
      }
    }

    pageRows.push({ title: pageTitle, line, tablesTotal: tables.length, recognized, rowsRead, skipped });
  } catch (error) {
    pageRows.push({ title, error: error.message });
  }
}

// 3. Excluir o que não entra e separar subconjuntos
const usable = [];
const excludedLines = new Map();
let futureCount = 0;

for (const c of candidates) {
  if (EXCLUDED_LINES.some((re) => re.test(c.line))) {
    excludedLines.set(c.line, (excludedLines.get(c.line) ?? 0) + 1);
    continue;
  }
  if (c.year && c.year > MAX_YEAR) {
    futureCount++;
    continue;
  }
  c._subset = c._thKind ? { tag: c._thKind } : subsetOf(c.line);
  usable.push(c);
}

// Linhas principais primeiro; entre elas, o primeiro ano em que o carrinho aparece vence
usable.sort(
  (a, b) => (a._subset ? 1 : 0) - (b._subset ? 1 : 0) || (a.year ?? 9999) - (b.year ?? 9999),
);

// 4. Fundir repetidos (mesmo código + mesmo nome), guardando as etiquetas
const byKey = new Map();
const mainByCode = new Map(); // código -> carrinhos das linhas principais (nomes escritos de outro jeito)
// O próprio TH/STH: linha "Treasure Hunts" ou série "Treasure Hunts"/"Super Treasure Hunts" na lista principal
const isOwnThRecord = (r) =>
  r.line === 'Treasure Hunts' || /^(super\s+)?treasure\s+hunts?$/i.test((r.series ?? '').trim());

// Página de TH que usa o mesmo código para carrinhos diferentes no mesmo ano: sem etiqueta (decisão manual)
const thNames = new Map();
for (const c of usable.filter((u) => u._thKind)) {
  const k = `${c.year}|${c.code}`;
  if (!thNames.has(k)) thNames.set(k, []);
  thNames.get(k).push(c.name);
}
const ambiguousTh = [];
for (const c of usable.filter((u) => u._thKind)) {
  const names = thNames.get(`${c.year}|${c.code}`);
  if (names.some((n) => !sameCar(n, names[0]))) {
    c._subset = { tag: null };
    ambiguousTh.push(`${c.year} ${c.code} ${c._thKind} "${c.name}"`);
  }
}
for (const c of usable) {
  const key = `${c.code}|${normalizeName(c.name)}`;
  const tag = c._subset?.tag ?? null;
  let found = byKey.get(key);
  if (!found && c._subset) {
    found = (mainByCode.get(c.code) ?? []).find((m) => m.year === c.year && sameCar(m.name, c.name));
  }

  // STH que divide o código com o carrinho comum: vira variante própria, e o comum não leva a etiqueta.
  // (STH com código próprio, como "M6967S" em 2007-2008, ou já listado como Treasure Hunt: só a etiqueta.)
  // Se o registro também é o TH comum (listado nas duas tabelas), o STH é outra versão: variante também
  const alsoTh = found?.tags.includes('Treasure Hunt');
  if (found && tag === STH && (alsoTh || (!/S$/.test(c.code) && !isOwnThRecord(found)))) {
    const variantKey = `${key}|sth`;
    if (!byKey.has(variantKey)) {
      byKey.set(variantKey, {
        ...found,
        bodyColor: c.bodyColor ?? null,
        description: null,
        variation: STH,
        tags: [STH],
        sourceUrl: c.sourceUrl,
        _page: c._page,
      });
    }
    continue;
  }
  if (found) {
    if (tag && !found.tags.includes(tag)) found.tags.push(tag);
    continue;
  }
  const record = { ...c, tags: tag ? [tag] : [] };
  byKey.set(key, record);
  if (!c._subset) {
    if (!mainByCode.has(c.code)) mainByCode.set(c.code, []);
    mainByCode.get(c.code).push(record);
  }
}
const distinct = [...byKey.values()];

// 5. Comparar com o banco
const existingRows = await prisma.hotWheel.findMany({
  select: { id: true, code: true, name: true, line: true, year: true, tags: true, variation: true },
});
const existingByCode = new Map();
for (const row of existingRows) {
  if (!existingByCode.has(row.code)) existingByCode.set(row.code, []);
  existingByCode.get(row.code).push({
    id: row.id,
    name: normalizeName(row.name),
    rawName: row.name,
    isSthVariant: row.variation === STH,
    tags: row.tags ?? [],
    year: row.year,
    line: row.line,
  });
}
const yearMismatch = []; // já existe, mas a Wiki diz outro ano

const newRecords = [];
const alreadyThere = [];
const tagUpdates = new Map(); // etiqueta -> ids de carrinhos que já existem

for (const c of distinct) {
  const normalized = normalizeName(c.name);
  // A variante STH só corresponde a outra variante STH; o carrinho comum, só a carrinhos comuns
  const isSthVariant = c.variation === STH;
  const match = (existingByCode.get(c.code) ?? []).find(
    (e) => e.isSthVariant === isSthVariant && (sameName(e.name, normalized) || sameCar(e.rawName, c.name)),
  );

  if (!match) {
    newRecords.push(c);
    continue;
  }
  alreadyThere.push(c);
  if (c.year && match.year !== c.year) {
    yearMismatch.push(`${match.line ?? '-'} | ${c.code} | ${c.name} | banco ${match.year ?? '-'} | Wiki ${c.year} | ${c._page}`);
  }
  for (const tag of c.tags) {
    if (match.tags.includes(tag)) continue;
    if (!tagUpdates.has(tag)) tagUpdates.set(tag, []);
    tagUpdates.get(tag).push(match.id);
  }
}

// Carrinhos do banco que nenhuma página da Wiki confirma
const wikiNamesByCode = new Map();
for (const c of usable) {
  if (!wikiNamesByCode.has(c.code)) wikiNamesByCode.set(c.code, []);
  wikiNamesByCode.get(c.code).push(normalizeName(c.name));
}
const orphans = existingRows.filter(
  (row) =>
    !(wikiNamesByCode.get(row.code) ?? []).some((n) => sameName(n, normalizeName(row.name))),
);

// 6. Relatório
const okPages = pageRows.filter((r) => !r.error);
const withRows = okPages.filter((r) => r.rowsRead > 0);
const withoutRows = okPages.filter((r) => r.rowsRead === 0);
const failed = pageRows.filter((r) => r.error);
const skippedTotal = withRows.reduce((sum, r) => sum + r.skipped, 0);

const lineStats = new Map();
const stat = (line) => {
  if (!lineStats.has(line)) lineStats.set(line, { distinct: 0, existing: 0, created: 0 });
  return lineStats.get(line);
};
distinct.forEach((c) => stat(c.line).distinct++);
alreadyThere.forEach((c) => stat(c.line).existing++);
newRecords.forEach((c) => stat(c.line).created++);

const tagCounts = new Map();
distinct.forEach((c) =>
  c.tags.forEach((t) => tagCounts.set(t, (tagCounts.get(t) ?? 0) + 1)),
);

const summary = [];
summary.push(`=== RESUMO (${SAVE ? 'GRAVAÇÃO' : 'TESTE, nada foi gravado'}) ===`);
summary.push(`Páginas examinadas: ${pageRows.length} (${discoveredTitles.size} descobertas por nome)`);
summary.push(`Com carrinhos: ${withRows.length} | Sem carrinhos: ${withoutRows.length} | Erro: ${failed.length}`);
summary.push(`Linhas lidas: ${candidates.length} | Ignoradas (sem código ou nome): ${skippedTotal}`);
summary.push(`Excluídos de propósito: ${[...excludedLines.values()].reduce((a, b) => a + b, 0)} (linhas que não são carrinhos) + ${futureCount} (anos futuros)`);
summary.push(`Repetidos fundidos: ${usable.length - distinct.length}`);
summary.push(`Carrinhos distintos: ${distinct.length}`);
summary.push(`Já existem no banco: ${alreadyThere.length}`);
summary.push(`NOVOS a gravar: ${newRecords.length}`);
summary.push(`Etiquetas a acrescentar em carrinhos existentes: ${[...tagUpdates.values()].reduce((a, ids) => a + ids.length, 0)}`);
summary.push(`Carrinhos no banco: ${existingRows.length} | sem confirmação na Wiki: ${orphans.length}`);
summary.push(`Já existem, mas a Wiki diz outro ano: ${yearMismatch.length}`);
summary.push(`Treasure Hunts ambíguos (sem etiqueta, decisão manual): ${ambiguousTh.length}`);

const report = [...summary];

report.push('\n=== EXCLUÍDOS DE PROPÓSITO ===');
for (const [line, count] of excludedLines) report.push(`${line}: ${count} linhas (não são carrinhos)`);
report.push(`Anos acima de ${MAX_YEAR}: ${futureCount} linhas (anúncios)`);

report.push('\n=== POR LINHA ===');
report.push('linha | distintos | já existem | novos');
for (const [line, s] of [...lineStats.entries()].sort((a, b) => b[1].created - a[1].created)) {
  report.push(`${line} | ${s.distinct} | ${s.existing} | ${s.created}`);
}

report.push('\n=== ETIQUETAS (carrinhos distintos) ===');
for (const [tag, count] of tagCounts) report.push(`${tag}: ${count}`);

report.push('\n=== ETIQUETAS A ACRESCENTAR EM CARRINHOS EXISTENTES (até 20) ===');
const existingById = new Map(existingRows.map((r) => [r.id, r]));
for (const [tag, ids] of tagUpdates) {
  for (const id of ids.slice(0, 20)) {
    const r = existingById.get(id);
    report.push(`${tag} | ${r.year ?? '-'} | ${r.code} | ${r.name} | ${r.line ?? '-'}`);
  }
}

report.push('\n=== JÁ EXISTEM, MAS A WIKI DIZ OUTRO ANO (até 30) ===');
report.push('linha | código | nome | ano no banco | ano na Wiki | página');
yearMismatch.forEach((m) => report.push(m));

report.push('\n=== TREASURE HUNTS AMBÍGUOS (mesmo código para carrinhos diferentes) ===');
ambiguousTh.forEach((a) => report.push(a));

report.push('\n=== NO BANCO, SEM CONFIRMAÇÃO NA WIKI (até 15) ===');
for (const row of orphans.slice(0, 15)) report.push(`${row.line ?? '-'} | ${row.code} | ${row.name}`);

report.push('\n=== TABELAS NÃO RECONHECIDAS (cabeçalhos mais comuns) ===');
for (const [headers, count] of [...unrecognized.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12)) {
  report.push(`${count}x: ${headers.slice(0, 120)}`);
}

report.push('\n=== PÁGINAS SEM CARRINHOS (agrupadas; AAAA = ano) ===');
const noRowGroups = new Map();
for (const r of withoutRows) {
  const key = r.title.replace(/\b(19|20)\d{2}\b/g, 'AAAA');
  noRowGroups.set(key, (noRowGroups.get(key) ?? 0) + 1);
}
for (const [key, count] of [...noRowGroups.entries()].sort((a, b) => b[1] - a[1])) {
  report.push(`${count}x ${key}`);
}

report.push('\n=== PÁGINAS COM MUITAS LINHAS IGNORADAS (10 ou mais) ===');
for (const r of withRows.filter((p) => p.skipped >= 10).sort((a, b) => b.skipped - a.skipped).slice(0, 15)) {
  report.push(`${r.title}: ${r.skipped} ignoradas de ${r.rowsRead + r.skipped}`);
}

report.push('\n=== AMOSTRA DE NOVOS (linha | ano | código | nome | cor | série | etiquetas) ===');
const step = Math.max(1, Math.floor(newRecords.length / 15));
for (const c of newRecords.filter((_, i) => i % step === 0).slice(0, 15)) {
  report.push(
    `${c.line} | ${c.year ?? '-'} | ${c.code} | ${c.name}${c.variation ? ` (${c.variation})` : ''} | ${c.bodyColor ?? '-'} | ${c.series ?? '-'} | ${c.tags.join(', ') || '-'}`,
  );
}

if (VERBOSE) {
  const newByPage = new Map();
  newRecords.forEach((c) => newByPage.set(c._page, (newByPage.get(c._page) ?? 0) + 1));
  report.push('\n=== PÁGINAS COM CARRINHOS (* = descoberta por nome) ===');
  report.push('página | linha | tabelas ok/total | linhas lidas | ignoradas | novos');
  for (const r of withRows) {
    const mark = discoveredTitles.has(r.title) ? '* ' : '';
    report.push(
      `${mark}${r.title} | ${r.line} | ${r.recognized}/${r.tablesTotal} | ${r.rowsRead} | ${r.skipped} | ${newByPage.get(r.title) ?? 0}`,
    );
  }
  report.push('\n=== ERROS ===');
  for (const r of failed) report.push(`${r.title}: ${r.error}`);
}

fs.writeFileSync('import-report.txt', report.join('\n'), 'utf8');

console.log('\n' + summary.join('\n'));
console.log('\nRelatório completo salvo em backend\\import-report.txt');

// 7. Gravar (só com --save)
if (SAVE) {
  if (newRecords.length > 0) {
    const toSave = newRecords.map(({ _page, _subset, _thKind, ...data }) => data);
    for (let i = 0; i < toSave.length; i += 500) {
      await prisma.hotWheel.createMany({ data: toSave.slice(i, i + 500) });
      console.log(`  gravados ${Math.min(i + 500, toSave.length)}/${toSave.length}`);
    }
    console.log(`Gravação concluída: ${toSave.length} carrinhos novos.`);
  } else {
    console.log('Nada novo para gravar.');
  }

  for (const [tag, ids] of tagUpdates) {
    for (let i = 0; i < ids.length; i += 1000) {
      const chunk = ids.slice(i, i + 1000);
      await prisma.$executeRaw`UPDATE "HotWheel" SET "tags" = array_append("tags", ${tag}) WHERE "id" = ANY(${chunk}::text[]) AND NOT (${tag} = ANY("tags"))`;
    }
    console.log(`Etiqueta "${tag}" acrescentada em ${ids.length} carrinhos existentes.`);
  }
}

await prisma.$disconnect();