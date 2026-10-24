import { Controller, Get, Param, ParseUUIDPipe, Post, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PremiumGuard } from '../subscription/guards/premium.guard';
import { RequireFeature } from '../subscription/decorators/require-feature.decorator';
import { AnalysisService } from './analysis.service';

// Análise do Colecionador: só para quem tem a função rarity_analysis no plano (Premium)
@UseGuards(JwtAuthGuard, PremiumGuard)
@RequireFeature('rarity_analysis')
@Controller('hot-wheels/:id/analysis')
export class AnalysisController {
  constructor(private readonly analysisService: AnalysisService) {}

  // Última análise deste carrinho e quantas restam hoje (não chama a IA)
  @Get()
  latest(@Req() req: any, @Param('id', ParseUUIDPipe) id: string) {
    return this.analysisService.latest(req.user.userId, id);
  }

  // Nova análise: pesquisa o preço atual na web (gasta uma das análises do dia)
  @Post()
  analyze(@Req() req: any, @Param('id', ParseUUIDPipe) id: string) {
    return this.analysisService.analyze(req.user.userId, id);
  }
}
