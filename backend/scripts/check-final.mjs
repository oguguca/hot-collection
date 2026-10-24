import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

console.log('Total no catálogo:', await prisma.hotWheel.count());

const byLine = await prisma.hotWheel.groupBy({ by: ['line'], _count: true });
byLine.sort((a, b) => b._count - a._count);
console.log('\n--- Por linha (15 maiores) ---');
byLine.slice(0, 15).forEach((r) => console.log(r.line ?? '(sem linha)', '->', r._count));

const tags = await prisma.$queryRaw`
  SELECT tag, COUNT(*)::int AS total
  FROM "HotWheel", unnest("tags") AS tag
  GROUP BY tag ORDER BY total DESC`;
console.log('\n--- Etiquetas ---');
tags.forEach((r) => console.log(r.tag, '->', r.total));

const shared = await prisma.$queryRaw`
  SELECT COUNT(*)::int AS total
  FROM (SELECT "code" FROM "HotWheel" GROUP BY "code" HAVING COUNT(*) > 1) t`;
console.log('\nCódigos usados por mais de um carrinho:', shared[0].total);

await prisma.$disconnect();