// ── Stripe webhook signature verification (Web Crypto, Workers-compatible) ──

const TOLERANCE_SECONDS = 300; // 5 minutes

export interface VerifyResult {
  readonly valid: boolean;
  readonly error?: string;
}

export async function verifyStripeSignature(
  rawBody: string,
  signatureHeader: string,
  webhookSecret: string,
): Promise<VerifyResult> {
  // Parse signature header: t=<timestamp>,v1=<sig>[,v1=<sig>]
  const parts = signatureHeader.split(',');
  let timestamp: string | null = null;
  const signatures: string[] = [];

  for (const part of parts) {
    const [key, value] = part.split('=', 2);
    if (key === 't') timestamp = value;
    if (key === 'v1') signatures.push(value);
  }

  if (!timestamp || signatures.length === 0) {
    return { valid: false, error: 'Missing timestamp or signature in header' };
  }

  // Replay protection
  const ts = parseInt(timestamp, 10);
  const now = Math.floor(Date.now() / 1000);

  if (isNaN(ts) || ts > now + 60) {
    return { valid: false, error: 'Timestamp is in the future' };
  }

  if (now - ts > TOLERANCE_SECONDS) {
    return { valid: false, error: `Timestamp too old (${now - ts}s > ${TOLERANCE_SECONDS}s)` };
  }

  // Compute expected signature: HMAC-SHA256(secret, "<timestamp>.<body>")
  const payload = `${timestamp}.${rawBody}`;
  const encoder = new TextEncoder();

  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(webhookSecret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );

  const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(payload));
  const expectedHex = Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

  // Check against all v1 signatures (Stripe may send multiple)
  const match = signatures.some((s) => timingSafeEqual(s, expectedHex));

  if (!match) {
    return { valid: false, error: 'Signature mismatch' };
  }

  return { valid: true };
}

/** Constant-time string comparison to prevent timing attacks */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}
