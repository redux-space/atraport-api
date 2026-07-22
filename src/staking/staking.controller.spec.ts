import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { StakingModule } from './staking.module';
import { PortfolioService } from './portfolio.service';

describe('MultiAssetStakingController (integration)', () => {
  let app: INestApplication;
  let portfolioService: PortfolioService;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [StakingModule]
    }).compile();

    portfolioService = moduleFixture.get<PortfolioService>(PortfolioService);
    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('stakes multiple assets and returns positions', async () => {
    const payload = {
      stakerId: 'user-123',
      assets: [
        { assetId: 'ASTR', amount: 100, termDays: 30 },
        { assetId: 'USDC', amount: 500, termDays: 30 }
      ]
    };

    const response = await request(app.getHttpServer())
      .post('/api/staking/stake-multi')
      .send(payload)
      .expect(201);

    expect(response.body.stakerId).toBe('user-123');
    expect(response.body.positions).toHaveLength(2);
    expect(response.body.positions[0]).toMatchObject({ assetId: 'ASTR', stakedAmount: 100 });
    expect(response.body.positions[1]).toMatchObject({ assetId: 'USDC', stakedAmount: 500 });
  });

  it('returns aggregated portfolio overview', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/staking/portfolio')
      .query({ stakerId: 'user-123' })
      .expect(200);

    expect(response.body.stakerId).toBe('user-123');
    expect(response.body.totalValue).toBe(600);
    expect(response.body.positions).toHaveLength(2);
  });

  it('returns detailed positions for staker', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/staking/positions/user-123')
      .expect(200);

    expect(response.body).toEqual(expect.arrayContaining([
      expect.objectContaining({ assetId: 'ASTR' }),
      expect.objectContaining({ assetId: 'USDC' })
    ]));
  });

  it('returns aggregated yield across assets', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/staking/yields/aggregated')
      .query({ stakerId: 'user-123' })
      .expect(200);

    expect(response.body.stakerId).toBe('user-123');
    expect(response.body.totalYield).toBeGreaterThan(0);
    expect(response.body.assets).toEqual(expect.arrayContaining([
      expect.objectContaining({ assetId: 'ASTR' }),
      expect.objectContaining({ assetId: 'USDC' })
    ]));
  });

  it('lists supported staking assets and asset rates', async () => {
    const assetsResponse = await request(app.getHttpServer())
      .get('/api/staking/assets')
      .expect(200);

    expect(Array.isArray(assetsResponse.body)).toBe(true);
    expect(assetsResponse.body).toEqual(expect.arrayContaining([
      expect.objectContaining({ assetId: 'ASTR' }),
      expect.objectContaining({ assetId: 'USDC' })
    ]));

    const ratesResponse = await request(app.getHttpServer())
      .get('/api/staking/asset/ASTR/rates')
      .expect(200);

    expect(ratesResponse.body.assetId).toBe('ASTR');
    expect(ratesResponse.body.yieldRate).toBe(0.065);
  });

  it('handles multi-asset withdrawal after unlocking', async () => {
    const now = new Date();
    const positions = (portfolioService as any).portfolioData['user-123'];
    positions.forEach((position: any) => {
      position.unlockedAt = new Date(now.getTime() - 1000).toISOString();
    });

    const response = await request(app.getHttpServer())
      .post('/api/staking/withdraw-multi')
      .send({
        stakerId: 'user-123',
        assets: [
          { assetId: 'ASTR', amount: 100 },
          { assetId: 'USDC', amount: 500 }
        ]
      })
      .expect(201);

    expect(response.body.withdrawals).toEqual(expect.arrayContaining([
      expect.objectContaining({ assetId: 'ASTR', unlocked: true }),
      expect.objectContaining({ assetId: 'USDC', unlocked: true })
    ]));
  });
});
