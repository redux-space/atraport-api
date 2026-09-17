import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { randomBytes, randomUUID } from 'crypto';
import { OAuth2Client } from 'google-auth-library';
import { User, UserRole, UserStatus } from './entities/user.entity';
import { HashService } from './hash.service';
import { TokenRevocationService } from './token-revocation.service';
import { RegisterDto, SocialLoginDto, SocialProvider } from './dto/auth.dto';
import { JwtPayload } from './strategies/jwt.strategy';

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

export interface AuthUser {
  id: string;
  email: string;
  role: UserRole;
}

@Injectable()
export class AuthService {
  /** Access token TTL in seconds. */
  private readonly ACCESS_TOKEN_TTL = 15 * 60; // 15 minutes
  /** Refresh token TTL in seconds. */
  private readonly REFRESH_TOKEN_TTL = 7 * 24 * 60 * 60; // 7 days
  private readonly googleClient = new OAuth2Client();

  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    private readonly jwtService: JwtService,
    private readonly hashService: HashService,
    private readonly revocationService: TokenRevocationService,
  ) {}

  // ─── Registration ────────────────────────────────────────────────────────────

  async register(dto: RegisterDto): Promise<AuthUser> {
    const existing = await this.userRepo.findOne({ where: { email: dto.email } });
    if (existing) {
      throw new ConflictException('Email already in use');
    }

    const passwordHash = await this.hashService.hash(dto.password);
    const user = this.userRepo.create({
      email: dto.email,
      passwordHash,
      role: dto.role ?? UserRole.USER,
    });

    const saved = await this.userRepo.save(user);
    return this.toAuthUser(saved);
  }

  // ─── Credential validation (used by LocalStrategy) ───────────────────────────

  async validateCredentials(email: string, password: string): Promise<AuthUser | null> {
    const user = await this.userRepo
      .createQueryBuilder('user')
      .addSelect('user.passwordHash')
      .where('user.email = :email', { email })
      .getOne();

    if (!user || user.status !== UserStatus.ACTIVE) {
      return null;
    }

    const valid = await this.hashService.compare(password, user.passwordHash);
    return valid ? this.toAuthUser(user) : null;
  }

  // ─── Token generation ─────────────────────────────────────────────────────────

  async login(user: AuthUser): Promise<TokenPair> {
    const [accessToken, refreshToken] = await Promise.all([
      this.generateAccessToken(user),
      this.generateRefreshToken(user),
    ]);
    return { accessToken, refreshToken };
  }

  async socialLogin(dto: SocialLoginDto): Promise<TokenPair> {
    if (dto.provider !== SocialProvider.GOOGLE) {
      throw new UnauthorizedException('Unsupported social login provider');
    }

    const clientId = process.env.GOOGLE_CLIENT_ID;
    if (!clientId) {
      throw new UnauthorizedException('Google login is not configured');
    }

    let payload: {
      sub?: string;
      email?: string;
      email_verified?: boolean;
    } | undefined;
    try {
      const ticket = await this.googleClient.verifyIdToken({
        idToken: dto.idToken,
        audience: clientId,
      });
      payload = ticket.getPayload();
    } catch {
      throw new UnauthorizedException('Invalid Google ID token');
    }

    if (!payload?.sub || !payload.email || payload.email_verified !== true) {
      throw new UnauthorizedException('Google account email is not verified');
    }

    let user = await this.userRepo.findOne({
      where: { socialProvider: dto.provider, socialProviderId: payload.sub },
    });

    if (!user) {
      user = await this.userRepo.findOne({ where: { email: payload.email } });
      if (user) {
        if (user.status !== UserStatus.ACTIVE) {
          throw new UnauthorizedException('User account is not active');
        }
        await this.userRepo.update(user.id, {
          socialProvider: dto.provider,
          socialProviderId: payload.sub,
        });
      } else {
        user = this.userRepo.create({
          email: payload.email,
          passwordHash: await this.hashService.hash(randomBytes(32).toString('hex')),
          socialProvider: dto.provider,
          socialProviderId: payload.sub,
          role: UserRole.USER,
        });
        user = await this.userRepo.save(user);
      }
    }

    if (user.status !== UserStatus.ACTIVE) {
      throw new UnauthorizedException('User account is not active');
    }

    return this.login(this.toAuthUser(user));
  }

  private async generateAccessToken(user: AuthUser): Promise<string> {
    const jti = randomUUID();
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      jti,
    };
    return this.jwtService.sign(payload, {
      expiresIn: this.ACCESS_TOKEN_TTL,
    });
  }

  private async generateRefreshToken(user: AuthUser): Promise<string> {
    const token = randomBytes(64).toString('hex');
    const hashed = await this.hashService.hash(token);

    await this.userRepo.update(user.id, { refreshTokenHash: hashed });
    return token;
  }

  // ─── Refresh token ────────────────────────────────────────────────────────────

  async refreshTokens(userId: string, refreshToken: string): Promise<TokenPair> {
    const user = await this.userRepo
      .createQueryBuilder('user')
      .addSelect('user.refreshTokenHash')
      .where('user.id = :id', { id: userId })
      .getOne();

    if (!user || !user.refreshTokenHash) {
      throw new UnauthorizedException('Refresh token invalid or expired');
    }

    const valid = await this.hashService.compare(refreshToken, user.refreshTokenHash);
    if (!valid) {
      throw new UnauthorizedException('Refresh token invalid or expired');
    }

    // Rotate: invalidate the old refresh token immediately
    await this.userRepo.update(user.id, { refreshTokenHash: null });

    return this.login(this.toAuthUser(user));
  }

  // ─── Logout / token revocation ────────────────────────────────────────────────

  async logout(userId: string, accessToken: string): Promise<void> {
    // Revoke the access token
    try {
      const decoded = this.jwtService.decode(accessToken) as JwtPayload;
      if (decoded?.jti && decoded?.exp) {
        await this.revocationService.revoke(
          decoded.jti,
          new Date(decoded.exp * 1000),
        );
      }
    } catch {
      // Ignore malformed tokens – proceed with refresh token invalidation
    }

    // Invalidate stored refresh token
    await this.userRepo.update(userId, { refreshTokenHash: null });
  }

  async revokeToken(token: string): Promise<void> {
    try {
      const decoded = this.jwtService.decode(token) as JwtPayload;
      if (decoded?.jti && decoded?.exp) {
        await this.revocationService.revoke(
          decoded.jti,
          new Date(decoded.exp * 1000),
        );
      }
    } catch {
      throw new UnauthorizedException('Invalid token');
    }
  }

  // ─── API key management ───────────────────────────────────────────────────────

  async generateApiKey(userId: string): Promise<{ apiKey: string; prefix: string }> {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const rawKey = `ak_${randomBytes(32).toString('hex')}`;
    const prefix = rawKey.slice(0, 10);
    const hashed = await this.hashService.hash(rawKey);

    await this.userRepo.update(userId, {
      apiKeyHash: hashed,
      apiKeyPrefix: prefix,
    });

    return { apiKey: rawKey, prefix };
  }

  async validateApiKey(apiKey: string): Promise<AuthUser | null> {
    // Extract prefix to look up the right user efficiently
    const prefix = apiKey.slice(0, 10);
    const user = await this.userRepo
      .createQueryBuilder('user')
      .addSelect('user.apiKeyHash')
      .where('user.apiKeyPrefix = :prefix', { prefix })
      .andWhere('user.status = :status', { status: UserStatus.ACTIVE })
      .getOne();

    if (!user || !user.apiKeyHash) {
      return null;
    }

    const valid = await this.hashService.compare(apiKey, user.apiKeyHash);
    return valid ? this.toAuthUser(user) : null;
  }

  // ─── User lookup ──────────────────────────────────────────────────────────────

  async findById(id: string): Promise<AuthUser | null> {
    const user = await this.userRepo.findOne({ where: { id } });
    return user ? this.toAuthUser(user) : null;
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────────

  private toAuthUser(user: User): AuthUser {
    return { id: user.id, email: user.email, role: user.role };
  }

  /** Kept for backwards compat with the original stub. */
  getStatus() {
    return { module: 'auth', status: 'ok' };
  }
}
