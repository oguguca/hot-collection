import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const total = await prisma.hotWheel.count();
  console.log('Total no catálogo:', total);

  const byYear = await prisma.hotWheel.groupBy({
    by: ['year'],
    _count: true,
    orderBy: { year: 'asc' },
  });

  console.log('\n--- Por ano ---');
  byYear.forEach((r) => console.log(r.year, '->', r._count, 'modelos'));
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());