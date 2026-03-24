/**
 * Cron Job API Endpoint: Check Missing Documents
 * 
 * POST /api/cron/check-missing-documents
 * 
 * Triggers the missing documents checker to:
 * - Check all closed auctions for missing Bill of Sale or Liability Waiver
 * - Automatically regenerate any missing documents
 * - Log all actions for audit trail
 * - Handle errors gracefully
 * 
 * Schedule: Every 5 minutes (* /5 * * * *)
 * 
 * Security: Requires CRON_SECRET environment variable
 */

import { NextRequest, NextResponse } from 'next/server';
import { checkMissingDocuments } from '@/lib/cron/check-missing-documents';

export async function POST(request: NextRequest) {
  try {
    // Verify cron secret for security
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      console.error('❌ Unauthorized cron job attempt');
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    console.log('🔄 Starting missing documents check...');

    // Run the missing documents checker
    const result = await checkMissingDocuments();

    console.log('✅ Missing documents check completed successfully');

    return NextResponse.json({
      success: true,
      message: 'Missing documents check completed',
      timestamp: new Date().toISOString(),
      summary: {
        auctionsChecked: result.checked,
        documentsRegenerated: result.fixed,
        documentsFailed: result.failed,
        auctionsWithMissingDocs: result.results.length,
      },
      details: result.results,
    });
  } catch (error) {
    console.error('❌ Error in missing documents cron job:', error);
    
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to check missing documents',
        details: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}

// Allow GET for health check
export async function GET(request: NextRequest) {
  return NextResponse.json({
    status: 'ok',
    endpoint: 'check-missing-documents',
    description: 'Cron job to check for and regenerate missing auction documents',
    schedule: 'Every 5 minutes (* /5 * * * *)',
    documents: ['bill_of_sale', 'liability_waiver'],
    lastRun: 'Not tracked yet',
  });
}
