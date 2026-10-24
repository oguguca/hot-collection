import {
  ConflictException,
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import type { AiAnalysis, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ANALYSIS_INSTRUCTIONS, buildFacts } from './analysis.prompt';
import { extractSources, parseAnalysis } from './analysis.parser';
import { AiError, OpenAiClient } from './openai.client';

const DAY_MS = 24 * 60 * 60 * 1000;
// Uma análise "pendente" mais velha que isso é considerada travada e não bloqueia uma nova
const PENDING_STALE_MS = 3 * 60 * 1000;

export const dailyLimit = () => {
  const value = parseInt(process.env.AI_ANALYSIS_DAILY_LIMIT ?? '', 10);
  return Number.isFinite(value) && value > 0 ? value : 5;
};

const ERROR_MESSAGES: Record<string, string> = {
  AI_UNAVAILABLE: 'A análise está temporariamente indisponível. Tente mais tarde.',
  AI_BUSY: 'Muitas análises ao mesmo tempo. Tente de novo em instantes.',
  AI_TIMEOUT: 'A pesquisa demorou demais. Tente de novo.',
  AI_ERROR: 'Não foi possível concluir a análise. Tente de novo.',
  AI_INVALID: 'A análise voltou num formato inesperado. Tente de novo.',
};

export type Quota = { limit: number; used: number; remaining: number; resetsAt: string | null };

@Injectable()
export class AnalysisService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly openai: OpenAiClient,
  ) {}

  // Análises que contam no limite: as concluídas e as em andamento (erros não contam)
  async quota(userId: string, now = new Date()): Promise<Quota> {
    const limit = dailyLimit();
    const since = new Date(now.getTime() - DAY_MS);
    const counted = await this.prisma.aiAnalysis.findMany({
      where: { userId, createdAt: { gte: since }, status: { in: ['ok', 'pending'] } },
      select: { createdAt: true },
      orderBy: { createdAt: 'asc' },
    });
    const used = counted.length;
    return {
      limit,
      used,
      remaining: Math.max(0, limit - used),
      // A vaga mais antiga volta 24h depois de usada
      resetsAt: used >= limit ? new Date(counted[0].createdAt.getTime() + DAY_MS).toISOString() : null,
    };
  }

  // Última análise concluída deste carrinho para este usuário (sem custo)
  async latest(userId: string, hotWheelId: string) {
    await this.ensureHotWheel(hotWheelId);
    const last = await this.prisma.aiAnalysis.findFirst({
      where: { userId, hotWheelId, status: 'ok' },
      orderBy: { createdAt: 'desc' },
    });
    return { analysis: last ? this.present(last) : null, quota: await this.quota(userId) };
  }

  async analyze(userId: string, hotWheelId: string) {
    const hotWheel = await this.ensureHotWheel(hotWheelId);

    const pending = await this.prisma.aiAnalysis.findFirst({
      where: { userId, status: 'pending', createdAt: { gte: new Date(Date.now() - PENDING_STALE_MS) } },
    });
    if (pending) {
      throw new ConflictException({ code: 'ANALYSIS_IN_PROGRESS', message: 'Já existe uma análise em andamento. Aguarde terminar.' });
    }

    const quota = await this.quota(userId);
    if (quota.remaining <= 0) {
      throw new HttpException(
        {
          code: 'DAILY_LIMIT',
          message: `Você usou as ${quota.limit} análises das últimas 24 horas.`,
          quota,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    // Reserva a vaga antes de chamar a IA (evita dois cliques gastarem duas vezes)
    const record = await this.prisma.aiAnalysis.create({
      data: { userId, hotWheelId, status: 'pending', model: this.openai.model },
    });

    try {
      const reply = await this.openai.searchAndAnswer(ANALYSIS_INSTRUCTIONS, JSON.stringify(buildFacts(hotWheel)));
      const result = parseAnalysis(reply.text);
      const usage = { searches: reply.searches, inputTokens: reply.inputTokens, outputTokens: reply.outputTokens };
      if (!result) {
        await this.prisma.aiAnalysis.update({
          where: { id: record.id },
          data: { status: 'error', error: 'AI_INVALID', ...usage },
        });
        throw new ServiceUnavailableException({ code: 'AI_INVALID', message: ERROR_MESSAGES.AI_INVALID });
      }
      const saved = await this.prisma.aiAnalysis.update({
        where: { id: record.id },
        data: {
          status: 'ok',
          result: result as unknown as Prisma.InputJsonValue,
          sources: extractSources(reply.annotations) as unknown as Prisma.InputJsonValue,
          ...usage,
        },
      });
      return { analysis: this.present(saved), quota: await this.quota(userId) };
    } catch (error) {
      if (error instanceof AiError) {
        await this.prisma.aiAnalysis.update({
          where: { id: record.id },
          data: { status: 'error', error: `${error.code}: ${error.detail}`.slice(0, 300) },
        });
        throw new ServiceUnavailableException({ code: error.code, message: ERROR_MESSAGES[error.code] });
      }
      if (error instanceof HttpException) throw error;
      await this.prisma.aiAnalysis.update({
        where: { id: record.id },
        data: { status: 'error', error: `inesperado: ${(error as Error).message}`.slice(0, 300) },
      });
      throw new ServiceUnavailableException({ code: 'AI_ERROR', message: ERROR_MESSAGES.AI_ERROR });
    }
  }

  private async ensureHotWheel(id: string) {
    const hotWheel = await this.prisma.hotWheel.findUnique({ where: { id } });
    if (!hotWheel) throw new NotFoundException('Hot Wheels não encontrado no catálogo.');
    return hotWheel;
  }

  // O que o app recebe (sem dados internos de consumo)
  private present(a: AiAnalysis) {
    return { id: a.id, createdAt: a.createdAt.toISOString(), result: a.result, sources: a.sources ?? [] };
  }
}
