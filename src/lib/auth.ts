// ── API key authentication for operator endpoints ──
import { getCloudflareContext } from '@opennextjs/cloudflare';
import type { NextRequest } from 'next/server';

/**
 * Validates the Authorization: Bearer <token> header against API_SECRET.
 * Labs is operator-only (no customer-facing auth), so a shared secret suffices.
 */
export function isAuthorized(request: NextRequest): boolean {
  const { env } = getCloudflareContext();
  const secret = env.API_SECRET;

  if (!secret) {
    console.error('[auth] API_SECRET not configured');
    return false;
  }

  const header = request.headers.get('Authorization');
  if (!header?.startsWith('Bearer ')) return false;

  const token = header.slice(7);
  return token === secret;
}
