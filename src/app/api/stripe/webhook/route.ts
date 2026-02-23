// ── POST /api/stripe/webhook — Handle checkout.session.completed ──
import { NextRequest } from 'next/server';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { getDb } from '@/lib/db';
import { verifyStripeSignature } from '@/lib/stripe-webhook-verify';
import { sendEmail } from '@/lib/sendgrid';
import { sendDiscordMessage } from '@/lib/discord';
import { logActivity } from '@/lib/activity';
import { getPaymentConfirmEmail, type ProposalLead } from '@/lib/proposal-templates';
import { COLORS } from '@/lib/constants';
import type { Lead, PaymentLink } from '@/lib/types';

export async function POST(request: NextRequest) {
  try {
    const { env } = getCloudflareContext();
    const rawBody = await request.text();
    const sigHeader = request.headers.get('stripe-signature');

    if (!sigHeader) {
      return new Response(JSON.stringify({ error: 'Missing stripe-signature header' }), { status: 400 });
    }

    // Verify signature
    const verification = await verifyStripeSignature(rawBody, sigHeader, env.STRIPE_WEBHOOK_SECRET);
    if (!verification.valid) {
      console.error('[webhook] Signature verification failed:', verification.error);
      return new Response(JSON.stringify({ error: verification.error }), { status: 401 });
    }

    const event = JSON.parse(rawBody) as {
      id: string;
      type: string;
      data: { object: Record<string, unknown> };
    };

    const db = getDb();

    // Dedup check
    const existing = await db.prepare(
      'SELECT id FROM webhook_events WHERE stripe_event_id = ?',
    ).bind(event.id).first();

    if (existing) {
      return new Response(JSON.stringify({ received: true, duplicate: true }), { status: 200 });
    }

    // Record event
    await db.prepare(
      'INSERT INTO webhook_events (stripe_event_id, event_type, processed) VALUES (?, ?, 0)',
    ).bind(event.id, event.type).run();

    // Only handle checkout.session.completed
    if (event.type !== 'checkout.session.completed') {
      return new Response(JSON.stringify({ received: true, handled: false }), { status: 200 });
    }

    // Process checkout session
    const session = event.data.object;
    const paymentLinkId = session.payment_link as string | null;
    const customerDetails = session.customer_details as Record<string, unknown> | null;
    const customerEmail = (customerDetails?.email as string | null)?.toLowerCase();

    if (!paymentLinkId || !customerEmail) {
      await logActivity('webhook_no_match', `Missing payment_link or email`, {
        event_id: event.id,
        payment_link: paymentLinkId,
        email: customerEmail,
      });
      await db.prepare('UPDATE webhook_events SET processed = 1 WHERE stripe_event_id = ?')
        .bind(event.id).run();
      return new Response(JSON.stringify({ received: true, handled: false }), { status: 200 });
    }

    // Look up payment link
    const linkRow = await db.prepare(
      'SELECT tier, link_type, price_cents FROM payment_links WHERE stripe_link_id = ? AND active = 1',
    ).bind(paymentLinkId).first<Pick<PaymentLink, 'tier' | 'link_type' | 'price_cents'>>();

    if (!linkRow) {
      // Not a Labs payment link — ignore
      await db.prepare('UPDATE webhook_events SET processed = 1 WHERE stripe_event_id = ?')
        .bind(event.id).run();
      return new Response(JSON.stringify({ received: true, handled: false }), { status: 200 });
    }

    // Find matching lead
    const lead = await db.prepare(
      'SELECT * FROM leads WHERE email = ? ORDER BY id DESC LIMIT 1',
    ).bind(customerEmail).first<Lead>();

    if (!lead) {
      await logActivity('webhook_lead_not_found', `Payment from ${customerEmail} but no matching lead`, {
        event_id: event.id,
        tier: linkRow.tier,
        link_type: linkRow.link_type,
      });
      await db.prepare('UPDATE webhook_events SET processed = 1 WHERE stripe_event_id = ?')
        .bind(event.id).run();
      return new Response(JSON.stringify({ received: true, handled: false }), { status: 200 });
    }

    // Determine payment state
    const newAmountCents = lead.payment_amount_cents + linkRow.price_cents;
    const isFullPayment = linkRow.link_type === 'full' || linkRow.link_type === 'final';
    const isDeposit = linkRow.link_type === 'deposit';
    const newPaymentStatus = isFullPayment ? 'fully_paid' : 'deposit_paid';
    const newStage = isFullPayment ? 'closed_won' : 'contracted';

    // Update lead
    const closedClause = isFullPayment ? "closed_at = datetime('now')," : '';
    await db.prepare(`
      UPDATE leads
      SET payment_status = ?,
          payment_amount_cents = ?,
          stage = ?,
          ${closedClause}
          updated_at = datetime('now')
      WHERE id = ?
    `).bind(newPaymentStatus, newAmountCents, newStage, lead.id).run();

    // Record payment
    await db.prepare(
      'INSERT INTO payments (lead_id, stripe_event_id, stripe_link_id, tier, link_type, amount_cents, customer_email) VALUES (?, ?, ?, ?, ?, ?, ?)',
    ).bind(lead.id, event.id, paymentLinkId, linkRow.tier, linkRow.link_type, linkRow.price_cents, customerEmail).run();

    // Mark event processed
    await db.prepare('UPDATE webhook_events SET processed = 1 WHERE stripe_event_id = ?')
      .bind(event.id).run();

    await logActivity('payment_received', `${lead.business_name}: $${(linkRow.price_cents / 100).toFixed(0)} (${linkRow.tier}/${linkRow.link_type})`, {
      lead_id: lead.id,
      tier: linkRow.tier,
      link_type: linkRow.link_type,
      amount_cents: linkRow.price_cents,
      total_paid_cents: newAmountCents,
      payment_status: newPaymentStatus,
    });

    // Confirmation email (fire-and-forget)
    const proposalLead: ProposalLead = {
      id: lead.id,
      business_name: lead.business_name,
      email: lead.email,
      category: lead.category || linkRow.tier,
    };
    const { subject, body } = getPaymentConfirmEmail(proposalLead, isDeposit);
    sendEmail({ to: lead.email, subject, body }).catch((e) => {
      console.error('[webhook] Confirmation email failed:', e);
    });

    // Discord notification (fire-and-forget)
    sendDiscordMessage({
      embeds: [{
        title: '\u{1F4B0} Labs Payment Received',
        color: COLORS.success,
        fields: [
          { name: 'Lead', value: lead.business_name, inline: true },
          { name: 'Tier', value: linkRow.tier, inline: true },
          { name: 'Amount', value: `$${(linkRow.price_cents / 100).toFixed(0)}`, inline: true },
          { name: 'Type', value: linkRow.link_type, inline: true },
          { name: 'Status', value: newPaymentStatus, inline: true },
          { name: 'Stage', value: newStage, inline: true },
        ],
        footer: { text: `Lead #${lead.id} \u2022 ${event.id}` },
        timestamp: new Date().toISOString(),
      }],
    }).catch((e) => console.error('[webhook] Discord error:', e));

    return new Response(JSON.stringify({ received: true, handled: true }), { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[stripe/webhook] Error:', message);
    return new Response(JSON.stringify({ error: message }), { status: 500 });
  }
}
