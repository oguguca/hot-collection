import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaService } from './prisma/prisma.service';
import { HealthController } from './health/health.controller';
import { AuthModule } from './auth/auth.module';
import { CatalogModule } from './catalog/catalog.module';
import { GarageModule } from './garage/garage.module';
import { SubscriptionModule } from './subscription/subscription.module';

@Module({
  imports: [AuthModule, CatalogModule, GarageModule, SubscriptionModule],
  controllers: [AppController, HealthController],
  providers: [AppService, PrismaService],
})
export class AppModule {}