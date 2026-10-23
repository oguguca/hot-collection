import { IsString, IsOptional, IsInt, IsBoolean, IsUUID, Min } from 'class-validator';

export class AddToGarageDto {
  @IsUUID()
  hotWheelId: string;

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