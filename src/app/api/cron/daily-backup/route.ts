import { NextRequest, NextResponse } from 'next/server';
import { runDatabaseBackup } from '@/lib/maintenance/database-backup';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    return NextResponse.json({ error: 'Cron authentication is not configured' }, { status: 500 });
  }

  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const backup = await runDatabaseBackup({
      source: 'vercel-cron',
      uploadToSupabase: true,
    });

    return NextResponse.json({
      success: true,
      backup,
    });
  } catch (error) {
    console.error('[Daily Backup Cron] Failed:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown backup error',
      },
      { status: 500 }
    );
  }
}
