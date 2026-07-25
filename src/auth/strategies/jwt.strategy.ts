import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { TokenRevocationService } from '../token-revocation.service';

export interface JwtPayload {
  sub: string;
  email: string;
  role: string;
  /** JWT ID used for revocation checks. */
  jti: string;
  iat?: number;
  exp?: number;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(private readonly revocationService: TokenRevocationService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET || 'change-me-in-production',
      passReqToCallback: true,
    });
  }

  async validate(req: Request, payload: JwtPayload) {
    // Check token is not revoked
    if (payload.jti && (await this.revocationService.isRevoked(payload.jti))) {
      throw new UnauthorizedException('Token has been revoked');
    }
    return { id: payload.sub, email: payload.email, role: payload.role };
  }
}
