import { BadRequestException, createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Request } from 'express';

// The api project already authenticated the end user (JWT) before proxying
// here — it forwards the resolved userId as a trusted header.
export const InternalUserId = createParamDecorator((_data: unknown, ctx: ExecutionContext): string => {
  const request = ctx.switchToHttp().getRequest<Request>();
  const userId = request.headers['x-user-id'];

  if (!userId || Array.isArray(userId)) {
    throw new BadRequestException('Missing x-user-id header');
  }

  return userId;
});
