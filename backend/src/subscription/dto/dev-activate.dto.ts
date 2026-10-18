import { IsIn } from 'class-validator';

export class DevActivateDto {
  @IsIn(['free', 'premium'])
  planCode: 'free' | 'premium';
}