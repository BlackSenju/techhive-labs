// ── GET /api/leads — List all leads (authed) ──
import { NextRequest } from 'next/server';
import { getDb } from '@/lib/db';
import { isAuthorized } from '@/lib/auth';
import { ok, unauthorized, err } from '@/lib/api-response';
import type { Lead } from '@/lib/types';

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) return unauthorized();

  try {
    const db = getDb();
    const url = new URL(request.url);
    const stage = url.searchParams.get('stage');
    const status = url.searchParams.get('review_status');

    let query = 'SELECT * FROM leads';
    const conditions: string[] = [];
    const params: string[] = [];

    if (stage) {
      conditions.push('stage = ?');
      params.push(stage);
    }
    if (status) {
      conditions.push('review_status = ?');
      params.push(status);
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }

    query += ' ORDER BY created_at DESC LIMIT 100';

    const stmt = db.prepare(query);
    const bound = params.length > 0 ? stmt.bind(...params) : stmt;
    const { results } = await bound.all<Lead>();

    return ok({ leads: results, count: results.length });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[leads] Error:', message);
    return err(message, 500);
  }
}
