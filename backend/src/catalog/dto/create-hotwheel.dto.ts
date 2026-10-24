import { IsInt, IsOptional, IsString, Min } from 'class-validator';

export class CreateHotWheelDto {
  @IsString()
  code: string;

  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  toyNumber?: string;

  @IsOptional()
  @IsString()
  model?: string;

  @IsOptional()
  @IsString()
  manufacturer?: string;

  @IsOptional()
  @IsInt()
  year?: number;

  @IsOptional()
  @IsString()
  series?: string;

  @IsOptional()
  @IsString()
  collection?: string;

  @IsOptional()
  @IsString()
  collectionNumber?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  collectionTotal?: number;

  @IsOptional()
  @IsString()
  seriesNumber?: string;

  @IsOptional()
  @IsString()
  imageUrl?: string;

  @IsOptional()
  @IsString()
  packagingImageUrl?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  variation?: string;
}