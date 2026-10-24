import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { AdminGuard, isAdminEmail } from './admin.guard';

const contextFor = (user?: { email?: string }) =>
  ({ switchToHttp: () => ({ getRequest: () => ({ user }) }) }) as unknown as ExecutionContext;

describe('isAdminEmail', () => {
  it('sem ADMIN_EMAILS ninguém é administrador', () => {
    expect(isAdminEmail('a@b.com', undefined)).toBe(false);
    expect(isAdminEmail('a@b.com', '')).toBe(false);
  });

  it('aceita e-mails da lista, sem diferenciar maiúsculas e espaços', () => {
    expect(isAdminEmail('Admin@Site.com', ' admin@site.com , outro@site.com')).toBe(true);
    expect(isAdminEmail('outro@site.com', 'admin@site.com,outro@site.com')).toBe(true);
  });

  it('recusa e-mail fora da lista ou ausente', () => {
    expect(isAdminEmail('intruso@site.com', 'admin@site.com')).toBe(false);
    expect(isAdminEmail(undefined, 'admin@site.com')).toBe(false);
  });
});

describe('AdminGuard', () => {
  const original = process.env.ADMIN_EMAILS;
  afterEach(() => {
    process.env.ADMIN_EMAILS = original;
  });

  it('libera administrador', () => {
    process.env.ADMIN_EMAILS = 'admin@site.com';
    expect(new AdminGuard().canActivate(contextFor({ email: 'admin@site.com' }))).toBe(true);
  });

  it('bloqueia usuário comum e requisição sem usuário', () => {
    process.env.ADMIN_EMAILS = 'admin@site.com';
    expect(() => new AdminGuard().canActivate(contextFor({ email: 'user@site.com' }))).toThrow(ForbiddenException);
    expect(() => new AdminGuard().canActivate(contextFor())).toThrow(ForbiddenException);
  });

  it('bloqueia todos quando ADMIN_EMAILS não está definido', () => {
    delete process.env.ADMIN_EMAILS;
    expect(() => new AdminGuard().canActivate(contextFor({ email: 'admin@site.com' }))).toThrow(ForbiddenException);
  });
});
