import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';

@Injectable()
export class InternalAuthGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const key = request.headers['x-internal-key'];

    if (!key || key !== this.config.get<string>('INTERNAL_API_KEY')) {
      throw new UnauthorizedException('Invalid or missing internal key');
    }

    return true;
  }
}
