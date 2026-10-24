import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';

// Libera a rota só para os e-mails listados em ADMIN_EMAILS (separados por vírgula).
// Sem a variável, ninguém passa: rotas de administração ficam fechadas por padrão.
export function isAdminEmail(email: string | undefined, adminEmails = process.env.ADMIN_EMAILS) {
  if (!email || !adminEmails) return false;
  const allowed = adminEmails
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return allowed.includes(email.trim().toLowerCase());
}

// Usar depois do JwtAuthGuard, que coloca { userId, email } em req.user
@Injectable()
export class AdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    if (!isAdminEmail(request.user?.email)) {
      throw new ForbiddenException('Apenas administradores podem alterar o catálogo.');
    }
    return true;
  }
}
