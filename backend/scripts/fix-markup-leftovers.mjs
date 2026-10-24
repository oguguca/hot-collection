// Sobras da limpeza de marcação (fix-wiki-markup.mjs):
//  1. Séries com marcação que o parser não separa (atributo de célula quebrado na própria Wiki, ou
//     segunda linha como "'''Kmart Exclusive'''"). A marcação sai e a segunda linha fica, separada
//     por " · " (ex: "HW Race Team · Kmart Exclusive"): nenhuma informação se perde.
//  2. Registros que são lixo de parsing (código "75PX" lido de um template da Wiki), sem garagem.
//   node scripts/fix-markup-leftovers.mjs          -> SIMULAÇÃO: só lê, grava o plano e o backup em backups/
//   node scripts/fix-markup-leftovers.mjs --save   -> grava (numa única transação; desfaz tudo se algo não bater)
import fs from 'fs';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const SAVE = process.argv.includes('--save');
const BACKUP_DIR = 'backups';
const MARKUP = /<|bgcolor|style=|'''|\[\[|\{\{|\}\}|&[a-z]+;|^\s*·|·\s*$/;
// Série que é só a etiqueta: tratada na etapa de Treasure Hunts, não aqui
const TAG_ONLY = /^'''\s*(super\s+)?treasure hunt\s*'''$/i;

export function cleanSeries(raw) {
  return raw
    .replace(/^[^|]*=[^|]*\|/, '') // atributo de célula, mesmo quebrado: bgcolor="x" <font>|Texto
    .replace(/<br\s*\/?>/gi, ' · ')
    .replace(/'''([^']+)'''/g, ' · $1 · ')
    .replace(/<[^>]+>/g, '')
    .replace(/\s+/g, ' ')
    .replace(/(?:\s*·\s*)+/g, ' · ')
    .replace(/^\s*·\s*|\s*·\s*$/g, '')
    .trim();
}

console.log(SAVE ? 'MODO GRAVAÇÃO' : 'MODO SIMULAÇÃO (nada será gravado)');

const state = await prisma.$transaction(async (tx) => {
  await tx.$executeRawUnsafe('SET TRANSACTION READ ONLY');
  const pattern = MARKUP.source;
  const dirty = await tx.$queryRaw`
    SELECT id, code, year, name, series FROM "HotWheel" WHERE series ~ ${pattern} ORDER BY year, code`;
  const junk = await tx.hotWheel.findMany({
    where: { code: '75PX', year: 1999, name: { startsWith: '75px' } },
    include: { garageItems: true },
  });
  const knownSeries = await tx.$queryRaw`SELECT DISTINCT year, series FROM "HotWheel" WHERE series IS NOT NULL`;
  return { dirty, junk, knownSeries };
});

const known = new Set(state.knownSeries.map((s) => `${s.year}|${s.series}`));
const changes = [];
const kept = [];

for (const row of state.dirty) {
  if (state.junk.some((j) => j.id === row.id)) continue;
  if (TAG_ONLY.test(row.series)) {
    kept.push(`série é só a etiqueta (vai para a etapa de Treasure Hunts): ${row.year} ${row.code} "${row.series}"`);
    continue;
  }
  const value = cleanSeries(row.series);
  if (!value || MARKUP.test(value)) {
    kept.push(`limpeza não deu um valor limpo: ${row.year} ${row.code} "${row.series}" -> "${value}"`);
    continue;
  }
  // Confirmação: a série principal (antes do " · ") já existe limpa em outro carrinho do mesmo ano
  const main = value.split(' · ')[0];
  changes.push({
    id: row.id,
    code: row.code,
    year: row.year,
    before: { series: row.series },
    after: { series: value },
    confirmadoNoAno: known.has(`${row.year}|${main}`),
  });
}

const blockedJunk = state.junk.filter((j) => j.garageItems.length > 0);

console.log(`\n=== SÉRIES (${changes.length} a corrigir, ${kept.length} mantidas) ===`);
for (const c of changes) {
  console.log(`  ${c.year} ${c.code}: "${c.before.series}"\n      -> "${c.after.series}"${c.confirmadoNoAno ? '' : '   (série não existe limpa em outro carrinho do ano)'}`);
}
kept.forEach((k) => console.log('  mantido:', k));

console.log(`\n=== LIXO DE PARSING A REMOVER (${state.junk.length}) ===`);
for (const j of state.junk) {
  console.log(`  ${j.id} | ${j.code} | ${JSON.stringify(j.name)} | ${j.year} | itens de garagem: ${j.garageItems.length}`);
}

fs.mkdirSync(BACKUP_DIR, { recursive: true });
const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const planFile = `${BACKUP_DIR}/markup-leftovers-${SAVE ? 'save' : 'simulacao'}-${stamp}.json`;
fs.writeFileSync(planFile, JSON.stringify({ createdAt: new Date().toISOString(), changes, kept, junk: state.junk }, null, 2), 'utf8');
console.log(`\nPlano e backup salvos em backend/${planFile}`);

if (!SAVE) {
  console.log('\nSimulação concluída. Rode com --save para gravar.');
  await prisma.$disconnect();
  process.exit(0);
}

if (blockedJunk.length) {
  console.log('\nGravação BLOQUEADA: há registros de lixo com itens de garagem.');
  await prisma.$disconnect();
  process.exit(1);
}

await prisma.$transaction(async (tx) => {
  for (const c of changes) {
    const result = await tx.hotWheel.updateMany({ where: { id: c.id, ...c.before }, data: c.after });
    if (result.count !== 1) throw new Error(`${c.code} (${c.id}) mudou desde a simulação. Nada foi gravado.`);
  }
  for (const j of state.junk) {
    if ((await tx.garageItem.count({ where: { hotWheelId: j.id } })) > 0) throw new Error(`${j.id} ganhou itens de garagem.`);
    await tx.hotWheel.delete({ where: { id: j.id } });
  }
  console.log(`\nSéries corrigidas: ${changes.length}. Registros de lixo removidos: ${state.junk.length}.`);
});
await prisma.$disconnect();
