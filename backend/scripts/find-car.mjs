// Procura no catálogo por código, nome ou franquia.
// Uso: node scripts/find-car.mjs "HKC23"   |   node scripts/find-car.mjs "Batmobile"
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const term = process.argv[2];

if (!term) {
  console.log('Uso: node scripts/find-car.mjs "HKC23" ou "Batmobile"');
  process.exit(1);
}

const results = await prisma.hotWheel.findMany({
  where: {
    OR: [
      { code: { contains: term.toUpperCase().replace(/\s+/g, '') } },
      { name: { contains: term, mode: 'insensitive' } },
      { theme: { contains: term, mode: 'insensitive' } },
    ],
  },
  take: 20,
  orderBy: [{ year: 'desc' }, { code: 'asc' }],
  select: { code: true, name: true, year: true, line: true, theme: true, bodyColor: true },
});

console.table(results);
await prisma.$disconnect();