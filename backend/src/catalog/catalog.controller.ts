import { Controller, Get, Post, Body, Param, UseGuards } from '@nestjs/common';
import { CatalogService } from './catalog.service';
import { CreateHotWheelDto } from './dto/create-hotwheel.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('hot-wheels')
export class CatalogController {
  constructor(private readonly catalogService: CatalogService) {}

  @UseGuards(JwtAuthGuard)
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
}