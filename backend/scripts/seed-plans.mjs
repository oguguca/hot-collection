// Cadastra (ou atualiza) os planos do Hot Collection.
// Pode ser rodado várias vezes sem duplicar nada.
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const plans = [
  {
    code: 'free',
    name: 'Gratuito',
    description: 'Garagem virtual e busca por código.',
    price: 0,
    features: ['create_account', 'code_search', 'garage'],
  },
  {
    code: 'premium',
    name: 'Premium',
    description: 'Análise do Colecionador com IA.',
    // Valor provisório: o preço real será definido na fase de pagamento.
    price: 14.9,
    features: ['create_account', 'code_search', 'garage', 'rarity_analysis'],
  },
];

async function main() {
  for (const plan of plans) {
    await prisma.subscriptionPlan.upsert({
      where: { code: plan.code },
      update: {
        name: plan.name,
        description: plan.description,
        price: plan.price,
        features: plan.features,
      },
      create: plan,
    });
    console.log(`Plano "${plan.code}" ok`);
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());