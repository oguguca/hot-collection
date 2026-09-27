import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AddToGarageDto } from './dto/add-to-garage.dto';
import { normalizeCode } from '../catalog/utils/normalize-code.util';

@Injectable()
export class GarageService {
  constructor(private readonly prisma: PrismaService) {}

  async addToGarage(userId: string, dto: AddToGarageDto) {
    const normalizedCode = normalizeCode(dto.hotWheelCode);

    const hotWheel = await this.prisma.hotWheel.findUnique({
      where: { code: normalizedCode },
    });

    if (!hotWheel) {
      throw new NotFoundException('Hot Wheels não encontrado no catálogo.');
    }

    const existingItem = await this.prisma.garageItem.findUnique({
      where: {
        userId_hotWheelId: {
          userId,
          hotWheelId: hotWheel.id,
        },
      },
    });

    if (existingItem) {
      return this.prisma.garageItem.update({
        where: { id: existingItem.id },
        data: {
          quantity: existingItem.quantity + (dto.quantity ?? 1),
          favorite: dto.favorite ?? existingItem.favorite,
          notes: dto.notes ?? existingItem.notes,
        },
        include: { hotWheel: true },
      });
    }

    return this.prisma.garageItem.create({
      data: {
        userId,
        hotWheelId: hotWheel.id,
        quantity: dto.quantity ?? 1,
        favorite: dto.favorite ?? false,
        notes: dto.notes,
      },
      include: { hotWheel: true },
    });
  }

  async findMyGarage(userId: string) {
    return this.prisma.garageItem.findMany({
      where: { userId },
      include: { hotWheel: true },
      orderBy: { addedAt: 'desc' },
    });
  }

  async removeFromGarage(userId: string, garageItemId: string) {
    const item = await this.prisma.garageItem.findUnique({
      where: { id: garageItemId },
    });

    if (!item) {
      throw new NotFoundException('Item não encontrado na garagem.');
    }

    if (item.userId !== userId) {
      throw new ForbiddenException('Você não tem permissão para remover este item.');
    }

    await this.prisma.garageItem.delete({
      where: { id: garageItemId },
    });

    return { removed: true };
  }
}