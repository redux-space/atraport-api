import { RebalancingService } from './rebalancing.service';

describe('RebalancingService', () => {
  let service: RebalancingService;

  beforeEach(() => {
    service = new RebalancingService();
  });

  it('generates a plan for multiple assets and recommends a strategy', () => {
    const plan = service.plan({
      portfolioId: 'portfolio-1',
      strategy: 'balanced',
      currentAllocation: { BTC: 0.2, ETH: 0.5, USDC: 0.3 },
      targetAllocation: { BTC: 0.5, ETH: 0.3, USDC: 0.2 },
      assets: [
        { symbol: 'BTC', currentAmount: 1.2, targetAmount: 2.5, liquidity: 3.2, volatility: 0.01 },
        { symbol: 'ETH', currentAmount: 9, targetAmount: 6, liquidity: 2.8, volatility: 0.02 },
        { symbol: 'USDC', currentAmount: 3000, targetAmount: 1000, liquidity: 4.5, volatility: 0.005 }
      ],
      tolerance: 0.01
    });

    expect(plan.rebalanceId).toBeDefined();
    expect(plan.trades).toHaveLength(3);
    expect(plan.recommendedStrategy).toBe('balanced');
    expect(plan.trades[0].symbol).toBe('BTC');
    expect(plan.trades[0].direction).toBe('buy');
  });

  it('keeps fee estimates within 2% of actual execution costs', async () => {
    const estimate = service.estimateFees({
      portfolioId: 'portfolio-1',
      strategy: 'min-cost',
      assets: [
        { symbol: 'BTC', currentAmount: 1.2, targetAmount: 2.5, liquidity: 3.2, volatility: 0.01 },
        { symbol: 'ETH', currentAmount: 9, targetAmount: 6, liquidity: 2.8, volatility: 0.02 }
      ]
    });

    const execution = service.execute({
      portfolioId: 'portfolio-1',
      strategy: 'min-cost',
      currentAllocation: { BTC: 0.2, ETH: 0.8 },
      targetAllocation: { BTC: 0.5, ETH: 0.5 },
      assets: [
        { symbol: 'BTC', currentAmount: 1.2, targetAmount: 2.5, liquidity: 3.2, volatility: 0.01 },
        { symbol: 'ETH', currentAmount: 9, targetAmount: 6, liquidity: 2.8, volatility: 0.02 }
      ],
      tolerance: 0.01
    });

    const difference = Math.abs(execution.totalFees - estimate.totalFee) / estimate.totalFee;
    expect(difference).toBeLessThan(0.02);
  });

  it('executes all three strategies and records trade history', () => {
    const strategies = ['min-cost', 'min-time', 'balanced'] as const;

    strategies.forEach((strategy) => {
      const result = service.execute({
        portfolioId: 'portfolio-1',
        strategy,
        currentAllocation: { BTC: 0.2, ETH: 0.8 },
        targetAllocation: { BTC: 0.5, ETH: 0.5 },
        assets: [
          { symbol: 'BTC', currentAmount: 1.2, targetAmount: 2.5, liquidity: 3.2, volatility: 0.01 },
          { symbol: 'ETH', currentAmount: 9, targetAmount: 6, liquidity: 2.8, volatility: 0.02 }
        ],
        tolerance: 0.01
      });

      expect(result.status).toBe('completed');
      expect(result.trades.length).toBeGreaterThan(0);
    });

    const history = service.getExecutionLog('portfolio-1');
    expect(history).toHaveLength(3);
  });

  it('detects and prevents slippage above the tolerance', () => {
    const estimate = service.getSlippageEstimate({
      portfolioId: 'portfolio-1',
      strategy: 'min-time',
      asset: 'BTC',
      tradeSize: 40,
      tolerance: 0.005,
      liquidity: 1.2
    });

    expect(estimate.blocked).toBe(true);
    expect(estimate.reason).toContain('slippage');
  });

  it('simulates execution without side effects in dry-run mode', () => {
    const before = service.getExecutionLog('portfolio-2');
    const dryRun = service.dryRun({
      portfolioId: 'portfolio-2',
      strategy: 'balanced',
      currentAllocation: { BTC: 0.3, ETH: 0.7 },
      targetAllocation: { BTC: 0.5, ETH: 0.5 },
      assets: [
        { symbol: 'BTC', currentAmount: 1.5, targetAmount: 2.5, liquidity: 3.2, volatility: 0.01 },
        { symbol: 'ETH', currentAmount: 7, targetAmount: 5, liquidity: 2.8, volatility: 0.02 }
      ],
      tolerance: 0.01
    });

    expect(dryRun.status).toBe('simulated');
    expect(service.getExecutionLog('portfolio-2')).toEqual(before);
  });
});
