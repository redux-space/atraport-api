/**
 * Redacts sensitive fields from objects before they are written to logs.
 *
 * Fields are matched case-insensitively against a default + configurable list.
 * Values are replaced with "[REDACTED]" and the original structure is preserved.
 */

/** Default field names that must never appear in logs */
const DEFAULT_SENSITIVE_KEYS = new Set([
  'password',
  'passwd',
  'secret',
  'token',
  'accesstoken',
  'refreshtoken',
  'authorization',
  'apikey',
  'api_key',
  'privatekey',
  'private_key',
  'secretkey',
  'secret_key',
  'creditcard',
  'credit_card',
  'cardnumber',
  'card_number',
  'cvv',
  'ssn',
  'socialsecuritynumber',
  'passphrase',
  'mnemonic',
  'seed',
]);

const REDACTED = '[REDACTED]';

/**
 * Recursively walks `value` and replaces any property whose lowercased key
 * appears in `sensitiveKeys` with `"[REDACTED]"`.
 */
export function redactSensitiveData(
  value: unknown,
  sensitiveKeys: Set<string> = DEFAULT_SENSITIVE_KEYS,
  depth = 0,
): unknown {
  // Guard against circular references and very deep objects
  if (depth > 10 || value === null || value === undefined) {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((item) => redactSensitiveData(item, sensitiveKeys, depth + 1));
  }

  if (typeof value === 'object') {
    const redacted: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      redacted[k] = sensitiveKeys.has(k.toLowerCase())
        ? REDACTED
        : redactSensitiveData(v, sensitiveKeys, depth + 1);
    }
    return redacted;
  }

  // Primitive — return as-is
  return value;
}

/**
 * Redact sensitive patterns from a URL query string or path string.
 * E.g. strips `?token=abc&apiKey=xyz` values.
 */
export function redactUrlParams(url: string): string {
  try {
    const parsedUrl = new URL(url, 'http://placeholder');
    parsedUrl.searchParams.forEach((_, key) => {
      if (DEFAULT_SENSITIVE_KEYS.has(key.toLowerCase())) {
        parsedUrl.searchParams.set(key, REDACTED);
      }
    });
    // Decode the search string to avoid percent-encoding of [REDACTED]
    const search = parsedUrl.search
      ? '?' + Array.from(parsedUrl.searchParams.entries())
          .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
          .join('&')
          .replace(encodeURIComponent(REDACTED), REDACTED)
      : '';
    return parsedUrl.pathname + search;
  } catch {
    return url;
  }
}
