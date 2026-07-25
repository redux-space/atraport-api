import { redactSensitiveData, redactUrlParams } from './redact.util';

describe('redactSensitiveData', () => {
  it('should redact top-level sensitive keys', () => {
    const input = { username: 'alice', password: 'secret123' };
    const result = redactSensitiveData(input) as Record<string, unknown>;
    expect(result.username).toBe('alice');
    expect(result.password).toBe('[REDACTED]');
  });

  it('should redact deeply nested sensitive keys', () => {
    const input = {
      user: {
        name: 'bob',
        credentials: {
          token: 'tok_abc',
          email: 'bob@example.com',
        },
      },
    };
    const result = redactSensitiveData(input) as any;
    expect(result.user.credentials.token).toBe('[REDACTED]');
    expect(result.user.credentials.email).toBe('bob@example.com');
    expect(result.user.name).toBe('bob');
  });

  it('should redact inside arrays', () => {
    const input = [{ apiKey: 'key1', name: 'a' }, { apiKey: 'key2', name: 'b' }];
    const result = redactSensitiveData(input) as any[];
    expect(result[0].apiKey).toBe('[REDACTED]');
    expect(result[0].name).toBe('a');
  });

  it('should handle case-insensitive key matching', () => {
    const result = redactSensitiveData({ Password: 'pw', TOKEN: 'tok' }) as any;
    expect(result.Password).toBe('[REDACTED]');
    expect(result.TOKEN).toBe('[REDACTED]');
  });

  it('should return primitives unchanged', () => {
    expect(redactSensitiveData('hello')).toBe('hello');
    expect(redactSensitiveData(42)).toBe(42);
    expect(redactSensitiveData(null)).toBeNull();
  });

  it('should not mutate the original object', () => {
    const original = { password: 'pw', name: 'Alice' };
    redactSensitiveData(original);
    expect(original.password).toBe('pw');
  });

  it('should respect custom sensitive keys', () => {
    const custom = new Set(['wallet']);
    const result = redactSensitiveData({ wallet: '0xabc', name: 'Dave' }, custom) as any;
    expect(result.wallet).toBe('[REDACTED]');
    expect(result.name).toBe('Dave');
  });
});

describe('redactUrlParams', () => {
  it('should redact sensitive query parameters', () => {
    const result = redactUrlParams('/api/data?token=abc123&page=2');
    expect(result).toContain('token=[REDACTED]');
    expect(result).toContain('page=2');
  });

  it('should leave non-sensitive params intact', () => {
    const result = redactUrlParams('/api/items?page=1&limit=10');
    expect(result).toContain('page=1');
    expect(result).toContain('limit=10');
  });

  it('should return the url unchanged if no query string', () => {
    const result = redactUrlParams('/api/items');
    expect(result).toBe('/api/items');
  });

  it('should handle malformed URLs gracefully', () => {
    // Should not throw
    const result = redactUrlParams('not a url at all %%%');
    expect(typeof result).toBe('string');
  });
});
