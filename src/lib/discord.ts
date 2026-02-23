// ── Discord webhook sender (fetch-based, Workers-compatible) ──
import { getCloudflareContext } from '@opennextjs/cloudflare';

export interface DiscordEmbed {
  readonly title?: string;
  readonly description?: string;
  readonly color?: number;
  readonly fields?: ReadonlyArray<{ name: string; value: string; inline?: boolean }>;
  readonly footer?: { text: string };
  readonly timestamp?: string;
}

export interface DiscordMessage {
  readonly content?: string;
  readonly embeds?: ReadonlyArray<DiscordEmbed>;
}

export async function sendDiscordMessage(message: DiscordMessage): Promise<boolean> {
  const { env } = getCloudflareContext();
  const webhookUrl = env.DISCORD_WEBHOOK_URL;

  if (!webhookUrl) {
    console.error('[discord] DISCORD_WEBHOOK_URL not configured');
    return false;
  }

  try {
    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(message),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => 'Unknown');
      console.error(`[discord] Webhook failed (${res.status}): ${text}`);
      return false;
    }

    return true;
  } catch (error) {
    console.error('[discord] Webhook error:', error);
    return false;
  }
}
