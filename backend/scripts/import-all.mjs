// Importador geral do catálogo (Hot Wheels Wiki, Fandom, CC BY-SA).
//   node scripts/import-all.mjs            -> MODO TESTE: não grava nada, escreve import-report.txt
//   node scripts/import-all.mjs --save     -> grava no banco
//   node scripts/import-all.mjs --refresh  -> ignora o cache local e busca tudo de novo na Wiki
//   node scripts/import-all.mjs --verbose  -> relatório com a lista completa de páginas
//   node scripts/import-all.mjs --offline  -> usa só as páginas do cache local, sem acessar a Wiki
//   node scripts/import-all.mjs --sync-tags -> com --save, retira etiquetas que são de outra variação de cor
// Toda gravação salva antes um backup em backups/import-save-*.json.
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
  subsetOf,
  applyWikiErrata,
  tagsFromSeriesNotes,
} from './lib/wiki-parser.mjs';

const prisma = new PrismaClient();
const SAVE = process.argv.includes('--save');
const REFRESH = process.argv.includes('--refresh');
const VERBOSE = process.argv.includes('--verbose');
const OFFLINE = process.argv.includes('--offline');
const SYNC_TAGS = process.argv.includes('--sync-tags');
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
  // Páginas gerais (títulos reais) com o nome de linha que o catálogo já usa
  if (/^walmart exclusive zamac editions$/i.test(line)) return 'Zamac Walmart Exclusive';
  if (/^cars of the decades series$/i.test(line)) return 'Wal-Mart Decades Series';
  return line;
}

// Páginas de subconjuntos (Treasure Hunts, New Models, First Editions...): regras em lib/wiki-parser.mjs.
// Quando o carrinho já existe na linha pai, ele só ganha a etiqueta; variantes próprias (ZAMAC) não.

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

      for (const raw of table.items) {
        rowsRead++;
        const item = applyWikiErrata(raw, pageTitle);
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
          // "Kmart Exclusive", "New for 2024!"... da 2ª linha da célula da série
          _noteTags: tagsFromSeriesNotes(item.seriesNotes),
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
const addTags = (record, tags) => {
  for (const t of tags) if (t && !record.tags.includes(t)) record.tags.push(t);
};
// Cada variação de cor com o mesmo código é um carrinho à parte ("2nd Color", "3rd Color"...)
const variationKey = (v) => (v ?? '').trim().toLowerCase();
for (const c of usable) {
  const rule = c._subset;
  const ownRecord = rule?.parent === null; // variante física própria (ex: ZAMAC): nunca é fundida
  const baseKey = `${c.code}|${normalizeName(c.name)}|${variationKey(c.variation)}`;
  const key = ownRecord ? `${baseKey}|${c.line}` : baseKey;
  const tag = rule?.tag ?? null;
  let found = byKey.get(key);
  // Nome escrito de outro jeito: só na linha pai, no mesmo ano (ou página sem ano, ex: "Mystery Cars"),
  // na mesma variação de cor
  if (!found && rule && !ownRecord) {
    const inParent = (mainByCode.get(c.code) ?? []).filter(
      (m) =>
        (!rule.parent || rule.parent === '*' || m.line === rule.parent) &&
        (!c.year || m.year === c.year) &&
        sameCar(m.name, c.name),
    );
    found = inParent.find((m) => variationKey(m.variation) === variationKey(c.variation));
    // A página do subconjunto não diz a cor ("2011 New Models": "Danicar") e o código só existe numa
    // variação na linha pai (T9944 = "Danicar (2nd Color)"): é essa variação
    if (!found && !c.variation && inParent.length === 1) found = inParent[0];
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
    addTags(found, [tag, ...c._noteTags]);
    continue;
  }
  const record = { ...c, tags: [] };
  addTags(record, [tag, ...c._noteTags]);
  byKey.set(key, record);
  if (!c._subset) {
    if (!mainByCode.has(c.code)) mainByCode.set(c.code, []);
    mainByCode.get(c.code).push(record);
  }
}
// O mesmo carrinho descrito sem cor numa página e com uma única variação em OUTRA página
// (ex: HYY21 na página de Zamac sem cor e "2nd Color - Zamac" na lista principal): é um registro só.
// Na mesma página, sem cor + "2nd Color" são carrinhos diferentes (o comum e a variação).
// Nomes comparados por palavras: "Pagani Zonda Cinque (Tooned)" na página de Zamac = "Pagani Zonda Cinque".
const byCodeAll = new Map();
for (const [key, r] of byKey) {
  if (r.variation === STH || subsetOf(r.line)?.parent === null) continue;
  if (!byCodeAll.has(r.code)) byCodeAll.set(r.code, []);
  byCodeAll.get(r.code).push({ key, r });
}
for (const entries of byCodeAll.values()) {
  for (const p of entries.filter((g) => !g.r.variation && byKey.has(g.key))) {
    const same = entries.filter((g) => g !== p && byKey.has(g.key) && sameCar(g.r.name, p.r.name));
    const colored = same.filter((g) => g.r.variation);
    // Só quando não há ambiguidade: uma única variação, e nenhum outro "sem cor" do mesmo carrinho
    if (colored.length !== 1 || same.some((g) => !g.r.variation)) continue;
    const [v] = colored;
    if (p.r._page === v.r._page) continue;
    // Fica o registro da linha principal; se um lado é subconjunto (ex: página de TH), vale o outro
    const pSubset = Boolean(p.r._subset);
    const vSubset = Boolean(v.r._subset);
    const [keep, drop] = pSubset === vSubset ? [v, p] : vSubset ? [p, v] : [v, p];
    addTags(keep.r, drop.r.tags);
    byKey.delete(drop.key);
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
    variation: variationKey(row.variation),
    tags: row.tags ?? [],
    year: row.year,
    line: row.line,
  });
}
const yearMismatch = []; // já existe, mas a Wiki diz outro ano
const matchedIds = new Map(); // id do banco -> carrinho da Wiki que corresponde a ele

const newRecords = [];
const alreadyThere = [];
const tagUpdates = new Map(); // etiqueta -> ids de carrinhos que já existem

for (const c of distinct) {
  const normalized = normalizeName(c.name);
  // A variante STH só corresponde a outra variante STH; variantes próprias (ZAMAC) só à mesma linha;
  // entre os possíveis, vale o do mesmo ano (relançamentos têm um registro por ano)
  const isSthVariant = c.variation === STH;
  const ownLine = subsetOf(c.line)?.parent === null;
  const possible = (existingByCode.get(c.code) ?? []).filter(
    (e) =>
      e.isSthVariant === isSthVariant &&
      (isSthVariant || e.variation === variationKey(c.variation)) &&
      (ownLine ? e.line === c.line : subsetOf(e.line)?.parent !== null) &&
      (sameName(e.name, normalized) || sameCar(e.rawName, c.name)),
  );
  // Ordem fixa: mesmo ano, depois nome igual, depois o resto (não depende da ordem do banco)
  const rank = (e) => (e.year === c.year ? 0 : 2) + (e.name === normalized ? 0 : 1);
  const match = [...possible].sort((a, b) => rank(a) - rank(b) || a.id.localeCompare(b.id))[0];
  if (match) matchedIds.set(match.id, [...(matchedIds.get(match.id) ?? []), c]);

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

// --sync-tags: retira só as etiquetas que pertencem a OUTRA variação de cor do mesmo carrinho (quando as cores
// eram um registro só, a anotação de uma cor ia para todas). Ex: "Walmart Exclusive" da 2ª cor do R7506 estava
// no Cougar comum. Outras etiquetas que a Wiki não justifica só aparecem no relatório (nomes escritos de jeitos
// diferentes entre páginas fazem a comparação falhar, ex: "Crooze Ooz Coupe" x "Crooze Ooze Coupe").
const tagSync = []; // { id, before, after, removed }
const unjustified = new Map(); // etiqueta -> quantidade (só relatório)
const sharedMatches = [];
const variantsOf = new Map(); // código|nome -> carrinhos da Wiki de cada variação
for (const c of distinct) {
  const k = `${c.code}|${normalizeName(c.name)}`;
  if (!variantsOf.has(k)) variantsOf.set(k, []);
  variantsOf.get(k).push(c);
}
const existingById = new Map(existingRows.map((r) => [r.id, r]));
for (const [id, cs] of matchedIds) {
  const row = existingById.get(id);
  if (cs.length > 1) {
    sharedMatches.push(`${row.code} | ${row.name} | ${cs.map((c) => `${c.name}${c.variation ? ` (${c.variation})` : ''}`).join(' / ')}`);
    continue;
  }
  const c = cs[0];
  const before = row.tags ?? [];
  const extra = before.filter((t) => !c.tags.includes(t));
  if (!extra.length) continue;
  const otherVariationTags = new Set(
    (variantsOf.get(`${c.code}|${normalizeName(c.name)}`) ?? [])
      .filter((o) => o !== c && variationKey(o.variation) !== variationKey(c.variation) && o.variation !== STH)
      .flatMap((o) => o.tags),
  );
  const removed = extra.filter((t) => otherVariationTags.has(t));
  extra.filter((t) => !otherVariationTags.has(t)).forEach((t) => unjustified.set(t, (unjustified.get(t) ?? 0) + 1));
  if (removed.length) {
    tagSync.push({ id, code: row.code, name: row.name, year: row.year, before, after: before.filter((t) => !removed.includes(t)), removed });
  }
}
const tagRemovals = new Map();
for (const s of tagSync) for (const t of s.removed) tagRemovals.set(t, (tagRemovals.get(t) ?? 0) + 1);

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
summary.push(`Etiquetas de outra variação de cor (saem com --sync-tags): ${[...tagRemovals.values()].reduce((a, b) => a + b, 0)} em ${tagSync.length} carrinhos`);
summary.push(`Etiquetas sem justificativa encontrada (só relatório): ${[...unjustified.values()].reduce((a, b) => a + b, 0)}`);
summary.push(`Registros do banco que correspondem a mais de um carrinho da Wiki: ${sharedMatches.length}`);
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
for (const [tag, ids] of tagUpdates) {
  for (const id of ids.slice(0, 20)) {
    const r = existingById.get(id);
    report.push(`${tag} | ${r.year ?? '-'} | ${r.code} | ${r.name} | ${r.line ?? '-'}`);
  }
}

report.push('\n=== JÁ EXISTEM, MAS A WIKI DIZ OUTRO ANO (até 30) ===');
report.push('linha | código | nome | ano no banco | ano na Wiki | página');
yearMismatch.forEach((m) => report.push(m));

report.push('\n=== ETIQUETAS DE OUTRA VARIAÇÃO DE COR (saem com --sync-tags) ===');
for (const [t, n] of [...tagRemovals].sort((a, b) => b[1] - a[1])) {
  report.push(`${t}: ${n}`);
  tagSync
    .filter((s) => s.removed.includes(t))
    .slice(0, 5)
    .forEach((s) => report.push(`    ex: ${s.year ?? '-'} | ${s.code} | ${s.name}`));
}
report.push('--- amostra (até 30) ---');
tagSync.slice(0, 30).forEach((s) => report.push(`${s.year ?? '-'} | ${s.code} | ${s.name} | [${s.before.join(', ')}] -> [${s.after.join(', ')}]`));

report.push('\n=== ETIQUETAS SEM JUSTIFICATIVA ENCONTRADA (ficam; só relatório) ===');
for (const [t, n] of [...unjustified].sort((a, b) => b[1] - a[1])) report.push(`${t}: ${n}`);

report.push('\n=== REGISTROS QUE CORRESPONDEM A MAIS DE UM CARRINHO DA WIKI (até 30) ===');
sharedMatches.slice(0, 30).forEach((m) => report.push(m));

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

report.push('\n=== NOVOS POR LINHA (* = linha que ainda não existe no banco) ===');
const dbLines = new Set(existingRows.map((r) => r.line));
const newByLine = new Map();
newRecords.forEach((c) => newByLine.set(c.line, (newByLine.get(c.line) ?? 0) + 1));
for (const [line, n] of [...newByLine].sort((a, b) => b[1] - a[1])) report.push(`${dbLines.has(line) ? '' : '* '}${line}: ${n}`);

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
  // Backup do que vai mudar: registros novos e as etiquetas atuais dos que ganham etiqueta
  fs.mkdirSync('backups', { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const sync = SYNC_TAGS ? tagSync : [];
  const touched = new Set([...[...tagUpdates.values()].flat(), ...sync.map((s) => s.id)]);
  const toSave = newRecords.map(({ _page, _subset, _thKind, _noteTags, ...data }) => data);
  fs.writeFileSync(
    `backups/import-save-${stamp}.json`,
    JSON.stringify(
      {
        createdAt: new Date().toISOString(),
        newRecords: toSave,
        tagUpdates: Object.fromEntries(tagUpdates),
        tagSync: sync,
        tagsBefore: existingRows.filter((r) => touched.has(r.id)).map((r) => ({ id: r.id, tags: r.tags })),
      },
      null,
      2,
    ),
    'utf8',
  );
  console.log(`Backup salvo em backend/backups/import-save-${stamp}.json`);

  // Tudo numa transação: ou grava tudo, ou nada
  await prisma.$transaction(
    async (tx) => {
      for (let i = 0; i < toSave.length; i += 500) {
        await tx.hotWheel.createMany({ data: toSave.slice(i, i + 500) });
        console.log(`  gravados ${Math.min(i + 500, toSave.length)}/${toSave.length}`);
      }
      console.log(toSave.length ? `Carrinhos novos: ${toSave.length}.` : 'Nada novo para gravar.');

      for (const [tag, ids] of tagUpdates) {
        for (let i = 0; i < ids.length; i += 1000) {
          const chunk = ids.slice(i, i + 1000);
          await tx.$executeRaw`UPDATE "HotWheel" SET "tags" = array_append("tags", ${tag}) WHERE "id" = ANY(${chunk}::text[]) AND NOT (${tag} = ANY("tags"))`;
        }
        console.log(`Etiqueta "${tag}" acrescentada em ${ids.length} carrinhos existentes.`);
      }

      for (const s of sync) {
        // Só se as etiquetas ainda forem as lidas no começo
        const result = await tx.hotWheel.updateMany({ where: { id: s.id, tags: { equals: s.before } }, data: { tags: s.after } });
        if (result.count !== 1) throw new Error(`${s.code} (${s.id}): as etiquetas mudaram durante a importação. Nada foi gravado.`);
      }
      if (sync.length) console.log(`Etiquetas de outra variação retiradas em ${sync.length} carrinhos.`);
    },
    { timeout: 600000 },
  );
  console.log('Gravação concluída.');
}

await prisma.$disconnect();