import { Body, Controller, ForbiddenException, Get, Post, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { SubscriptionService } from './subscription.service';
import { DevActivateDto } from './dto/dev-activate.dto';

@UseGuards(JwtAuthGuard)
@Controller('subscription')
export class SubscriptionController {
  constructor(private readonly subscriptionService: SubscriptionService) {}

  // O app usa esta rota para saber o plano do usuário
  @Get('me')
  me(@Req() req: any) {
    return this.subscriptionService.getPlanInfo(req.user.userId);
  }

  // Só funciona com ALLOW_DEV_SUBSCRIPTION="true" no .env. Nunca ligar em produção.
  @Post('dev-activate')
  devActivate(@Req() req: any, @Body() dto: DevActivateDto) {
    if (process.env.ALLOW_DEV_SUBSCRIPTION !== 'true') {
      throw new ForbiddenException('Rota de teste desativada.');
    }
    return this.subscriptionService.setPlanForTesting(req.user.userId, dto.planCode);
  }
}