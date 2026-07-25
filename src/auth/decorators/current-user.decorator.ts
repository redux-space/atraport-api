import { createParamDecorator, ExecutionContext } from '@nestjs/common';

/**
 * Injects the authenticated user from the request object.
 *
 * @example
 * profile(@CurrentUser() user: AuthUser) { ... }
 */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    return request.user;
  },
);
