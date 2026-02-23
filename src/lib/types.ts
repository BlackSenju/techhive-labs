// ── TechHive Labs — Core type definitions ──

export interface Contact {
  readonly id: number;
  readonly name: string;
  readonly email: string;
  readonly message: string;
  readonly source: string;
  readonly created_at: string;
}

export interface Lead {
  readonly id: number;
  readonly business_name: string;
  readonly email: string;
  readonly category: string;
  readonly message: string;
  readonly score: number;
  readonly stage: string;
  readonly review_status: string;
  readonly review_notes: string | null;
  readonly reviewed_at: string | null;
  readonly proposal_sent_at: string | null;
  readonly proposal_message_id: string | null;
  readonly payment_status: string;
  readonly payment_amount_cents: number;
  readonly follow_up_sent_at: string | null;
  readonly follow_up_message_id: string | null;
  readonly closed_at: string | null;
  readonly send_error: string | null;
  readonly created_at: string;
  readonly updated_at: string;
}

export interface PaymentLink {
  readonly id: number;
  readonly tier: string;
  readonly link_type: string;
  readonly stripe_product_id: string | null;
  readonly stripe_price_id: string | null;
  readonly stripe_link_id: string;
  readonly stripe_url: string;
  readonly price_cents: number;
  readonly active: number;
  readonly created_at: string;
}

export interface Proposal {
  readonly id: number;
  readonly lead_id: number;
  readonly tier: string;
  readonly payment_url: string;
  readonly email_message_id: string | null;
  readonly sent_at: string;
}

export interface Payment {
  readonly id: number;
  readonly lead_id: number;
  readonly stripe_event_id: string;
  readonly stripe_link_id: string;
  readonly tier: string;
  readonly link_type: string;
  readonly amount_cents: number;
  readonly customer_email: string;
  readonly created_at: string;
}

export type ReviewStatus = 'pending_review' | 'approved' | 'rejected' | 'edit_needed';
export type PaymentStatus = 'none' | 'pending' | 'deposit_paid' | 'fully_paid';
export type Stage = 'new' | 'contacted' | 'contracted' | 'closed_won' | 'closed_lost';
export type Tier = 'starter' | 'pro' | 'business';
export type LinkType = 'full' | 'deposit' | 'final';

export interface ApiResponse<T = unknown> {
  readonly success: boolean;
  readonly data: T | null;
  readonly error: string | null;
}
