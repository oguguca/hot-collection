// Limpa marcação da Wiki que ficou gravada nos textos (ex: series = 'bgcolor="gray" |<font>Street Power</font>',
// name = "Ram 1500 ·", seriesNumber = "[[File:...|75px]]"), relendo a linha certa no cache local da Wiki.
// Só mexe no campo que tem marcação; se o cache não confirmar um valor limpo, o registro fica como está.
//   node scripts/fix-wiki-markup.mjs          -> SIMULAÇÃO: só lê, grava o plano e o backup em backups/
//   node scripts/fix-wiki-markup.mjs --save   -> grava (numa única transação; desfaz tudo se algo não bater)
import fs from 'fs';
import crypto from 'crypto';
import { PrismaClient } from '@prisma/client';
import { extractTables, parseTable, splitVariation, deriveSection } from './lib/wiki-parser.mjs';

const prisma = new PrismaClient();
const SAVE = process.argv.includes('--save');
const CACHE_DIR = '.wiki-cache';
const BACKUP_DIR = 'backups';
const FIELDS = ['name', 'series', 'seriesNumber', 'description'];

// Mesmo critério usado para achar a marcação no banco
const MARKUP = /<|bgcolor|style=|'''|\[\[|\{\{|&[a-z]+;|^\s*·|·\s*$/;

// Texto antigo só sem a marcação. Se o valor do cache for diferente disso, a limpeza perderia
// informação (ex: série "HW Race Team<br>'''Kmart Exclusive'''" virando só "HW Race Team").
const stripMarkup = (text) =>
  text
    .replace(/^[^|]*=[^|]*\|/, '')
    .replace(/<br\s*\/?>/gi, ' · ')
    .replace(/<[^>]+>/g, '')
    .replace(/'''/g, '')
    .replace(/\[\[(?:[^\]|]*\|)?([^\]]*)\]\]/g, '$1')
    .replace(/\s+/g, ' ')
    .replace(/^\s*(?:·\s*)+|(?:\s*·)+\s*$/g, '')
    .trim();

const normalizeName = (text) =>
  text.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '');
const sameName = (a, b) =>
  a === b || (a.length >= 4 && b.length >= 4 && (a.includes(b) || b.includes(a)));

const pages = new Map();
function loadPage(title) {
  if (pages.has(title)) return pages.get(title);
  const file = `${CACHE_DIR}/${crypto.createHash('sha1').update(title).digest('hex')}.json`;
  let entries = null;
  if (fs.existsSync(file)) {
    entries = [];
    const { wikitext } = JSON.parse(fs.readFileSync(file, 'utf8'));
    for (const table of extractTables(wikitext).map(parseTable)) {
      if (!table.recognized) continue;
      const section = deriveSection(title, table.headings);
      for (const item of table.items) {
        const name = splitVariation(item.name).name;
        // Mesmos valores que o import-all grava hoje
        entries.push({
          code: item.toyNumber,
          key: normalizeName(name),
          clean: { name, series: item.series ?? section, seriesNumber: item.seriesNumber, description: item.notes },
        });
      }
    }
  }
  pages.set(title, entries);
  return entries;
}

console.log(SAVE ? 'MODO GRAVAÇÃO' : 'MODO SIMULAÇÃO (nada será gravado)');

const { rows, existing } = await prisma.$transaction(async (tx) => {
  await tx.$executeRawUnsafe('SET TRANSACTION READ ONLY');
  const pattern = MARKUP.source;
  const rows = await tx.$queryRaw`
    SELECT id, code, name, year, line, "sourceUrl", series, "seriesNumber", description
    FROM "HotWheel"
    WHERE name ~ ${pattern} OR series ~ ${pattern} OR "seriesNumber" ~ ${pattern} OR description ~ ${pattern}`;
  const existing = await tx.hotWheel.findMany({ select: { id: true, code: true, name: true } });
  return { rows, existing };
});

// Para detectar se um nome limpo passaria a repetir outro carrinho com o mesmo código
const namesByCode = new Map();
for (const e of existing) {
  if (!namesByCode.has(e.code)) namesByCode.set(e.code, []);
  namesByCode.get(e.code).push({ id: e.id, key: normalizeName(e.name) });
}

const changes = [];
const kept = [];
const perField = Object.fromEntries(FIELDS.map((f) => [f, { comMarcacao: 0, corrigidos: 0, mantidos: 0 }]));

for (const row of rows) {
  const dirty = FIELDS.filter((f) => row[f] != null && MARKUP.test(row[f]));
  dirty.forEach((f) => perField[f].comMarcacao++);

  const title = row.sourceUrl ? decodeURIComponent(row.sourceUrl.split('/wiki/')[1]).replace(/_/g, ' ') : null;
  const entries = title ? loadPage(title) : null;
  const keep = (reason) => {
    dirty.forEach((f) => perField[f].mantidos++);
    kept.push(`${reason}: ${row.year} ${row.code} ${row.name}`);
  };

  if (!entries) {
    keep('página fora do cache');
    continue;
  }

  // Mesmo código e nome compatível; o nome do banco pode ter marcação, então compara já normalizado
  const key = normalizeName(row.name.replace(/<[^>]+>|·/g, ' '));
  const candidates = entries.filter((e) => e.code === row.code);
  const matches = candidates.filter((e) => sameName(e.key, key));
  const pool = matches.length ? matches : candidates.length === 1 ? candidates : [];
  if (!pool.length) {
    keep('sem linha correspondente no cache');
    continue;
  }
  // O mesmo carro pode aparecer mais de uma vez na página; só serve se todas as linhas concordarem
  const agree = dirty.every((f) => pool.every((e) => (e.clean[f] ?? null) === (pool[0].clean[f] ?? null)));
  if (!agree) {
    keep('linhas do cache discordam do valor limpo');
    continue;
  }
  const entry = pool[0];

  const after = {};
  for (const field of dirty) {
    const value = entry.clean[field] ?? null;
    if (value != null && MARKUP.test(value)) {
      perField[field].mantidos++;
      kept.push(`${field} ainda com marcação no cache: ${row.year} ${row.code} "${value}"`);
      continue;
    }
    if (value === row[field]) continue;
    // seriesNumber com foto ("[[File:...|75px]]") não tem informação a perder; os outros campos sim
    if (field !== 'seriesNumber' && value !== stripMarkup(row[field])) {
      perField[field].mantidos++;
      kept.push(`${field} perderia informação: ${row.year} ${row.code} "${stripMarkup(row[field])}" -> "${value}"`);
      continue;
    }
    after[field] = value;
    perField[field].corrigidos++;
  }
  if (Object.keys(after).length === 0) continue;

  let duplicate = null;
  if (after.name) {
    const newKey = normalizeName(after.name);
    duplicate = (namesByCode.get(row.code) ?? []).find((o) => o.id !== row.id && o.key === newKey) ?? null;
  }
  const before = Object.fromEntries(Object.keys(after).map((f) => [f, row[f]]));
  changes.push({ id: row.id, code: row.code, year: row.year, before, after, duplicateOf: duplicate?.id ?? null });
}

const duplicates = changes.filter((c) => c.duplicateOf);

console.log('\n=== RESUMO ===');
console.log(`Registros com marcação: ${rows.length} | a corrigir: ${changes.length} | mantidos como estão: ${new Set(kept).size}`);
console.table(perField);
console.log(`Nomes limpos que ficariam iguais a outro carrinho com o mesmo código: ${duplicates.length}`);

for (const field of FIELDS) {
  const sample = changes.filter((c) => field in c.after);
  if (!sample.length) continue;
  console.log(`\n=== ${field}: amostra (${sample.length}) ===`);
  const step = Math.max(1, Math.floor(sample.length / 6));
  for (const c of sample.filter((_, i) => i % step === 0).slice(0, 6)) {
    console.log(`  ${c.year} ${c.code}: "${c.before[field]}" -> ${c.after[field] === null ? 'nulo' : `"${c.after[field]}"`}`);
  }
}

console.log(`\n=== MANTIDOS COMO ESTÃO (${kept.length}) ===`);
kept.slice(0, 15).forEach((k) => console.log(' ', k));
if (duplicates.length) {
  console.log('\n=== NOMES QUE VIRARIAM DUPLICATA ===');
  duplicates.forEach((c) => console.log(`  ${c.year} ${c.code} "${c.after.name}" (igual a ${c.duplicateOf})`));
}

fs.mkdirSync(BACKUP_DIR, { recursive: true });
const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const planFile = `${BACKUP_DIR}/wiki-markup-${SAVE ? 'save' : 'simulacao'}-${stamp}.json`;
fs.writeFileSync(planFile, JSON.stringify({ createdAt: new Date().toISOString(), perField, changes, kept }, null, 2), 'utf8');
console.log(`\nPlano e backup (valores antigos de cada campo) salvos em backend/${planFile}`);

if (!SAVE) {
  console.log('\nSimulação concluída. Rode com --save para gravar.');
  await prisma.$disconnect();
  process.exit(0);
}

if (duplicates.length) {
  console.log('\nGravação BLOQUEADA: há nomes que virariam duplicata. Resolva esses casos antes.');
  await prisma.$disconnect();
  process.exit(1);
}

await prisma.$transaction(
  async (tx) => {
    let done = 0;
    for (const c of changes) {
      // Só altera se os campos ainda estiverem como na simulação
      const result = await tx.hotWheel.updateMany({ where: { id: c.id, ...c.before }, data: c.after });
      if (result.count !== 1) throw new Error(`${c.code} (${c.id}) mudou desde a simulação. Nada foi gravado.`);
      if (++done % 200 === 0) console.log(`  gravados ${done}/${changes.length}`);
    }
    console.log(`  gravados ${done}/${changes.length}`);
  },
  { timeout: 600000 },
);
console.log('Gravação concluída.');
await prisma.$disconnect();
