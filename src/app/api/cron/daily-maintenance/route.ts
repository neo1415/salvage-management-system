import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

type MaintenanceJob = {
  name: string;
  path: string;
  method?: 'GET' | 'POST';
  required?: boolean;
};

const DAILY_JOBS: MaintenanceJob[] = [
  { name: 'database-backup', path: '/api/cron/daily-backup', method: 'GET', required: false },
  { name: 'auction-closure', path: '/api/cron/auction-closure', method: 'GET', required: true },
  { name: 'start-scheduled-auctions', path: '/api/cron/start-scheduled-auctions', method: 'GET', required: true },
  { name: 'check-payment-deadlines', path: '/api/cron/check-payment-deadlines', method: 'GET', required: true },
  { name: 'payment-deadlines', path: '/api/cron/payment-deadlines', method: 'GET', required: true },
  { name: 'check-overdue-payments', path: '/api/cron/check-overdue-payments', method: 'POST', required: true },
  { name: 'check-document-deadlines', path: '/api/cron/check-document-deadlines', method: 'GET', required: true },
  { name: 'check-missing-documents', path: '/api/cron/check-missing-documents', method: 'POST', required: true },
  { name: 'pickup-reminders', path: '/api/cron/pickup-reminders', method: 'GET', required: false },
  { name: 'kyc-expiry', path: '/api/cron/kyc-expiry', method: 'GET', required: false },
  { name: 'detect-fraud', path: '/api/cron/detect-fraud', method: 'GET', required: false },
  { name: 'fraud-auto-suspend', path: '/api/cron/fraud-auto-suspend', method: 'POST', required: false },
  { name: 'reconcile-wallets', path: '/api/cron/reconcile-wallets', method: 'GET', required: true },
  { name: 'verify-wallet-invariants', path: '/api/cron/verify-wallet-invariants', method: 'GET', required: false },
  { name: 'reconcile-paystack-transactions', path: '/api/cron/reconcile-paystack-transactions', method: 'GET', required: true },
  { name: 'refresh-ledger-summary', path: '/api/cron/refresh-ledger-summary', method: 'GET', required: false },
  { name: 'leaderboard-update', path: '/api/cron/leaderboard-update', method: 'GET', required: false },
  { name: 'update-vendor-ratings', path: '/api/cron/update-vendor-ratings', method: 'GET', required: false },
  { name: 'execute-scheduled-reports', path: '/api/cron/execute-scheduled-reports', method: 'GET', required: false },
];

async function runJob(request: NextRequest, job: MaintenanceJob, cronSecret: string) {
  const startedAt = Date.now();
  const url = new URL(job.path, request.url);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 45_000);

  try {
    const response = await fetch(url, {
      method: job.method ?? 'GET',
      headers: {
        authorization: `Bearer ${cronSecret}`,
      },
      cache: 'no-store',
      signal: controller.signal,
    });

    const text = await response.text();
    let body: unknown = null;
    try {
      body = text ? JSON.parse(text) : null;
    } catch {
      body = text.slice(0, 500);
    }

    return {
      name: job.name,
      path: job.path,
      method: job.method ?? 'GET',
      required: job.required ?? false,
      ok: response.ok,
      status: response.status,
      durationMs: Date.now() - startedAt,
      body,
    };
  } catch (error) {
    return {
      name: job.name,
      path: job.path,
      method: job.method ?? 'GET',
      required: job.required ?? false,
      ok: false,
      status: 0,
      durationMs: Date.now() - startedAt,
      error: error instanceof Error ? error.message : 'Unknown job error',
    };
  } finally {
    clearTimeout(timeout);
  }
}

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    return NextResponse.json({ error: 'Cron authentication is not configured' }, { status: 500 });
  }

  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const results = [];
  for (const job of DAILY_JOBS) {
    results.push(await runJob(request, job, cronSecret));
  }

  const failedRequiredJobs = results.filter((result) => result.required && !result.ok);
  const failedOptionalJobs = results.filter((result) => !result.required && !result.ok);

  return NextResponse.json(
    {
      success: failedRequiredJobs.length === 0,
      timestamp: new Date().toISOString(),
      summary: {
        total: results.length,
        passed: results.filter((result) => result.ok).length,
        failedRequired: failedRequiredJobs.length,
        failedOptional: failedOptionalJobs.length,
      },
      results,
    },
    { status: failedRequiredJobs.length === 0 ? 200 : 500 }
  );
}
