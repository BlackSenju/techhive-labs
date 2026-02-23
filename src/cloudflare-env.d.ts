// ── Cloudflare Workers type declarations for TechHive Labs ──

interface D1Database {
  prepare(query: string): D1PreparedStatement;
  batch<T = unknown>(statements: D1PreparedStatement[]): Promise<D1Result<T>[]>;
  exec(query: string): Promise<D1ExecResult>;
}

interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement;
  first<T = unknown>(colName?: string): Promise<T | null>;
  run(): Promise<D1Result>;
  all<T = unknown>(): Promise<D1Results<T>>;
}

interface D1Result<T = unknown> {
  results?: T[];
  success: boolean;
  error?: string;
  meta: {
    duration: number;
    last_row_id: number;
    changes: number;
    served_by: string;
    internal_stats: unknown;
  };
}

interface D1Results<T = unknown> {
  results: T[];
  success: boolean;
  meta: D1Result['meta'];
}

interface D1ExecResult {
  count: number;
  duration: number;
}

interface ExecutionContext {
  waitUntil(promise: Promise<unknown>): void;
  passThroughOnException(): void;
}

interface Fetcher {
  fetch(input: RequestInfo, init?: RequestInit): Promise<Response>;
}

interface CloudflareEnv {
  DB: D1Database;
  SENDGRID_API_KEY: string;
  STRIPE_READ_KEY: string;
  STRIPE_WRITE_KEY: string;
  STRIPE_WEBHOOK_SECRET: string;
  DISCORD_WEBHOOK_URL: string;
  API_SECRET: string;
  ASSETS: Fetcher;
}

declare module '@opennextjs/cloudflare' {
  export function getCloudflareContext(): { env: CloudflareEnv; ctx: ExecutionContext };
  export function initOpenNextCloudflareForDev(): void;
  export function defineCloudflareConfig(config: Record<string, unknown>): Record<string, unknown>;
}
