import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { SubscriptionService } from '../subscription.service';
import { REQUIRED_FEATURE_KEY } from '../decorators/require-feature.decorator';

@Injectable()
export class PremiumGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly subscriptionService: SubscriptionService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const feature = this.reflector.getAllAndOverride<string>(REQUIRED_FEATURE_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // Rota sem exigência de plano: deixa passar
    if (!feature) return true;

    const userId = context.switchToHttp().getRequest().user?.userId;
    if (!userId) {
      throw new ForbiddenException({ statusCode: 403, message: 'Acesso negado.' });
    }

    const allowed = await this.subscriptionService.hasFeature(userId, feature);
    if (!allowed) {
      throw new ForbiddenException({
        statusCode: 403,
        code: 'PREMIUM_REQUIRED',
        message: 'Esta função é exclusiva do plano Premium.',
      });
    }

    return true;
  }
}