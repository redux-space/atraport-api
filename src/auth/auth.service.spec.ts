import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { AuthService } from './auth.service';
import { HashService } from './hash.service';
import { TokenRevocationService } from './token-revocation.service';
import { User, UserRole, UserStatus } from './entities/user.entity';
import { RevokedToken } from './entities/revoked-token.entity';

// ─── Mock helpers ─────────────────────────────────────────────────────────────

const mockUser = (): User => ({
  id: 'user-uuid-1',
  email: 'alice@example.com',
  passwordHash: '$2b$12$hashedpassword',
  role: UserRole.USER,
  status: UserStatus.ACTIVE,
  refreshTokenHash: null,
  apiKeyHash: null,
  apiKeyPrefix: null,
  createdAt: new Date(),
  updatedAt: new Date(),
});

const createMockUserRepo = () => ({
  findOne: jest.fn(),
  create: jest.fn(),
  save: jest.fn(),
  update: jest.fn(),
  createQueryBuilder: jest.fn().mockReturnValue({
    addSelect: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    getOne: jest.fn(),
  }),
});

const createMockRevokedTokenRepo = () => ({
  create: jest.fn(),
  save: jest.fn(),
  count: jest.fn().mockResolvedValue(0),
  delete: jest.fn(),
});

// ─── HashService unit tests ───────────────────────────────────────────────────

describe('HashService', () => {
  let service: HashService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [HashService],
    }).compile();
    service = module.get<HashService>(HashService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should hash a password', async () => {
    const hash = await service.hash('mypassword');
    expect(hash).toBeDefined();
    expect(hash).not.toBe('mypassword');
    expect(hash.startsWith('$2b$')).toBe(true);
  });

  it('should return true when password matches hash', async () => {
    const hash = await service.hash('correctpassword');
    const result = await service.compare('correctpassword', hash);
    expect(result).toBe(true);
  });

  it('should return false when password does not match hash', async () => {
    const hash = await service.hash('correctpassword');
    const result = await service.compare('wrongpassword', hash);
    expect(result).toBe(false);
  });

  it('should produce different hashes for the same input (salt)', async () => {
    const h1 = await service.hash('samepassword');
    const h2 = await service.hash('samepassword');
    expect(h1).not.toBe(h2);
  });
});

// ─── TokenRevocationService unit tests ───────────────────────────────────────

describe('TokenRevocationService', () => {
  let service: TokenRevocationService;
  let repo: ReturnType<typeof createMockRevokedTokenRepo>;

  beforeEach(async () => {
    repo = createMockRevokedTokenRepo();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TokenRevocationService,
        { provide: getRepositoryToken(RevokedToken), useValue: repo },
      ],
    }).compile();
    service = module.get<TokenRevocationService>(TokenRevocationService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should revoke a token', async () => {
    const record = { jti: 'test-jti', expiresAt: new Date() };
    repo.create.mockReturnValue(record);
    repo.save.mockResolvedValue(record);

    await service.revoke('test-jti', new Date());
    expect(repo.save).toHaveBeenCalledWith(record);
  });

  it('should return true for a revoked token', async () => {
    repo.count.mockResolvedValue(1);
    const result = await service.isRevoked('revoked-jti');
    expect(result).toBe(true);
  });

  it('should return false for a valid (non-revoked) token', async () => {
    repo.count.mockResolvedValue(0);
    const result = await service.isRevoked('valid-jti');
    expect(result).toBe(false);
  });

  it('should purge expired records', async () => {
    repo.delete.mockResolvedValue({ affected: 3 });
    await service.purgeExpired();
    expect(repo.delete).toHaveBeenCalled();
  });
});

// ─── AuthService unit tests ───────────────────────────────────────────────────

describe('AuthService', () => {
  let service: AuthService;
  let userRepo: ReturnType<typeof createMockUserRepo>;
  let hashService: HashService;
  let jwtService: JwtService;
  let revocationService: TokenRevocationService;

  beforeEach(async () => {
    userRepo = createMockUserRepo();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        HashService,
        {
          provide: JwtService,
          useValue: {
            sign: jest.fn().mockReturnValue('signed-jwt-token'),
            decode: jest.fn().mockReturnValue({
              sub: 'user-id',
              jti: 'test-jti',
              exp: Math.floor(Date.now() / 1000) + 900,
            }),
          },
        },
        {
          provide: TokenRevocationService,
          useValue: {
            revoke: jest.fn().mockResolvedValue(undefined),
            isRevoked: jest.fn().mockResolvedValue(false),
          },
        },
        { provide: getRepositoryToken(User), useValue: userRepo },
        { provide: getRepositoryToken(RevokedToken), useValue: createMockRevokedTokenRepo() },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    hashService = module.get<HashService>(HashService);
    jwtService = module.get<JwtService>(JwtService);
    revocationService = module.get<TokenRevocationService>(TokenRevocationService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // ─── register ──────────────────────────────────────────────────────────────

  describe('register', () => {
    it('should register a new user', async () => {
      const user = mockUser();
      userRepo.findOne.mockResolvedValue(null);
      userRepo.create.mockReturnValue(user);
      userRepo.save.mockResolvedValue(user);

      const result = await service.register({ email: user.email, password: 'P@ssword1' });
      expect(result.email).toBe(user.email);
      expect(result.role).toBe(UserRole.USER);
    });

    it('should throw ConflictException for a duplicate email', async () => {
      userRepo.findOne.mockResolvedValue(mockUser());
      await expect(
        service.register({ email: 'alice@example.com', password: 'P@ssword1' }),
      ).rejects.toThrow(ConflictException);
    });
  });

  // ─── validateCredentials ───────────────────────────────────────────────────

  describe('validateCredentials', () => {
    it('should return user for valid credentials', async () => {
      const user = mockUser();
      const hash = await hashService.hash('correct-password');
      user.passwordHash = hash;

      const qb = userRepo.createQueryBuilder();
      qb.getOne.mockResolvedValue(user);

      const result = await service.validateCredentials(user.email, 'correct-password');
      expect(result).not.toBeNull();
      expect(result!.email).toBe(user.email);
    });

    it('should return null for wrong password', async () => {
      const user = mockUser();
      const hash = await hashService.hash('correct-password');
      user.passwordHash = hash;

      const qb = userRepo.createQueryBuilder();
      qb.getOne.mockResolvedValue(user);

      const result = await service.validateCredentials(user.email, 'wrong-password');
      expect(result).toBeNull();
    });

    it('should return null when user does not exist', async () => {
      const qb = userRepo.createQueryBuilder();
      qb.getOne.mockResolvedValue(null);

      const result = await service.validateCredentials('unknown@example.com', 'any');
      expect(result).toBeNull();
    });

    it('should return null for inactive users', async () => {
      const user = { ...mockUser(), status: UserStatus.SUSPENDED };
      const qb = userRepo.createQueryBuilder();
      qb.getOne.mockResolvedValue(user);

      const result = await service.validateCredentials(user.email, 'any');
      expect(result).toBeNull();
    });
  });

  // ─── login ─────────────────────────────────────────────────────────────────

  describe('login', () => {
    it('should return access and refresh tokens', async () => {
      const authUser = { id: 'u1', email: 'alice@example.com', role: UserRole.USER };
      userRepo.update.mockResolvedValue({ affected: 1 });

      const result = await service.login(authUser);
      expect(result.accessToken).toBe('signed-jwt-token');
      expect(result.refreshToken).toBeDefined();
      expect(typeof result.refreshToken).toBe('string');
      expect(result.refreshToken.length).toBeGreaterThan(0);
    });
  });

  // ─── refreshTokens ─────────────────────────────────────────────────────────

  describe('refreshTokens', () => {
    it('should throw when user has no refresh token stored', async () => {
      const qb = userRepo.createQueryBuilder();
      qb.getOne.mockResolvedValue({ ...mockUser(), refreshTokenHash: null });

      await expect(service.refreshTokens('u1', 'any-token')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw when refresh token does not match', async () => {
      const stored = await hashService.hash('correct-token');
      const qb = userRepo.createQueryBuilder();
      qb.getOne.mockResolvedValue({ ...mockUser(), refreshTokenHash: stored });
      userRepo.update.mockResolvedValue({ affected: 1 });

      await expect(service.refreshTokens('u1', 'wrong-token')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should return new tokens for a valid refresh token', async () => {
      const rawToken = 'valid-refresh-token-that-is-long-enough-for-bcrypt-12345678';
      const stored = await hashService.hash(rawToken);
      const qb = userRepo.createQueryBuilder();
      qb.getOne.mockResolvedValue({ ...mockUser(), refreshTokenHash: stored });
      userRepo.update.mockResolvedValue({ affected: 1 });

      const result = await service.refreshTokens('u1', rawToken);
      expect(result.accessToken).toBeDefined();
      expect(result.refreshToken).toBeDefined();
    });
  });

  // ─── logout ────────────────────────────────────────────────────────────────

  describe('logout', () => {
    it('should revoke the access token and clear refresh token', async () => {
      userRepo.update.mockResolvedValue({ affected: 1 });

      await service.logout('u1', 'some-jwt-token');

      expect(revocationService.revoke).toHaveBeenCalled();
      expect(userRepo.update).toHaveBeenCalledWith('u1', { refreshTokenHash: null });
    });
  });

  // ─── API key ───────────────────────────────────────────────────────────────

  describe('generateApiKey', () => {
    it('should return an API key with a prefix', async () => {
      userRepo.findOne.mockResolvedValue(mockUser());
      userRepo.update.mockResolvedValue({ affected: 1 });

      const result = await service.generateApiKey('u1');
      expect(result.apiKey).toMatch(/^ak_/);
      expect(result.prefix).toBe(result.apiKey.slice(0, 10));
    });
  });

  describe('validateApiKey', () => {
    it('should return user for a valid API key', async () => {
      const rawKey = 'ak_' + 'a'.repeat(64);
      const hash = await hashService.hash(rawKey);
      const user = { ...mockUser(), apiKeyHash: hash, apiKeyPrefix: rawKey.slice(0, 10) };

      const qb = userRepo.createQueryBuilder();
      qb.getOne.mockResolvedValue(user);

      const result = await service.validateApiKey(rawKey);
      expect(result).not.toBeNull();
    });

    it('should return null for an invalid API key', async () => {
      const storedHash = await hashService.hash('ak_correct-key' + 'x'.repeat(50));
      const qb = userRepo.createQueryBuilder();
      qb.getOne.mockResolvedValue({
        ...mockUser(),
        apiKeyHash: storedHash,
        apiKeyPrefix: 'ak_correct',
      });

      const result = await service.validateApiKey('ak_wrong-key' + 'y'.repeat(50));
      expect(result).toBeNull();
    });
  });

  // ─── getStatus ────────────────────────────────────────────────────────────

  it('should return module status', () => {
    expect(service.getStatus()).toEqual({ module: 'auth', status: 'ok' });
  });
});
