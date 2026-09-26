import { Controller, Get } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async check() {
    const record = await this.prisma.healthCheck.create({
      data: { status: 'ok' },
    });

    const count = await this.prisma.healthCheck.count();

    return {
      status: 'ok',
      database: 'connected',
      totalChecks: count,
      lastCheck: record.createdAt,
    };
  }
}