// ── SendGrid email client (fetch-based, Workers-compatible) ──
import { getCloudflareContext } from '@opennextjs/cloudflare';

export interface EmailPayload {
  readonly to: string;
  readonly subject: string;
  readonly body: string;
  readonly fromEmail?: string;
  readonly fromName?: string;
}

export interface SendResult {
  readonly success: boolean;
  readonly messageId: string | null;
  readonly statusCode: number;
  readonly error?: string;
}

const SENDGRID_API = 'https://api.sendgrid.com/v3/mail/send';
const DEFAULT_FROM_EMAIL = 'techhiveuptime@gmail.com';
const DEFAULT_FROM_NAME = 'TechHive Labs';

export async function sendEmail(payload: EmailPayload): Promise<SendResult> {
  const { env } = getCloudflareContext();
  const apiKey = env.SENDGRID_API_KEY;

  if (!apiKey) {
    return { success: false, messageId: null, statusCode: 0, error: 'SENDGRID_API_KEY not configured' };
  }

  const body = {
    personalizations: [{ to: [{ email: payload.to }] }],
    from: {
      email: payload.fromEmail ?? DEFAULT_FROM_EMAIL,
      name: payload.fromName ?? DEFAULT_FROM_NAME,
    },
    subject: payload.subject,
    content: [{ type: 'text/plain', value: payload.body }],
  };

  try {
    const res = await fetch(SENDGRID_API, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    const messageId = res.headers.get('x-message-id') ?? null;

    if (res.status === 202) {
      return { success: true, messageId, statusCode: 202 };
    }

    const errorText = await res.text().catch(() => 'Unknown error');
    return { success: false, messageId: null, statusCode: res.status, error: errorText };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return { success: false, messageId: null, statusCode: 0, error: message };
  }
}
