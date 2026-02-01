/**
 * Offline Case Sync API Route
 * 
 * POST /api/cases/sync - Sync offline cases to server
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/next-auth.config';
import { createCase, type CreateCaseInput } from '@/features/cases/services/case.service';
import { getDeviceTypeFromUserAgent, getIpAddress } from '@/lib/utils/audit-logger';

/**
 * POST /api/cases/sync
 * Sync multiple offline cases to server
 */
export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const session = await auth();
    if (!session || !session.user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Parse request body
    const body = await request.json();
    const { cases } = body;

    if (!Array.isArray(cases) || cases.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Cases array is required' },
        { status: 400 }
      );
    }

    // Extract audit information
    const headers = request.headers;
    const ipAddress = getIpAddress(headers);
    const userAgent = headers.get('user-agent') || 'unknown';
    const deviceType = getDeviceTypeFromUserAgent(userAgent);

    const results = [];
    const errors = [];

    // Process each case
    for (const offlineCase of cases) {
      try {
        // Convert base64 photos to buffers
        const photoBuffers: Buffer[] = [];
        for (const photo of offlineCase.photos) {
          const base64Data = photo.includes('base64,') 
            ? photo.split('base64,')[1] 
            : photo;
          const buffer = Buffer.from(base64Data, 'base64');
          photoBuffers.push(buffer);
        }

        // Create case input
        const input: CreateCaseInput = {
          claimReference: offlineCase.claimReference,
          assetType: offlineCase.assetType,
          assetDetails: offlineCase.assetDetails,
          marketValue: offlineCase.marketValue,
          photos: photoBuffers,
          gpsLocation: offlineCase.gpsLocation,
          locationName: offlineCase.locationName,
          voiceNotes: offlineCase.voiceNotes,
          createdBy: session.user.id,
          status: offlineCase.status || 'pending_approval',
        };

        // Create case
        const result = await createCase(input, ipAddress, deviceType, userAgent);
        
        results.push({
          offlineCaseId: offlineCase.id,
          success: true,
          caseId: result.id,
        });
      } catch (error) {
        console.error('Error syncing case:', error);
        errors.push({
          offlineCaseId: offlineCase.id,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    return NextResponse.json(
      {
        success: true,
        data: {
          synced: results.length,
          failed: errors.length,
          results,
          errors,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error in POST /api/cases/sync:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to sync cases',
      },
      { status: 500 }
    );
  }
}
