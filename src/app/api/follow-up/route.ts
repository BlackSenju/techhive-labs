// ── POST /api/follow-up — Cron: 24h follow-up nudge emails ──
// Triggered by Cloudflare Cron Trigger every 6 hours
import { getDb } from '@/lib/db';
import { sendEmail } from '@/lib/sendgrid';
import { logActivity } from '@/lib/activity';
import { getFollowUpEmail, getPaymentLink, type ProposalLead } from '@/lib/proposal-templates';
import { ok, err } from '@/lib/api-response';
import { FOLLOW_UP_CAP, FOLLOW_UP_AFTER_HOURS } from '@/lib/constants';
import type { Lead } from '@/lib/types';

interface FollowUpCandidate {
  readonly id: number;
  readonly business_name: string;
  readonly email: string;
  readonly category: string;
  readonly proposal_sent_at: string;
}

export async function POST() {
  try {
    const db = getDb();

    // Find leads needing follow-up
    const { results: leads } = await db.prepare(`
      SELECT id, business_name, email, category, proposal_sent_at
      FROM leads
      WHERE proposal_sent_at IS NOT NULL
        AND proposal_sent_at < datetime('now', ?)
        AND payment_status = 'pending'
        AND follow_up_sent_at IS NULL
        AND stage NOT IN ('closed_lost', 'closed_won')
      ORDER BY proposal_sent_at ASC
      LIMIT ?
    `).bind(`-${FOLLOW_UP_AFTER_HOURS} hours`, FOLLOW_UP_CAP).all<FollowUpCandidate>();

    if (leads.length === 0) {
      return ok({ sent: 0, message: 'No follow-ups needed' });
    }

    let sentCount = 0;
    let failedCount = 0;

    for (const lead of leads) {
      const tier = lead.category || 'pro';
      const linkType = tier === 'starter' ? 'full' : 'deposit';
      const paymentUrl = await getPaymentLink(tier, linkType as 'full' | 'deposit');

      if (!paymentUrl) {
        console.warn(`[follow-up] No payment link for ${tier}/${linkType}, skipping lead #${lead.id}`);
        continue;
      }

      const proposalLead: ProposalLead = {
        id: lead.id,
        business_name: lead.business_name,
        email: lead.email,
        category: tier,
      };

      const { subject, body } = getFollowUpEmail(proposalLead, paymentUrl);
      const emailResult = await sendEmail({ to: lead.email, subject, body });

      if (emailResult.success) {
        await db.prepare(`
          UPDATE leads
          SET follow_up_sent_at = datetime('now'),
              follow_up_message_id = ?,
              updated_at = datetime('now')
          WHERE id = ?
        `).bind(emailResult.messageId, lead.id).run();

        await db.prepare(
          'INSERT INTO follow_ups (lead_id, email_message_id) VALUES (?, ?)',
        ).bind(lead.id, emailResult.messageId).run();

        sentCount++;
      } else {
        console.error(`[follow-up] Email failed for lead #${lead.id}: ${emailResult.error}`);
        failedCount++;
      }
    }

    await logActivity('follow_up_run', `Follow-up: ${sentCount} sent, ${failedCount} failed`, {
      eligible: leads.length,
      sent: sentCount,
      failed: failedCount,
    });

    return ok({ eligible: leads.length, sent: sentCount, failed: failedCount });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[follow-up] Error:', message);
    return err(message, 500);
  }
}
