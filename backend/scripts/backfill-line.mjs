// Marca como "Mainline" os carrinhos já importados da linha principal.
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const result = await prisma.hotWheel.updateMany({
  where: { line: null, collection: { endsWith: 'Mainline' } },
  data: { line: 'Mainline' },
});

console.log(`Atualizados: ${result.count}`);
await prisma.$disconnect();