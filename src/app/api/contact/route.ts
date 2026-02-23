// ── POST /api/contact — Public inbound form handler ──
import { NextRequest } from 'next/server';
import { getDb } from '@/lib/db';
import { sendEmail } from '@/lib/sendgrid';
import { sendDiscordMessage } from '@/lib/discord';
import { logActivity } from '@/lib/activity';
import { isRateLimited } from '@/lib/rate-limit';
import { ok, err } from '@/lib/api-response';
import { RATE_LIMITS, COLORS } from '@/lib/constants';
import type { Lead } from '@/lib/types';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function sanitize(input: string): string {
  return input.replace(/[<>"'&]/g, '').trim().slice(0, 1000);
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as Record<string, unknown>;
    const name = sanitize(String(body.name ?? ''));
    const email = String(body.email ?? '').trim().toLowerCase();
    const message = sanitize(String(body.message ?? ''));
    const category = sanitize(String(body.category ?? 'pro'));

    // Validate
    if (!name || name.length < 2) return err('Name is required (min 2 chars)');
    if (!EMAIL_REGEX.test(email)) return err('Valid email is required');

    // Rate limit by email
    const { max, windowMs } = RATE_LIMITS.contactForm;
    if (isRateLimited(`contact:${email}`, max, windowMs)) {
      return err('Too many submissions. Please try again later.', 429);
    }

    const db = getDb();

    // Always store contact
    await db.prepare(
      'INSERT INTO contacts (name, email, message, source) VALUES (?, ?, ?, ?)',
    ).bind(name, email, message, 'website').run();

    // 7-day email dedupe against leads
    const existing = await db.prepare(
      "SELECT id, business_name FROM leads WHERE email = ? AND created_at > datetime('now', '-7 days') ORDER BY id DESC LIMIT 1",
    ).bind(email).first<Pick<Lead, 'id' | 'business_name'>>();

    let leadId: number;
    let deduped = false;

    if (existing) {
      // Update existing lead
      await db.prepare(
        "UPDATE leads SET message = ?, updated_at = datetime('now') WHERE id = ?",
      ).bind(message, existing.id).run();
      leadId = existing.id;
      deduped = true;
    } else {
      // Create new lead
      const result = await db.prepare(
        "INSERT INTO leads (business_name, email, category, message, score, stage, review_status) VALUES (?, ?, ?, ?, ?, 'new', 'pending_review')",
      ).bind(name, email, category, message, 85).run();
      leadId = result.meta.last_row_id;
    }

    // Log activity
    await logActivity('inbound_contact', `Contact from ${name} (${email})`, {
      lead_id: leadId,
      deduped,
      category,
    });

    // Discord notification (fire-and-forget)
    sendDiscordMessage({
      embeds: [{
        title: deduped ? '\u{1F504} Labs Contact (Updated)' : '\u{1F4E8} New Labs Contact',
        color: deduped ? COLORS.warning : COLORS.info,
        fields: [
          { name: 'Name', value: name, inline: true },
          { name: 'Email', value: email, inline: true },
          { name: 'Category', value: category, inline: true },
          { name: 'Message', value: message.slice(0, 200) || '(none)' },
        ],
        footer: { text: `Lead #${leadId} ${deduped ? '(deduped)' : '(new)'}` },
        timestamp: new Date().toISOString(),
      }],
    }).catch((e) => console.error('[contact] Discord error:', e));

    // Confirmation email (fire-and-forget)
    if (!deduped) {
      sendEmail({
        to: email,
        subject: 'We got your message — TechHive Labs',
        body: `Hi ${name},\n\nThanks for reaching out to TechHive Labs! We've received your inquiry and will follow up within 24 hours with a personalized proposal.\n\nIn the meantime, if you have any questions, just reply to this email.\n\n— TechHive Labs`,
      }).catch((e) => console.error('[contact] Confirmation email error:', e));
    }

    return ok({ lead_id: leadId, deduped });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[contact] Error:', message);
    return err(message, 500);
  }
}
