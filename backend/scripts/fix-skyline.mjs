// Transfere os itens de garagem do Skyline de teste (HYY04-N7C6, criado à mão) para o
// registro real da Wiki (HYY04) e depois remove o registro de teste.
//   node scripts/fix-skyline.mjs          -> SIMULAÇÃO: só lê o banco e grava o backup JSON
//   node scripts/fix-skyline.mjs --save   -> grava (numa única transação; desfaz tudo se algo não bater)
import fs from 'fs';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const SAVE = process.argv.includes('--save');
const FAKE_CODE = 'HYY04-N7C6';
const REAL_CODE = 'HYY04';
const NAME = 'Nissan Skyline GT-R (BCNR33)';
const BACKUP_DIR = 'backups';

const mask = (id) => `${id.slice(0, 4)}…`;

// Lê o estado atual e verifica se a transferência é segura
async function plan(tx) {
  const fakes = await tx.hotWheel.findMany({ where: { code: FAKE_CODE } });
  const reals = await tx.hotWheel.findMany({ where: { code: REAL_CODE, name: NAME } });
  const problems = [];

  if (fakes.length !== 1) problems.push(`esperava 1 registro ${FAKE_CODE}, achei ${fakes.length}`);
  if (reals.length !== 1) problems.push(`esperava 1 registro ${REAL_CODE} "${NAME}", achei ${reals.length}`);
  if (problems.length) return { problems };

  const [fake, real] = [fakes[0], reals[0]];
  if (fake.source !== null) problems.push('o registro de teste tem fonte preenchida; não parece ser o de teste');
  if (!real.source || !real.sourceUrl) problems.push('o registro real não tem fonte da Wiki');
  if (fake.name !== real.name || fake.year !== real.year) problems.push('nome ou ano diferentes entre os dois registros');

  const fakeItems = await tx.garageItem.findMany({ where: { hotWheelId: fake.id } });
  const realItems = await tx.garageItem.findMany({ where: { hotWheelId: real.id } });
  const garageTotal = await tx.garageItem.count();

  // Um usuário que já tenha o carro real ficaria com dois itens do mesmo carrinho (proibido pelo schema)
  const realUsers = new Set(realItems.map((i) => i.userId));
  const conflicts = fakeItems.filter((i) => realUsers.has(i.userId));
  if (conflicts.length) problems.push(`${conflicts.length} usuário(s) já têm o carro real na garagem`);

  return { fake, real, fakeItems, realItems, garageTotal, problems };
}

console.log(SAVE ? 'MODO GRAVAÇÃO' : 'MODO SIMULAÇÃO (nada será gravado)');

const state = await prisma.$transaction(async (tx) => {
  await tx.$executeRawUnsafe('SET TRANSACTION READ ONLY');
  return plan(tx);
});

if (state.problems.length) {
  console.log('\nTransferência BLOQUEADA:');
  state.problems.forEach((p) => console.log(' -', p));
  await prisma.$disconnect();
  process.exit(1);
}

const { fake, real, fakeItems, realItems, garageTotal } = state;

console.log(`\nRegistro de teste: ${fake.id} | ${fake.code} | ${fake.name} | linha ${fake.line ?? '-'} | fonte ${fake.source ?? '-'}`);
console.log(`Registro real:     ${real.id} | ${real.code} | ${real.name} | ${real.line} ${real.year} | ${real.sourceUrl}`);
console.log(`\nItens a transferir (${fakeItems.length}); id, quantidade, favorito, notas e data são mantidos:`);
for (const i of fakeItems) {
  console.log(`  ${i.id} | usuário ${mask(i.userId)} | qtd ${i.quantity} | favorito ${i.favorite} | notas ${i.notes ? 'sim' : 'não'} | ${i.addedAt.toISOString()}`);
}
console.log(`Itens que já apontam para o registro real: ${realItems.length}`);
console.log(`Conflitos (usuário já tem o carro real): 0`);
console.log(`Itens na garagem (todos os usuários): ${garageTotal} antes e ${garageTotal} depois`);
console.log(`Outras tabelas ligadas ao HotWheel: nenhuma (só GarageItem no schema)`);

// Backup de tudo que a gravação toca
fs.mkdirSync(BACKUP_DIR, { recursive: true });
const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const backupFile = `${BACKUP_DIR}/skyline-${SAVE ? 'save' : 'simulacao'}-${stamp}.json`;
fs.writeFileSync(
  backupFile,
  JSON.stringify({ createdAt: new Date().toISOString(), fake, real, fakeItems, realItems, garageTotal }, null, 2),
  'utf8',
);
console.log(`\nBackup salvo em backend/${backupFile}`);

if (!SAVE) {
  console.log('\nSimulação concluída. Rode com --save para gravar.');
  await prisma.$disconnect();
  process.exit(0);
}

await prisma.$transaction(async (tx) => {
  // Confere de novo dentro da transação: se algo mudou desde a leitura, nada é gravado
  const now = await plan(tx);
  if (now.problems.length) throw new Error(`Estado mudou: ${now.problems.join('; ')}`);
  const sameItems =
    now.fakeItems.length === fakeItems.length &&
    now.fakeItems.every((i) => fakeItems.some((b) => b.id === i.id)) &&
    now.garageTotal === garageTotal;
  if (!sameItems) throw new Error('Os itens de garagem mudaram desde a simulação.');

  const moved = await tx.garageItem.updateMany({
    where: { hotWheelId: fake.id },
    data: { hotWheelId: real.id },
  });
  await tx.hotWheel.delete({ where: { id: fake.id } });

  const afterReal = await tx.garageItem.count({ where: { hotWheelId: real.id } });
  const afterTotal = await tx.garageItem.count();
  const fakeLeft = await tx.hotWheel.count({ where: { code: FAKE_CODE } });
  if (moved.count !== fakeItems.length || afterReal !== realItems.length + fakeItems.length || afterTotal !== garageTotal || fakeLeft !== 0) {
    throw new Error('Verificação final falhou; a transação foi desfeita.');
  }
  console.log(`\nTransferidos: ${moved.count} itens. Registro de teste removido. Itens na garagem: ${afterTotal}.`);
});

await prisma.$disconnect();
