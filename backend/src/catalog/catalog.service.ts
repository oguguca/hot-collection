import { Injectable, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateHotWheelDto } from './dto/create-hotwheel.dto';
import { normalizeCode } from './utils/normalize-code.util';

@Injectable()
export class CatalogService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateHotWheelDto) {
    const normalizedCode = normalizeCode(dto.code);

    // O mesmo código pode existir para carrinhos diferentes; só bloqueamos o mesmo código com o mesmo nome
    const existing = await this.prisma.hotWheel.findFirst({
      where: {
        code: normalizedCode,
        name: { equals: dto.name, mode: 'insensitive' },
      },
    });

    if (existing) {
      throw new ConflictException('Esse Hot Wheels já está cadastrado com esse código.');
    }

    return this.prisma.hotWheel.create({
      data: { ...dto, code: normalizedCode },
    });
  }

  // Limitado a 100 para não devolver o catálogo inteiro de uma vez
  async findAll() {
    return this.prisma.hotWheel.findMany({
      take: 100,
      orderBy: { createdAt: 'desc' },
    });
  }

  async findByCode(code: string) {
    const normalizedCode = normalizeCode(code);

    const items = await this.prisma.hotWheel.findMany({
      where: { code: normalizedCode },
      orderBy: [{ year: 'desc' }, { name: 'asc' }],
    });

    return {
      found: items.length > 0,
      code: normalizedCode,
      count: items.length,
      items,
    };
  }
}