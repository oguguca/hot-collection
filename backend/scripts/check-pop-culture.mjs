import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const total = await prisma.hotWheel.count({ where: { line: 'Pop Culture' } });
console.log('Total Pop Culture:', total);
console.log('Total geral do catálogo:', await prisma.hotWheel.count());

const byYear = await prisma.hotWheel.groupBy({
  by: ['year'],
  where: { line: 'Pop Culture' },
  _count: true,
  orderBy: { year: 'asc' },
});
console.log('\n--- Por ano ---');
byYear.forEach((r) => console.log(r.year, '->', r._count));

const semTema = await prisma.hotWheel.count({ where: { line: 'Pop Culture', theme: null } });
const semCor = await prisma.hotWheel.count({ where: { line: 'Pop Culture', bodyColor: null } });
console.log('\nSem franquia (theme):', semTema, '| Sem cor:', semCor);

console.log('\n--- Amostra de 2013 (layout mais antigo) ---');
console.table(
  await prisma.hotWheel.findMany({
    where: { line: 'Pop Culture', year: 2013 },
    take: 5,
    select: { code: true, name: true, theme: true, bodyColor: true, series: true },
  }),
);

await prisma.$disconnect();