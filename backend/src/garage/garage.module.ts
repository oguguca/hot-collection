import { Module } from '@nestjs/common';
import { GarageService } from './garage.service';
import { GarageController } from './garage.controller';
import { PrismaService } from '../prisma/prisma.service';

@Module({
  controllers: [GarageController],
  providers: [GarageService, PrismaService],
})
export class GarageModule {}