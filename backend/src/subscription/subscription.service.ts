import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class SubscriptionService {
  constructor(private readonly prisma: PrismaService) {}

  // Assinatura ativa e ainda dentro do prazo (sem prazo = não expira)
  private findActiveSubscription(userId: string) {
    return this.prisma.subscription.findFirst({
      where: {
        userId,
        status: 'ACTIVE',
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
      include: { plan: true },
      orderBy: { startedAt: 'desc' },
    });
  }

  async getPlanInfo(userId: string) {
    const subscription = await this.findActiveSubscription(userId);

    // Sem assinatura ativa, o usuário está no plano gratuito
    const plan =
      subscription?.plan ??
      (await this.prisma.subscriptionPlan.findUnique({ where: { code: 'free' } }));

    if (!plan) {
      throw new NotFoundException('Plano gratuito não cadastrado. Rode o seed dos planos.');
    }

    const features = Array.isArray(plan.features) ? (plan.features as string[]) : [];

    return {
      plan: plan.code,
      planName: plan.name,
      isPremium: plan.code === 'premium',
      features,
      expiresAt: subscription?.expiresAt ?? null,
    };
  }

  async hasFeature(userId: string, feature: string) {
    const info = await this.getPlanInfo(userId);
    return info.features.includes(feature);
  }

  // Só para testes, enquanto não existe pagamento real (Fase 18)
  async setPlanForTesting(userId: string, planCode: 'free' | 'premium') {
    await this.prisma.$transaction(async (tx) => {
      await tx.subscription.updateMany({
        where: { userId, status: 'ACTIVE' },
        data: { status: 'CANCELED' },
      });

      if (planCode === 'premium') {
        const plan = await tx.subscriptionPlan.findUnique({ where: { code: 'premium' } });
        if (!plan) {
          throw new NotFoundException('Plano premium não cadastrado.');
        }
        await tx.subscription.create({
          data: { userId, planId: plan.id, provider: 'dev' },
        });
      }
    });

    return this.getPlanInfo(userId);
  }
}