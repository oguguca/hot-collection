import { Controller, Get, Post, Body, Param, ParseUUIDPipe, UseGuards } from '@nestjs/common';
import { CatalogService } from './catalog.service';
import { CreateHotWheelDto } from './dto/create-hotwheel.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../auth/guards/admin.guard';

@Controller('hot-wheels')
export class CatalogController {
  constructor(private readonly catalogService: CatalogService) {}

  // Só administradores (ADMIN_EMAILS); usuários comuns não criam carrinhos no catálogo
  @UseGuards(JwtAuthGuard, AdminGuard)
  @Post()
  create(@Body() dto: CreateHotWheelDto) {
    return this.catalogService.create(dto);
  }

  @Get()
  findAll() {
    return this.catalogService.findAll();
  }

  @Get('code/:code')
  findByCode(@Param('code') code: string) {
    return this.catalogService.findByCode(code);
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.catalogService.findOne(id);
  }
}