import { Controller, Post, Body, UseGuards, Get, Req, Res } from '@nestjs/common';
import type { Response } from 'express';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { GoogleAuthGuard } from './guards/google-auth.guard';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Post('login')
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

    @UseGuards(JwtAuthGuard)
  @Get('me')
  getProfile(@Req() req: any) {
    return this.authService.getProfile(req.user.userId);
  }

  @UseGuards(GoogleAuthGuard)
  @Get('google')
  googleAuth() {
    // Fica vazio de propósito: o Guard redireciona para a tela de login do Google.
  }

  @UseGuards(GoogleAuthGuard)
  @Get('google/callback')
  async googleAuthCallback(@Req() req: any, @Res() res: Response) {
    const result = await this.authService.validateGoogleUser(req.user);

    // Só aceitamos endereços de retorno de apps (evita redirecionar para sites de terceiros)
    const state = typeof req.query.state === 'string' ? req.query.state : '';
    const allowed = /^(exp|exps|hotcollectionapp):\/\/[A-Za-z0-9\-._~:/?#[\]@!$&'()*+,;=%]*$/;
    const baseUrl = allowed.test(state) ? state : 'hotcollectionapp://auth-callback';
    const separator = baseUrl.includes('?') ? '&' : '?';

    const redirectUrl =
      `${baseUrl}${separator}accessToken=${encodeURIComponent(result.accessToken)}` +
      `&userId=${encodeURIComponent(result.user.id)}` +
      `&email=${encodeURIComponent(result.user.email)}` +
      `&name=${encodeURIComponent(result.user.name ?? '')}`;

    res.send(`
      <html>
        <body style="background:#0A0A0B; display:flex; flex-direction:column; align-items:center; justify-content:center; height:100vh; margin:0; font-family:sans-serif;">
          <p style="color:#F5F5F7;">Login concluído!</p>
          <a href="${redirectUrl.replace(/&/g, '&amp;')}"
             style="background:#F03A26; color:#F5F5F7; padding:12px 24px; border-radius:12px; text-decoration:none;">
            Voltar para o app
          </a>
          <script>window.location.href = ${JSON.stringify(redirectUrl)};</script>
        </body>
      </html>
    `);
  }
}