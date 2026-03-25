import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Request } from 'express';
import { AuthService } from './auth.service';

export type RequestWithAuth = Request & { auth?: Awaited<ReturnType<AuthService['authenticate']>> };

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly authService: AuthService) {}

  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<RequestWithAuth>();
    request.auth = await this.authService.authenticate(request.headers.authorization);
    return true;
  }
}
