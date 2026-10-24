import { Injectable, ConflictException, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateHotWheelDto } from './dto/create-hotwheel.dto';
import { normalizeCode } from './utils/normalize-code.util';
import { splitCollectionNumber } from './utils/collection-number.util';

// "120/365" no número vira número 120 + total 365; o total nunca fica embutido no texto
export function normalizeCollection(dto: Pick<CreateHotWheelDto, 'collectionNumber' | 'collectionTotal'>) {
  const { number, total } = splitCollectionNumber(dto.collectionNumber);
  if (total && dto.collectionTotal && total !== dto.collectionTotal) {
    throw new BadRequestException('O total do número de coleção não confere com collectionTotal.');
  }
  const collectionTotal = dto.collectionTotal ?? total ?? null;
  if (collectionTotal && /^\d+$/.test(number ?? '') && parseInt(number!, 10) > collectionTotal) {
    throw new BadRequestException('O número de coleção é maior que o total.');
  }
  return { collectionNumber: number, collectionTotal };
}

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
      data: { ...dto, code: normalizedCode, ...normalizeCollection(dto) },
    });
  }

  // Limitado a 100 para não devolver o catálogo inteiro de uma vez
  async findAll() {
    return this.prisma.hotWheel.findMany({
      take: 100,
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const hotWheel = await this.prisma.hotWheel.findUnique({ where: { id } });
    if (!hotWheel) throw new NotFoundException('Hot Wheels não encontrado no catálogo.');
    return hotWheel;
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