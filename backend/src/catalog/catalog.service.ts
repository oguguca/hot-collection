import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateHotWheelDto } from './dto/create-hotwheel.dto';
import { normalizeCode } from './utils/normalize-code.util';

@Injectable()
export class CatalogService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateHotWheelDto) {
    const normalizedCode = normalizeCode(dto.code);

    const existing = await this.prisma.hotWheel.findUnique({
      where: { code: normalizedCode },
    });

    if (existing) {
      throw new ConflictException('Já existe um Hot Wheels cadastrado com esse código.');
    }

    return this.prisma.hotWheel.create({
      data: { ...dto, code: normalizedCode },
    });
  }

  async findAll() {
    return this.prisma.hotWheel.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }

  async findByCode(code: string) {
    const normalizedCode = normalizeCode(code);

    const hotWheel = await this.prisma.hotWheel.findUnique({
      where: { code: normalizedCode },
    });

    if (!hotWheel) {
      return { found: false, code: normalizedCode };
    }

    return { found: true, data: hotWheel };
  }
}