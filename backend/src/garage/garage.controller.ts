import { Controller, Get, Post, Delete, Body, Param, UseGuards, Req } from '@nestjs/common';
import { GarageService } from './garage.service';
import { AddToGarageDto } from './dto/add-to-garage.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('my-garage')
export class GarageController {
  constructor(private readonly garageService: GarageService) {}

  @Post()
  add(@Req() req: any, @Body() dto: AddToGarageDto) {
    return this.garageService.addToGarage(req.user.userId, dto);
  }

  @Get()
  findMine(@Req() req: any) {
    return this.garageService.findMyGarage(req.user.userId);
  }

  @Delete(':id')
  remove(@Req() req: any, @Param('id') id: string) {
    return this.garageService.removeFromGarage(req.user.userId, id);
  }
}