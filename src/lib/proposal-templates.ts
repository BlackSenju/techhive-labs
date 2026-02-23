// ── Proposal, follow-up, and confirmation email templates ──
import { getDb } from './db';
import { TIER_DETAILS, type TierKey } from './constants';
import type { Lead, PaymentLink, LinkType } from './types';

export interface ProposalLead {
  readonly id: number;
  readonly business_name: string;
  readonly email: string;
  readonly category: string;
}

// ── Payment link lookup (D1 async) ──

export async function getPaymentLink(
  tier: string,
  linkType: LinkType,
): Promise<string | null> {
  const db = getDb();
  const row = await db.prepare(
    'SELECT stripe_url FROM payment_links WHERE tier = ? AND link_type = ? AND active = 1 LIMIT 1',
  ).bind(tier, linkType).first<Pick<PaymentLink, 'stripe_url'>>();

  return row?.stripe_url ?? null;
}

// ── Proposal email ──

export function getProposalEmail(
  lead: ProposalLead,
  paymentUrl: string,
): { subject: string; body: string } {
  const tier = (lead.category || 'pro') as TierKey;
  const details = TIER_DETAILS[tier] ?? TIER_DETAILS.pro;

  const subject = `Your ${details.name} Package — TechHive Labs`;

  const outcomes = details.outcomes.map((o) => `  - ${o}`).join('\n');

  const body = `Hi ${lead.business_name},

Thanks for reaching out to TechHive Labs. Based on what you shared, here's what we can deliver:

${details.name} Package — $${details.price}
${'-'.repeat(40)}

What's included:
${outcomes}

Timeline: ${details.timeline}
Revisions: ${details.revisions}
Investment: $${details.price} (${details.upfront})

Ready to get started? Lock in your spot here:
${paymentUrl}

Once payment is confirmed, we'll send you an onboarding form within 24 hours to kick things off.

Questions? Just reply to this email.

— TechHive Labs`;

  return { subject, body };
}

// ── Follow-up email (24h nudge) ──

export function getFollowUpEmail(
  lead: ProposalLead,
  paymentUrl: string,
): { subject: string; body: string } {
  const tier = (lead.category || 'pro') as TierKey;
  const details = TIER_DETAILS[tier] ?? TIER_DETAILS.pro;

  const subject = `Quick follow-up — ${details.name} Package`;

  const body = `Hi ${lead.business_name},

Just following up on the ${details.name} Package proposal we sent yesterday.

We're currently taking on a limited number of projects this month, and I wanted to make sure your spot is still available.

Here's the link to get started:
${paymentUrl}

If you have any questions or want to adjust the scope, just reply here — happy to chat.

— TechHive Labs`;

  return { subject, body };
}

// ── Payment confirmation email ──

export function getPaymentConfirmEmail(
  lead: ProposalLead,
  isDeposit: boolean,
): { subject: string; body: string } {
  const subject = isDeposit
    ? 'Deposit received — you\'re locked in!'
    : 'Payment confirmed — let\'s get started!';

  const nextSteps = isDeposit
    ? `Your deposit has been received. Here's what happens next:

  1. You'll receive an onboarding form within 24 hours
  2. We'll schedule a kickoff call
  3. Work begins immediately after onboarding

The remaining balance will be due upon project completion.`
    : `Your payment has been confirmed. Here's what happens next:

  1. You'll receive an onboarding form within 24 hours
  2. We'll schedule a kickoff call
  3. Work begins immediately after onboarding`;

  const body = `Hi ${lead.business_name},

${nextSteps}

We're excited to work with you. If you have any questions in the meantime, just reply to this email.

— TechHive Labs`;

  return { subject, body };
}
