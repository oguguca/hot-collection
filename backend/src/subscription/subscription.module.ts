import { Module } from '@nestjs/common';
import { SubscriptionService } from './subscription.service';
import { SubscriptionController } from './subscription.controller';
import { PremiumGuard } from './guards/premium.guard';
import { PrismaService } from '../prisma/prisma.service';

@Module({
  controllers: [SubscriptionController],
  providers: [SubscriptionService, PremiumGuard, PrismaService],
  exports: [SubscriptionService, PremiumGuard],
})
export class SubscriptionModule {}