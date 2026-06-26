/**
 * Cases Export API Route
 *
 * GET /api/cases/export - Export cases to CSV or PDF
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/next-auth.config';
import { ExportService } from '@/features/export/services/export.service';
import {
  CASE_EXPORT_COLUMNS,
  mapCaseToExportRow,
  type CaseExportSource,
} from '@/lib/export/case-export';
import { db } from '@/lib/db/drizzle';
import { salvageCases } from '@/lib/db/schema/cases';
import { users } from '@/lib/db/schema/users';
import { eq, desc, and, like, or } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const format = searchParams.get('format') as 'csv' | 'pdf';
    const status = searchParams.get('status');
    const search = searchParams.get('search');
    const createdByMe = searchParams.get('createdByMe') === 'true';

    if (!format || !['csv', 'pdf'].includes(format)) {
      return NextResponse.json(
        { success: false, error: 'Invalid format. Must be csv or pdf' },
        { status: 400 }
      );
    }

    const adjusterUsers = alias(users, 'adjuster_users');
    const approverUsers = alias(users, 'approver_users');

    const baseQuery = db
      .select({
        id: salvageCases.id,
        claimReference: salvageCases.claimReference,
        policyNumber: salvageCases.policyNumber,
        insuranceClass: salvageCases.insuranceClass,
        brokerName: salvageCases.brokerName,
        agencyName: salvageCases.agencyName,
        branchName: salvageCases.branchName,
        assetType: salvageCases.assetType,
        assetDetails: salvageCases.assetDetails,
        marketValue: salvageCases.marketValue,
        estimatedSalvageValue: salvageCases.estimatedSalvageValue,
        reservePrice: salvageCases.reservePrice,
        damageSeverity: salvageCases.damageSeverity,
        gpsLocation: salvageCases.gpsLocation,
        locationName: salvageCases.locationName,
        locationAccuracyMeters: salvageCases.locationAccuracyMeters,
        locationSource: salvageCases.locationSource,
        locationCapturedAt: salvageCases.locationCapturedAt,
        locationManualOverride: salvageCases.locationManualOverride,
        photos: salvageCases.photos,
        voiceNotes: salvageCases.voiceNotes,
        status: salvageCases.status,
        createdBy: salvageCases.createdBy,
        approvedBy: salvageCases.approvedBy,
        createdAt: salvageCases.createdAt,
        updatedAt: salvageCases.updatedAt,
        approvedAt: salvageCases.approvedAt,
        vehicleMileage: salvageCases.vehicleMileage,
        vehicleCondition: salvageCases.vehicleCondition,
        aiAssessment: salvageCases.aiAssessment,
        aiEstimates: salvageCases.aiEstimates,
        managerOverrides: salvageCases.managerOverrides,
        createdByName: adjusterUsers.fullName,
        approvedByName: approverUsers.fullName,
      })
      .from(salvageCases)
      .leftJoin(adjusterUsers, eq(salvageCases.createdBy, adjusterUsers.id))
      .leftJoin(approverUsers, eq(salvageCases.approvedBy, approverUsers.id));

    const whereConditions = [];

    if (status && status !== 'all') {
      whereConditions.push(eq(salvageCases.status, status as 'draft' | 'pending_approval' | 'approved' | 'active_auction' | 'sold' | 'cancelled'));
    }

    if (createdByMe) {
      whereConditions.push(eq(salvageCases.createdBy, session.user.id));
    }

    if (search) {
      const searchLower = search.toLowerCase();
      whereConditions.push(
        or(
          like(salvageCases.claimReference, `%${searchLower}%`),
          like(salvageCases.assetType, `%${searchLower}%`),
          like(salvageCases.locationName, `%${searchLower}%`),
          like(salvageCases.policyNumber, `%${searchLower}%`),
          like(salvageCases.branchName, `%${searchLower}%`),
          like(salvageCases.brokerName, `%${searchLower}%`),
          like(salvageCases.agencyName, `%${searchLower}%`)
        )!
      );
    }

    const cases = await (whereConditions.length > 0
      ? baseQuery.where(and(...whereConditions)).orderBy(desc(salvageCases.createdAt))
      : baseQuery.orderBy(desc(salvageCases.createdAt)));

    if (cases.length === 0) {
      return NextResponse.json({ success: false, error: 'No data to export' }, { status: 400 });
    }

    const exportRows = cases.map((row) => mapCaseToExportRow(row as CaseExportSource));

    const basename = createdByMe ? 'my-cases' : `cases-${status && status !== 'all' ? status : 'all'}`;
    const filename = ExportService.generateFilename(basename, format);

    if (format === 'csv') {
      const csv = ExportService.generateCSV({
        filename,
        columns: CASE_EXPORT_COLUMNS,
        data: exportRows,
      });

      return new NextResponse(csv, {
        status: 200,
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="${filename}"`,
        },
      });
    }

    const pdfBuffer = await ExportService.generatePDF({
      filename,
      columns: CASE_EXPORT_COLUMNS,
      data: exportRows,
      title: 'Cases Export',
    });

    return new NextResponse(pdfBuffer as unknown as BodyInit, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error('Error in GET /api/cases/export:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to export cases',
      },
      { status: 500 }
    );
  }
}
