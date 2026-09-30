/**
 * Normalises a value into a deterministic, JSON-serialisable form suitable
 * for cache-key generation and ETag computation.
 *
 * - Scalars are tagged by type so `1` and `"1"` never collide.
 * - `Date` values become `{ __type: 'Date', value: <ISO> }`.
 * - Arrays recurse per element (order is significant).
 * - Plain objects recurse over sorted keys (order is insignificant).
 * - Cyclic references are caught by the caller's try/catch and fall back
 *   to a non-colliding placeholder.
 */
export function normalizeForSerialization(value: unknown): unknown {
  if (value === null || value === undefined) return value;

  if (value instanceof Date) {
    return { __type: 'Date', value: value.toISOString() };
  }

  if (Array.isArray(value)) {
    return value.map(normalizeForSerialization);
  }

  if (typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    return Object.fromEntries(
      Object.keys(obj)
        .sort()
        .map((k) => [k, normalizeForSerialization(obj[k])]),
    );
  }

  // Tag scalars by type to prevent collisions between e.g. 1 and "1"
  return { __type: typeof value, value };
}

/**
 * Serialises an argument for use in a cache key. Uses the shared normaliser
 * and falls back to a type-tagged string on cyclic references.
 */
export function serializeArg(arg: unknown): string {
  try {
    return JSON.stringify(normalizeForSerialization(arg));
  } catch {
    // Cyclic reference — fall back to a type-tagged string that cannot
    // collide with a normalised object.
    return JSON.stringify({ __type: 'unserializable', value: typeof arg });
  }
}
