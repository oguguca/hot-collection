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
    return req.user;
  }

  @UseGuards(GoogleAuthGuard)
  @Get('google')
  googleAuth() {
    // Este método fica vazio de propósito.
    // O Guard intercepta a requisição e redireciona para a tela de login do Google.
  }

  @UseGuards(GoogleAuthGuard)
  @Get('google/callback')
  async googleAuthCallback(@Req() req: any, @Res() res: Response) {
    const result = await this.authService.validateGoogleUser(req.user);

    const redirectUrl = `hotcollectionapp://auth-callback?accessToken=${encodeURIComponent(
      result.accessToken,
    )}&userId=${encodeURIComponent(result.user.id)}&email=${encodeURIComponent(
      result.user.email,
    )}&name=${encodeURIComponent(result.user.name ?? '')}`;

    res.send(`
      <html>
        <body style="background:#0A0A0B; display:flex; align-items:center; justify-content:center; height:100vh; margin:0;">
          <script>
            window.location.href = "${redirectUrl}";
          </script>
          <p style="color:#F5F5F7; font-family:sans-serif;">Redirecionando...</p>
        </body>
      </html>
    `);
  }
}