import { Module } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SubscriptionModule } from '../subscription/subscription.module';
import { AnalysisController } from './analysis.controller';
import { AnalysisService } from './analysis.service';
import { OpenAiClient } from './openai.client';

@Module({
  imports: [SubscriptionModule],
  controllers: [AnalysisController],
  providers: [AnalysisService, OpenAiClient, PrismaService],
})
export class AnalysisModule {}
