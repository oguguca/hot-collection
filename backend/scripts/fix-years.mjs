// Corrige o ano de carrinhos gravados com o ano do título PEDIDO à Wiki, e não o da tabela em que aparecem.
// Ex: "2016 Zamac Walmart Exclusive" redireciona para "Walmart Exclusive Zamac Editions", que tem uma tabela
// por ano (2013 ... 2027); o importador antigo gravou 2016 em todos.
//
// Regra (só com evidência do cache local da Wiki):
//  - O ano só muda quando o ano do banco não aparece em nenhuma tabela da Wiki para aquele código e nome.
//  - Se a Wiki dá um único ano, ele é usado. Se dá mais de um, o caso fica para decisão manual.
//  - Ano acima de MAX_YEAR (anúncio, regra do import-all): o registro sai do catálogo, se não estiver em garagem.
//   node scripts/fix-years.mjs          -> SIMULAÇÃO: só lê, grava o plano e o backup em backups/
//   node scripts/fix-years.mjs --save   -> grava (numa única transação; desfaz tudo se algo não bater)
import fs from 'fs';
import { PrismaClient } from '@prisma/client';
import { extractTables, parseTable, deriveYear, splitVariation, sameCar, applyWikiErrata } from './lib/wiki-parser.mjs';

const prisma = new PrismaClient();
const SAVE = process.argv.includes('--save');
const CACHE_DIR = '.wiki-cache';
const BACKUP_DIR = 'backups';
const MAX_YEAR = 2026;

// Índice: código -> aparições na Wiki (página, ano da tabela, nome)
const pages = new Map();
for (const file of fs.readdirSync(CACHE_DIR)) {
  const page = JSON.parse(fs.readFileSync(`${CACHE_DIR}/${file}`, 'utf8'));
  if (page.ok) pages.set(page.title, page);
}
const byCode = new Map();
for (const page of pages.values()) {
  for (const table of extractTables(page.wikitext).map(parseTable)) {
    if (!table.recognized) continue;
    const year = deriveYear(page.title, table.headings);
    if (!year) continue;
    for (const raw of table.items) {
      const item = applyWikiErrata(raw, page.title);
      if (!byCode.has(item.toyNumber)) byCode.set(item.toyNumber, []);
      byCode.get(item.toyNumber).push({ page: page.title, year, name: splitVariation(item.name).name });
    }
  }
}

console.log(SAVE ? 'MODO GRAVAÇÃO' : 'MODO SIMULAÇÃO (nada será gravado)');

const rows = await prisma.$transaction(async (tx) => {
  await tx.$executeRawUnsafe('SET TRANSACTION READ ONLY');
  return tx.hotWheel.findMany({
    where: { year: { not: null }, source: { not: null } },
    select: { id: true, code: true, name: true, year: true, line: true, sourceUrl: true, collection: true, _count: { select: { garageItems: true } } },
  });
});

const changes = [];
const removals = [];
const manual = [];
let semEvidencia = 0;

for (const row of rows) {
  const seen = (byCode.get(row.code) ?? []).filter((o) => sameCar(o.name, row.name));
  if (!seen.length) {
    semEvidencia++;
    continue;
  }
  const years = [...new Set(seen.map((o) => o.year))].sort();
  if (years.includes(row.year)) continue;

  const where = [...new Set(seen.map((o) => `${o.page} (${o.year})`))].join('; ');
  if (years.length > 1) {
    manual.push(`${row.line ?? '-'} | ${row.code} | ${row.name} | banco ${row.year} | Wiki: ${where}`);
    continue;
  }
  const year = years[0];
  if (year > MAX_YEAR) {
    if (row._count.garageItems > 0) {
      manual.push(`${row.line ?? '-'} | ${row.code} | ${row.name} | ano ${year} (anúncio) mas está em ${row._count.garageItems} garagem(ns)`);
      continue;
    }
    removals.push({ id: row.id, code: row.code, name: row.name, line: row.line, before: row.year, wikiYear: year, where });
    continue;
  }
  // "collection" é "<ano> <linha>": acompanha o ano
  const collection = row.collection?.replace(new RegExp(`^${row.year}\\b`), String(year)) ?? row.collection;
  changes.push({
    id: row.id,
    code: row.code,
    name: row.name,
    line: row.line,
    before: { year: row.year, collection: row.collection },
    after: { year, collection },
    where,
  });
}

console.log(`\nRegistros lidos: ${rows.length} | sem aparição na Wiki para comparar: ${semEvidencia}`);
console.log(`Anos a corrigir: ${changes.length} | anúncios (ano > ${MAX_YEAR}) a retirar: ${removals.length} | decisão manual: ${manual.length}`);

const byLine = new Map();
for (const c of changes) {
  const k = `${c.line} | ${c.before.year} -> ${c.after.year}`;
  byLine.set(k, (byLine.get(k) ?? 0) + 1);
}
console.log('\n=== CORREÇÕES (linha | ano antigo -> ano da Wiki) ===');
for (const [k, n] of [...byLine].sort()) console.log(`  ${n}\t${k}`);
console.log('\n=== AMOSTRA ===');
changes.filter((_, i) => i % Math.max(1, Math.floor(changes.length / 8)) === 0).slice(0, 8)
  .forEach((c) => console.log(`  ${c.code} ${c.name}: ${c.before.year} -> ${c.after.year} (${c.where})`));
console.log('\n=== ANÚNCIOS A RETIRAR ===');
removals.forEach((r) => console.log(`  ${r.code} ${r.name} (${r.line}): banco ${r.before}, Wiki ${r.wikiYear}`));
console.log('\n=== DECISÃO MANUAL (não serão tocados) ===');
manual.forEach((m) => console.log(' ', m));

fs.mkdirSync(BACKUP_DIR, { recursive: true });
const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const planFile = `${BACKUP_DIR}/years-${SAVE ? 'save' : 'simulacao'}-${stamp}.json`;
let removedRecords = [];
if (SAVE && removals.length) {
  removedRecords = await prisma.hotWheel.findMany({ where: { id: { in: removals.map((r) => r.id) } } });
}
fs.writeFileSync(planFile, JSON.stringify({ createdAt: new Date().toISOString(), changes, removals, removedRecords, manual }, null, 2), 'utf8');
console.log(`\nPlano e backup salvos em backend/${planFile}`);

if (!SAVE) {
  console.log('\nSimulação concluída. Rode com --save para gravar.');
  await prisma.$disconnect();
  process.exit(0);
}

await prisma.$transaction(
  async (tx) => {
    for (const c of changes) {
      const result = await tx.hotWheel.updateMany({ where: { id: c.id, year: c.before.year, collection: c.before.collection }, data: c.after });
      if (result.count !== 1) throw new Error(`${c.code} (${c.id}) mudou desde a simulação. Nada foi gravado.`);
    }
    for (const r of removals) {
      if ((await tx.garageItem.count({ where: { hotWheelId: r.id } })) > 0) throw new Error(`${r.code} ganhou itens de garagem.`);
      await tx.hotWheel.delete({ where: { id: r.id } });
    }
    console.log(`\nAnos corrigidos: ${changes.length} | anúncios retirados: ${removals.length}`);
  },
  { timeout: 300000 },
);
await prisma.$disconnect();
