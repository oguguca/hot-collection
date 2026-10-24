// Aplica ao banco as erratas da Wiki (WIKI_ERRATA em lib/wiki-parser.mjs): registros que vieram da linha
// errada de uma página ganham o valor certo. Cada errata tem a evidência anotada junto.
//   node scripts/fix-wiki-errata.mjs          -> SIMULAÇÃO: só lê, grava o plano e o backup em backups/
//   node scripts/fix-wiki-errata.mjs --save   -> grava (numa única transação)
import fs from 'fs';
import { PrismaClient } from '@prisma/client';
import { WIKI_ERRATA } from './lib/wiki-parser.mjs';

const prisma = new PrismaClient();
const SAVE = process.argv.includes('--save');
const BACKUP_DIR = 'backups';
const pageUrl = (title) => `https://hotwheels.fandom.com/wiki/${encodeURIComponent(title.replace(/ /g, '_'))}`;

console.log(SAVE ? 'MODO GRAVAÇÃO' : 'MODO SIMULAÇÃO (nada será gravado)');

const changes = [];
await prisma.$transaction(async (tx) => {
  await tx.$executeRawUnsafe('SET TRANSACTION READ ONLY');
  for (const e of WIKI_ERRATA) {
    const rows = await tx.hotWheel.findMany({
      where: { sourceUrl: pageUrl(e.page), code: e.toyNumber, name: e.name },
    });
    for (const row of rows) {
      const after = {};
      if (e.fix.toyNumber) Object.assign(after, { code: e.fix.toyNumber, toyNumber: e.fix.toyNumber });
      changes.push({ id: row.id, before: { code: row.code, toyNumber: row.toyNumber }, after, record: row, evidence: e.evidence });
    }
  }
});

for (const c of changes) {
  console.log(`  ${c.record.year} "${c.record.name}" (${c.record.line}): código ${c.before.code} -> ${c.after.code}`);
  console.log(`     evidência: ${c.evidence}`);
}
console.log(`Registros a corrigir: ${changes.length}`);

fs.mkdirSync(BACKUP_DIR, { recursive: true });
const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const planFile = `${BACKUP_DIR}/wiki-errata-${SAVE ? 'save' : 'simulacao'}-${stamp}.json`;
fs.writeFileSync(planFile, JSON.stringify({ createdAt: new Date().toISOString(), changes }, null, 2), 'utf8');
console.log(`Plano e backup salvos em backend/${planFile}`);

if (SAVE && changes.length) {
  await prisma.$transaction(async (tx) => {
    for (const c of changes) {
      const result = await tx.hotWheel.updateMany({ where: { id: c.id, ...c.before }, data: c.after });
      if (result.count !== 1) throw new Error(`${c.id} mudou desde a simulação. Nada foi gravado.`);
    }
  });
  console.log('Gravação concluída.');
}
await prisma.$disconnect();
