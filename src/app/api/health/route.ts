// ── GET /api/health — Health check endpoint ──
import { getDb } from '@/lib/db';
import { ok, err } from '@/lib/api-response';

export async function GET() {
  try {
    const db = getDb();

    // Quick DB check
    const result = await db.prepare('SELECT COUNT(*) as count FROM leads').first<{ count: number }>();

    return ok({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      db: { connected: true, lead_count: result?.count ?? 0 },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return err(`Unhealthy: ${message}`, 503);
  }
}
