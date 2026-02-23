// ── POST /api/proposals/send — Send proposal email on approval ──
import { NextRequest } from 'next/server';
import { getDb } from '@/lib/db';
import { sendEmail } from '@/lib/sendgrid';
import { sendDiscordMessage } from '@/lib/discord';
import { logActivity } from '@/lib/activity';
import { isAuthorized } from '@/lib/auth';
import { getPaymentLink, getProposalEmail, type ProposalLead } from '@/lib/proposal-templates';
import { ok, unauthorized, err } from '@/lib/api-response';
import { COLORS } from '@/lib/constants';
import type { Lead } from '@/lib/types';

export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) return unauthorized();

  try {
    const body = await request.json() as Record<string, unknown>;
    const leadId = Number(body.lead_id);
    if (!leadId || isNaN(leadId)) return err('lead_id is required');

    const db = getDb();

    // Fetch lead with safety checks
    const lead = await db.prepare('SELECT * FROM leads WHERE id = ?')
      .bind(leadId).first<Lead>();

    if (!lead) return err('Lead not found', 404);
    if (lead.review_status !== 'approved') return err('Lead must be approved first');
    if (lead.proposal_sent_at) return err('Proposal already sent');

    // Determine payment link
    const tier = lead.category || 'pro';
    const linkType = tier === 'starter' ? 'full' : 'deposit';
    const paymentUrl = await getPaymentLink(tier, linkType as 'full' | 'deposit');

    if (!paymentUrl) {
      return err(`No payment link found for ${tier}/${linkType}. Run setup first.`);
    }

    // Build and send email
    const proposalLead: ProposalLead = {
      id: lead.id,
      business_name: lead.business_name,
      email: lead.email,
      category: tier,
    };

    const { subject, body: emailBody } = getProposalEmail(proposalLead, paymentUrl);
    const emailResult = await sendEmail({ to: lead.email, subject, body: emailBody });

    if (!emailResult.success) {
      // Log failure but don't crash
      await db.prepare(
        "UPDATE leads SET send_error = ?, updated_at = datetime('now') WHERE id = ?",
      ).bind(emailResult.error ?? 'Unknown error', leadId).run();

      return err(`Email send failed: ${emailResult.error}`, 502);
    }

    // Update lead
    await db.prepare(`
      UPDATE leads
      SET proposal_sent_at = datetime('now'),
          proposal_message_id = ?,
          payment_status = 'pending',
          stage = 'contacted',
          updated_at = datetime('now')
      WHERE id = ?
    `).bind(emailResult.messageId, leadId).run();

    // Record proposal
    await db.prepare(
      'INSERT INTO proposals (lead_id, tier, payment_url, email_message_id) VALUES (?, ?, ?, ?)',
    ).bind(leadId, tier, paymentUrl, emailResult.messageId).run();

    await logActivity('proposal_sent', `Proposal sent to ${lead.business_name} (${tier})`, {
      lead_id: leadId,
      tier,
      payment_url: paymentUrl,
    });

    // Discord notification (fire-and-forget)
    sendDiscordMessage({
      embeds: [{
        title: '\u{1F4E7} Proposal Sent',
        color: COLORS.success,
        fields: [
          { name: 'Lead', value: lead.business_name, inline: true },
          { name: 'Tier', value: tier, inline: true },
          { name: 'Email', value: lead.email, inline: true },
        ],
        footer: { text: `Lead #${leadId}` },
        timestamp: new Date().toISOString(),
      }],
    }).catch((e) => console.error('[proposals] Discord error:', e));

    return ok({ sent: true, lead_id: leadId, tier, message_id: emailResult.messageId });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[proposals/send] Error:', message);
    return err(message, 500);
  }
}
