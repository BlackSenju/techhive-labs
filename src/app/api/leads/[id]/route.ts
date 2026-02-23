// ── PATCH /api/leads/:id — Approve/reject lead + auto-send proposal ──
import { NextRequest } from 'next/server';
import { getDb } from '@/lib/db';
import { isAuthorized } from '@/lib/auth';
import { logActivity } from '@/lib/activity';
import { ok, unauthorized, err } from '@/lib/api-response';
import type { Lead, ReviewStatus } from '@/lib/types';

const VALID_STATUSES: ReadonlySet<string> = new Set([
  'approved', 'rejected', 'edit_needed', 'pending_review',
]);

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!isAuthorized(request)) return unauthorized();

  try {
    const { id } = await params;
    const leadId = parseInt(id, 10);
    if (isNaN(leadId)) return err('Invalid lead ID');

    const body = await request.json() as Record<string, unknown>;
    const newStatus = String(body.review_status ?? '');
    const notes = String(body.review_notes ?? '');

    if (!VALID_STATUSES.has(newStatus)) {
      return err(`Invalid status. Must be one of: ${[...VALID_STATUSES].join(', ')}`);
    }

    const db = getDb();

    // Check lead exists
    const lead = await db.prepare('SELECT * FROM leads WHERE id = ?')
      .bind(leadId).first<Lead>();
    if (!lead) return err('Lead not found', 404);

    // Update review status
    await db.prepare(
      "UPDATE leads SET review_status = ?, review_notes = ?, reviewed_at = datetime('now'), updated_at = datetime('now') WHERE id = ?",
    ).bind(newStatus, notes, leadId).run();

    await logActivity('lead_reviewed', `Lead #${leadId} → ${newStatus}`, {
      lead_id: leadId,
      old_status: lead.review_status,
      new_status: newStatus,
    });

    // Auto-send proposal on approval
    if (newStatus === 'approved') {
      // Fire-and-forget internal call to proposal sender
      const baseUrl = new URL(request.url).origin;
      fetch(`${baseUrl}/api/proposals/send`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: request.headers.get('Authorization') ?? '',
        },
        body: JSON.stringify({ lead_id: leadId }),
      }).catch((e) => {
        console.error('[leads] Proposal sender chain error:', e);
      });
    }

    // Fetch updated lead
    const updated = await db.prepare('SELECT * FROM leads WHERE id = ?')
      .bind(leadId).first<Lead>();

    return ok({ lead: updated });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[leads] Error:', message);
    return err(message, 500);
  }
}
