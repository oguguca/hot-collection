import { IsString, IsOptional, IsInt, IsBoolean, Min } from 'class-validator';

export class AddToGarageDto {
  @IsString()
  hotWheelCode: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  quantity?: number;

  @IsOptional()
  @IsBoolean()
  favorite?: boolean;

  @IsOptional()
  @IsString()
  notes?: string;
}