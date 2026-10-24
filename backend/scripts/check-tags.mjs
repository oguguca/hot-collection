import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const row = await prisma.hotWheel.findFirst({ select: { code: true, tags: true } });
console.log('Coluna tags OK. Exemplo:', row);
console.log('Carrinhos no banco:', await prisma.hotWheel.count());

await prisma.$disconnect();