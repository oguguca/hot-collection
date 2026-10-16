import { ExecutionContext, Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class GoogleAuthGuard extends AuthGuard('google') {
  getAuthenticateOptions(context: ExecutionContext) {
    const req = context.switchToHttp().getRequest();
    const redirect = req.query?.redirect;
    // O endereço de retorno viaja dentro do "state" do OAuth e volta no callback
    return typeof redirect === 'string' ? { state: redirect } : {};
  }
}