import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { HeaderAPIKeyStrategy } from 'passport-headerapikey';
import { AuthService } from '../auth.service';

@Injectable()
export class ApiKeyStrategy extends PassportStrategy(
  HeaderAPIKeyStrategy,
  'api-key',
) {
  constructor(private readonly authService: AuthService) {
    super(
      { header: 'X-API-Key', prefix: '' },
      true, // passReqToCallback
      async (apiKey: string, verified: (err: Error | null, user?: any) => void) => {
        try {
          const user = await this.authService.validateApiKey(apiKey);
          if (!user) {
            return verified(new UnauthorizedException('Invalid API key'));
          }
          return verified(null, user);
        } catch (err) {
          return verified(err as Error);
        }
      },
    );
  }
}
