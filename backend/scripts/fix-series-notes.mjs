// Séries gravadas com anotação ("HW Race Team · Kmart Exclusive"): a série fica só com a 1ª parte e as
// anotações viram etiquetas, pela mesma regra do importador (tagsFromSeriesNotes).
//   node scripts/fix-series-notes.mjs          -> SIMULAÇÃO: só lê, grava o plano e o backup em backups/
//   node scripts/fix-series-notes.mjs --save   -> grava (numa única transação)
import fs from 'fs';
import { PrismaClient } from '@prisma/client';
import { tagsFromSeriesNotes } from './lib/wiki-parser.mjs';

const prisma = new PrismaClient();
const SAVE = process.argv.includes('--save');
const BACKUP_DIR = 'backups';

console.log(SAVE ? 'MODO GRAVAÇÃO' : 'MODO SIMULAÇÃO (nada será gravado)');

const rows = await prisma.$transaction(async (tx) => {
  await tx.$executeRawUnsafe('SET TRANSACTION READ ONLY');
  return tx.hotWheel.findMany({ where: { series: { contains: ' · ' } }, select: { id: true, code: true, year: true, series: true, tags: true } });
});

const changes = rows.map((r) => {
  const [series, ...notes] = r.series.split(' · ').map((s) => s.trim());
  const tags = [...new Set([...r.tags, ...tagsFromSeriesNotes(notes)])];
  return { id: r.id, code: r.code, year: r.year, before: { series: r.series, tags: r.tags }, after: { series, tags } };
});
changes.forEach((c) => console.log(`  ${c.year} ${c.code}: "${c.before.series}" -> série "${c.after.series}", etiquetas [${c.after.tags.join(', ')}]`));
console.log(`Registros: ${changes.length}`);

fs.mkdirSync(BACKUP_DIR, { recursive: true });
const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const planFile = `${BACKUP_DIR}/series-notes-${SAVE ? 'save' : 'simulacao'}-${stamp}.json`;
fs.writeFileSync(planFile, JSON.stringify({ createdAt: new Date().toISOString(), changes }, null, 2), 'utf8');
console.log(`Plano e backup salvos em backend/${planFile}`);

if (SAVE && changes.length) {
  await prisma.$transaction(async (tx) => {
    for (const c of changes) {
      const now = await tx.hotWheel.findUnique({ where: { id: c.id }, select: { series: true, tags: true } });
      if (!now || now.series !== c.before.series || JSON.stringify(now.tags) !== JSON.stringify(c.before.tags)) {
        throw new Error(`${c.code} (${c.id}) mudou desde a simulação. Nada foi gravado.`);
      }
      await tx.hotWheel.update({ where: { id: c.id }, data: c.after });
    }
  });
  console.log('Gravação concluída.');
}
await prisma.$disconnect();
