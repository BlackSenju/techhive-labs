// ── Activity logging to D1 ──
import { getDb } from './db';

export async function logActivity(
  action: string,
  details: string,
  metadata?: Record<string, unknown>,
): Promise<void> {
  try {
    const db = getDb();
    await db.prepare(
      'INSERT INTO activity_log (action, details, metadata) VALUES (?, ?, ?)',
    ).bind(
      action,
      details,
      metadata ? JSON.stringify(metadata) : null,
    ).run();
  } catch (error) {
    console.error('[activity] Failed to log:', error);
  }
}
