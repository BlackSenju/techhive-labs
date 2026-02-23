// ── In-memory sliding window rate limiter (Workers-compatible) ──
// Note: resets on cold start. For production, consider D1-backed limits.

const windows = new Map<string, number[]>();

/**
 * Check if a request should be rate-limited.
 * Returns true if the limit has been exceeded.
 */
export function isRateLimited(
  key: string,
  maxRequests: number,
  windowMs: number,
): boolean {
  const now = Date.now();
  const cutoff = now - windowMs;

  const timestamps = (windows.get(key) ?? []).filter((t) => t > cutoff);
  timestamps.push(now);
  windows.set(key, timestamps);

  return timestamps.length > maxRequests;
}
