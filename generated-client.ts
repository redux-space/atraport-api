export class AstraPortClient {
  constructor(private readonly baseUrl = 'http://localhost:3000') {}

  private async request(method: string, path: string) {
    const response = await fetch(`${this.baseUrl}${path}`, { method });
    return response.json();
  }

  async get_() { return this.request('GET', '/'); }
  async get_auth_status() { return this.request('GET', '/auth/status'); }
  async get_portfolio_status() { return this.request('GET', '/portfolio/status'); }
  async get_risk_status() { return this.request('GET', '/risk/status'); }
  async get_contracts_status() { return this.request('GET', '/contracts/status'); }
  async post_api_ai_triggers() { return this.request('POST', '/api/ai-triggers'); }
  async post_api_rebalancing_schedule() { return this.request('POST', '/api/rebalancing/schedule'); }
  async get_api_staking_portfolio() { return this.request('GET', '/api/staking/portfolio'); }
}