// ── Consistent API response helpers ──
import { NextResponse } from 'next/server';
import type { ApiResponse } from './types';

export function ok<T>(data: T): NextResponse<ApiResponse<T>> {
  return NextResponse.json({ success: true, data, error: null });
}

export function err(message: string, status = 400): NextResponse<ApiResponse<null>> {
  return NextResponse.json(
    { success: false, data: null, error: message },
    { status },
  );
}

export function unauthorized(): NextResponse<ApiResponse<null>> {
  return err('Unauthorized', 401);
}
