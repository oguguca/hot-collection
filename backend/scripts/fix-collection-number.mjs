// Separa o número de coleção ("120") do total da coleção (365), usando o cache local da Wiki.
// O total só é preenchido quando a própria Wiki o informa:
//   - na célula da tabela (ex: "3/5"), ou
//   - no título da seção da tabela (ex: "Hot Wheels #1-365").
// Caso contrário fica nulo. O "/250" que o importador antigo acrescentava não conta como fonte.
//   node scripts/fix-collection-number.mjs          -> SIMULAÇÃO: só lê, grava o plano em backups/
//   node scripts/fix-collection-number.mjs --save   -> grava (exige a coluna collectionTotal)
import fs from 'fs';
import crypto from 'crypto';
import { PrismaClient } from '@prisma/client';
import {
  extractTables,
  parseTable,
  splitVariation,
  splitCollectionNumber,
  resolveCollectionNumber,
} from './lib/wiki-parser.mjs';

const prisma = new PrismaClient();
const SAVE = process.argv.includes('--save');
const CACHE_DIR = '.wiki-cache';
const BACKUP_DIR = 'backups';

const normalizeName = (text) =>
  text.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '');
const sameName = (a, b) =>
  a === b || (a.length >= 4 && b.length >= 4 && (a.includes(b) || b.includes(a)));

// Valor gravado no banco: "178<!-- comentário -->/250" -> { number: "178", total: 250 }.
// Esse total NÃO é usado como fonte (era o "/250" fixo do importador antigo).
// Aqui o "/N" é separado mesmo quando impossível (ex: "343/250"), só para comparar com a Wiki.
function splitNumber(raw) {
  const stored = splitCollectionNumber(raw);
  const match = stored.number?.match(/^(\d+)\s*\/\s*(\d+)$/);
  return match ? { number: match[1], total: parseInt(match[2], 10) } : stored;
}
const FROM_LABEL = { cell: 'célula', heading: 'título da seção' };

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
      for (const item of table.items) {
        const resolved = resolveCollectionNumber(item.colNumber, table.headings);
        entries.push({
          code: item.toyNumber,
          name: normalizeName(splitVariation(item.name).name),
          number: resolved.collectionNumber,
          total: resolved.collectionTotal,
          totalFrom: FROM_LABEL[resolved.totalFrom] ?? null,
        });
      }
    }
  }
  pages.set(title, entries);
  return entries;
}

console.log(SAVE ? 'MODO GRAVAÇÃO' : 'MODO SIMULAÇÃO (nada será gravado)');

const rows = await prisma.$transaction(async (tx) => {
  await tx.$executeRawUnsafe('SET TRANSACTION READ ONLY');
  return tx.hotWheel.findMany({
    where: { collectionNumber: { not: null } },
    select: { id: true, code: true, name: true, year: true, line: true, sourceUrl: true, collectionNumber: true },
  });
});

const changes = [];
const stats = { lidos: rows.length, semMudanca: 0, semCache: 0, semCorrespondencia: 0, numeroDiferente: 0, numeroMaiorQueTotal: 0 };
const outcome = new Map(); // "antes -> depois" -> quantidade
const byYear = new Map();
const flagged = [];

for (const row of rows) {
  const current = splitNumber(row.collectionNumber);
  let number = current.number;
  let total = null;
  let totalFrom = null;

  const title = row.sourceUrl ? decodeURIComponent(row.sourceUrl.split('/wiki/')[1]).replace(/_/g, ' ') : null;
  const entries = title ? loadPage(title) : null;

  if (!entries) {
    stats.semCache++;
  } else {
    const name = normalizeName(row.name);
    const candidates = entries.filter((e) => e.code === row.code);
    const byName = candidates.filter((e) => e.name === name || sameName(e.name, name));
    const pool = byName.length ? byName : candidates.length === 1 ? candidates : [];
    const entry = pool.find((e) => e.number === current.number) ?? pool[0];

    if (!entry) {
      stats.semCorrespondencia++;
      flagged.push(`sem correspondência no cache: ${row.year} ${row.code} ${row.name}`);
    } else {
      const differs = /^\d+$/.test(entry.number ?? '') && /^\d+$/.test(current.number ?? '')
        ? parseInt(entry.number, 10) !== parseInt(current.number, 10)
        : (entry.number ?? '') !== (current.number ?? '');
      if (differs) {
        stats.numeroDiferente++;
        flagged.push(`número difere: ${row.year} ${row.code} ${row.name} banco="${row.collectionNumber}" wiki="${entry.number}"`);
      }
      number = entry.number ?? number;
      total = entry.total;
      totalFrom = entry.totalFrom;
    }
  }

  const numeric = parseInt(number, 10);
  if (total && Number.isFinite(numeric) && numeric > total) {
    stats.numeroMaiorQueTotal++;
    flagged.push(`número maior que o total, total descartado: ${row.year} ${row.code} ${number}/${total}`);
    total = null;
    totalFrom = null;
  }

  const key = `${current.total ? `/${current.total}` : 'sem total'} -> ${total ? `total ${total} (${totalFrom})` : 'total nulo'}`;
  outcome.set(key, (outcome.get(key) ?? 0) + 1);

  const y = byYear.get(row.year) ?? { n: 0, totals: new Map() };
  y.n++;
  y.totals.set(total ?? 'nulo', (y.totals.get(total ?? 'nulo') ?? 0) + 1);
  byYear.set(row.year, y);

  if (number === row.collectionNumber && total === null) {
    stats.semMudanca++;
    continue;
  }
  changes.push({
    id: row.id,
    code: row.code,
    year: row.year,
    before: { collectionNumber: row.collectionNumber },
    after: { collectionNumber: number, collectionTotal: total },
    totalFrom,
  });
}

console.log('\n=== RESUMO ===');
console.log(stats);
console.log(`Registros a alterar: ${changes.length}`);

console.log('\n=== ANTES -> DEPOIS ===');
for (const [k, n] of [...outcome].sort((a, b) => b[1] - a[1])) console.log(`${n}\t${k}`);

console.log('\n=== TOTAL POR ANO (ano: total=quantidade) ===');
for (const [year, y] of [...byYear].sort((a, b) => (a[0] ?? 0) - (b[0] ?? 0))) {
  console.log(`${year ?? '-'}: ${[...y.totals].map(([t, n]) => `${t}=${n}`).join(', ')}`);
}

console.log('\n=== AMOSTRA DE MUDANÇAS ===');
const step = Math.max(1, Math.floor(changes.length / 12));
for (const c of changes.filter((_, i) => i % step === 0).slice(0, 12)) {
  console.log(`${c.year} ${c.code}: "${c.before.collectionNumber}" -> número "${c.after.collectionNumber}", total ${c.after.collectionTotal ?? 'nulo'}`);
}

console.log(`\n=== PARA CONFERIR (${flagged.length}) ===`);
flagged.slice(0, 20).forEach((f) => console.log(' ', f));

fs.mkdirSync(BACKUP_DIR, { recursive: true });
const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const planFile = `${BACKUP_DIR}/collection-number-${SAVE ? 'save' : 'simulacao'}-${stamp}.json`;
fs.writeFileSync(planFile, JSON.stringify({ createdAt: new Date().toISOString(), stats, changes, flagged }, null, 2), 'utf8');
console.log(`\nPlano e backup (valores antigos de cada registro) salvos em backend/${planFile}`);

if (!SAVE) {
  console.log('\nSimulação concluída. Rode com --save para gravar.');
  await prisma.$disconnect();
  process.exit(0);
}

const column = await prisma.$queryRaw`
  SELECT 1 FROM information_schema.columns
  WHERE table_name = 'HotWheel' AND column_name = 'collectionTotal'`;
if (column.length === 0) {
  console.log('\nA coluna collectionTotal ainda não existe. Aplique a migração antes de usar --save.');
  await prisma.$disconnect();
  process.exit(1);
}

await prisma.$transaction(
  async (tx) => {
    for (let i = 0; i < changes.length; i += 500) {
      const chunk = changes.slice(i, i + 500);
      const ids = chunk.map((c) => c.id);
      const before = chunk.map((c) => c.before.collectionNumber);
      const numbers = chunk.map((c) => c.after.collectionNumber);
      const totals = chunk.map((c) => c.after.collectionTotal);
      // Só altera se o valor ainda for o mesmo da simulação
      const updated = await tx.$executeRaw`
        UPDATE "HotWheel" h
        SET "collectionNumber" = v.number, "collectionTotal" = v.total
        FROM unnest(${ids}::text[], ${before}::text[], ${numbers}::text[], ${totals}::int[]) AS v(id, before, number, total)
        WHERE h.id = v.id AND h."collectionNumber" IS NOT DISTINCT FROM v.before`;
      if (updated !== chunk.length) throw new Error(`Lote ${i}: esperava ${chunk.length}, alterou ${updated}. Nada foi gravado.`);
      console.log(`  gravados ${Math.min(i + 500, changes.length)}/${changes.length}`);
    }
  },
  { timeout: 120000 },
);
console.log('Gravação concluída.');
await prisma.$disconnect();
