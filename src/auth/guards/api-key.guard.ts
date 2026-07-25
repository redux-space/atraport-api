import { ExecutionContext, Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * Guard for endpoints that accept API key authentication via the
 * `X-API-Key` header.
 */
@Injectable()
export class ApiKeyGuard extends AuthGuard('api-key') {
  canActivate(context: ExecutionContext) {
    return super.canActivate(context);
  }
}
