// Funde registros de linhas de subconjunto (Mystery Models, First Editions, New Models...) que repetem um
// carrinho da linha pai (SUBSET_RULES em lib/wiki-parser.mjs). O registro da linha pai fica, com a etiqueta
// do subconjunto; itens de garagem passam para ele. Variantes próprias (parent null, ex: ZAMAC) não entram.
//   node scripts/fix-subset-duplicates.mjs          -> SIMULAÇÃO: só lê, grava o plano e o backup em backups/
//   node scripts/fix-subset-duplicates.mjs --save   -> grava (numa única transação; desfaz tudo se algo não bater)
import fs from 'fs';
import { PrismaClient } from '@prisma/client';
import { SUBSET_RULES, subsetOf, sameCar } from './lib/wiki-parser.mjs';

const prisma = new PrismaClient();
const SAVE = process.argv.includes('--save');
const BACKUP_DIR = 'backups';
const STH = 'Super Treasure Hunt';
// Treasure Hunts tem regras próprias (fix-treasure-hunts.mjs)
const RULES = SUBSET_RULES.filter((r) => typeof r.parent === 'string' && r.parent !== '*');

console.log(SAVE ? 'MODO GRAVAÇÃO' : 'MODO SIMULAÇÃO (nada será gravado)');

const rows = await prisma.$transaction(async (tx) => {
  await tx.$executeRawUnsafe('SET TRANSACTION READ ONLY');
  return tx.hotWheel.findMany({ include: { garageItems: true } });
});

const byCode = new Map();
for (const r of rows) {
  if (!byCode.has(r.code)) byCode.set(r.code, []);
  byCode.get(r.code).push(r);
}

const merges = [];
const manual = [];
for (const r of rows) {
  const rule = subsetOf(r.line);
  if (!rule || !RULES.includes(rule)) continue;
  const twins = byCode
    .get(r.code)
    .filter((o) => o.id !== r.id && o.line === rule.parent && o.variation !== STH && sameCar(o.name, r.name));
  if (twins.length === 0) continue; // carrinho só do subconjunto: registro próprio, está certo
  if (twins.length > 1) {
    manual.push(`${r.line} ${r.year} ${r.code} "${r.name}" -> ${twins.length} registros possíveis na linha ${rule.parent}`);
    continue;
  }
  const into = twins[0];
  const intoUsers = new Set(into.garageItems.map((g) => g.userId));
  const tags = [...new Set([...into.tags, ...r.tags, ...(rule.tag ? [rule.tag] : [])])];
  merges.push({
    from: r.id,
    into: into.id,
    reason: `${r.line} ${r.year} ${r.code} "${r.name}" -> ${into.line} ${into.year} "${into.name}"`,
    tagsBefore: into.tags,
    tagsAfter: tags,
    fromRecord: { ...r, garageItems: undefined },
    garageItems: r.garageItems,
    conflicts: r.garageItems.filter((g) => intoUsers.has(g.userId)).length,
  });
}

console.log(`\nFusões: ${merges.length} | decisão manual: ${manual.length}`);
merges.forEach((m) => console.log(`  ${m.reason}\n     etiquetas: [${m.tagsBefore.join(', ')}] -> [${m.tagsAfter.join(', ')}] | garagem: ${m.garageItems.length} | conflitos: ${m.conflicts}`));
manual.forEach((m) => console.log('  manual:', m));

fs.mkdirSync(BACKUP_DIR, { recursive: true });
const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const planFile = `${BACKUP_DIR}/subset-duplicates-${SAVE ? 'save' : 'simulacao'}-${stamp}.json`;
fs.writeFileSync(planFile, JSON.stringify({ createdAt: new Date().toISOString(), merges, manual }, null, 2), 'utf8');
console.log(`\nPlano e backup salvos em backend/${planFile}`);

if (!SAVE) {
  console.log('\nSimulação concluída. Rode com --save para gravar.');
  await prisma.$disconnect();
  process.exit(0);
}
if (merges.some((m) => m.conflicts > 0)) {
  console.log('\nGravação BLOQUEADA: fusão com usuário que já tem o outro registro na garagem.');
  await prisma.$disconnect();
  process.exit(1);
}

await prisma.$transaction(async (tx) => {
  for (const m of merges) {
    const into = await tx.hotWheel.findUnique({ where: { id: m.into }, select: { tags: true } });
    const from = await tx.hotWheel.findUnique({ where: { id: m.from }, include: { garageItems: true } });
    if (!into || !from || JSON.stringify(into.tags) !== JSON.stringify(m.tagsBefore) || from.garageItems.length !== m.garageItems.length) {
      throw new Error(`${m.reason}: mudou desde a simulação. Nada foi gravado.`);
    }
    await tx.garageItem.updateMany({ where: { hotWheelId: m.from }, data: { hotWheelId: m.into } });
    await tx.hotWheel.update({ where: { id: m.into }, data: { tags: m.tagsAfter } });
    await tx.hotWheel.delete({ where: { id: m.from } });
  }
  console.log(`\nFusões gravadas: ${merges.length}`);
});
await prisma.$disconnect();
