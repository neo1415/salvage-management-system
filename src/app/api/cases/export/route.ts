/**
 * Cases Export API Route
 * 
 * GET /api/cases/export - Export cases to CSV or PDF
 * 
 * Requirements: 13.1, 13.2, 13.3, 13.4, 13.5, 13.7, 16.1, 16.2, 16.3, 16.4, 16.5, 16.7
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/next-auth.config';
import { ExportService } from '@/features/export/services/export.service';
import { db } from '@/lib/db/drizzle';
import { salvageCases } from '@/lib/db/schema/cases';
import { users } from '@/lib/db/schema/users';
import { eq, desc, and, like, or, inArray } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';

/**
 * GET /api/cases/export
 * Export cases to CSV or PDF
 * 
 * Query parameters:
 * - format: 'csv' | 'pdf' (required)
 * - status: Filter by case status (optional)
 * - search: Search query (optional)
 * - createdByMe: 'true' to filter by current user (optional)
 */
export async function GET(request: NextRequest) {
  try {
    // Check authentication
    const session = await auth();
    if (!session || !session.user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Parse query parameters
    const searchParams = request.nextUrl.searchParams;
    const format = searchParams.get('format') as 'csv' | 'pdf';
    const status = searchParams.get('status');
    const search = searchParams.get('search');
    const createdByMe = searchParams.get('createdByMe') === 'true';

    // Validate format
    if (!format || !['csv', 'pdf'].includes(format)) {
      return NextResponse.json(
        { success: false, error: 'Invalid format. Must be csv or pdf' },
        { status: 400 }
      );
    }

    // Create table alias for adjuster
    const adjusterUsers = alias(users, 'adjuster_users');

    // Build query
    const baseQuery = db
      .select({
        claimReference: salvageCases.claimReference,
        assetType: salvageCases.assetType,
        assetDetails: salvageCases.assetDetails,
        status: salvageCases.status,
        createdAt: salvageCases.createdAt,
        adjusterName: adjusterUsers.fullName,
        marketValue: salvageCases.marketValue,
        reservePrice: salvageCases.reservePrice,
        locationName: salvageCases.locationName,
        damageSeverity: salvageCases.damageSeverity,
      })
      .from(salvageCases)
      .leftJoin(adjusterUsers, eq(salvageCases.createdBy, adjusterUsers.id));

    // Build where conditions
    const whereConditions = [];

    // Filter by status if provided
    if (status && status !== 'all') {
      whereConditions.push(eq(salvageCases.status, status as any));
    }

    // Filter by creator if requested
    if (createdByMe) {
      whereConditions.push(eq(salvageCases.createdBy, session.user.id));
    }

    // Search filter
    if (search) {
      const searchLower = search.toLowerCase();
      whereConditions.push(
        or(
          like(salvageCases.claimReference, `%${searchLower}%`),
          like(salvageCases.assetType, `%${searchLower}%`),
          like(salvageCases.locationName, `%${searchLower}%`)
        )!
      );
    }

    // Apply filters
    let query;
    if (whereConditions.length > 0) {
      query = baseQuery
        .where(and(...whereConditions))
        .orderBy(desc(salvageCases.createdAt));
    } else {
      query = baseQuery.orderBy(desc(salvageCases.createdAt));
    }

    // Execute query
    const cases = await query;

    // Check if there's data to export
    if (cases.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No data to export' },
        { status: 400 }
      );
    }

    // Define export columns
    const columns = [
      { key: 'claimReference', header: 'Claim Reference' },
      { 
        key: 'assetType', 
        header: 'Asset Type',
        format: (value: string) => value.charAt(0).toUpperCase() + value.slice(1)
      },
      { 
        key: 'status', 
        header: 'Status',
        format: (value: string) => {
          const statusMap: Record<string, string> = {
            draft: 'Draft',
            pending_approval: 'Pending Approval',
            approved: 'Approved',
            active_auction: 'Active Auction',
            sold: 'Sold',
            cancelled: 'Cancelled',
          };
          return statusMap[value] || value;
        }
      },
      { 
        key: 'createdAt', 
        header: 'Created Date',
        format: (value: Date) => new Date(value).toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
        })
      },
      { 
        key: 'marketValue', 
        header: 'Market Value',
        format: (value: number) => `₦${value.toLocaleString()}`
      },
      { 
        key: 'reservePrice', 
        header: 'Reserve Price',
        format: (value: number | null) => value ? `₦${value.toLocaleString()}` : 'N/A'
      },
      { key: 'locationName', header: 'Location' },
      { 
        key: 'damageSeverity', 
        header: 'Damage Severity',
        format: (value: string | null) => {
          if (!value || value === 'none') return 'Not Assessed';
          return value.charAt(0).toUpperCase() + value.slice(1);
        }
      },
    ];

    // Generate filename
    const basename = createdByMe ? 'my-cases' : `cases-${status && status !== 'all' ? status : 'all'}`;
    const filename = ExportService.generateFilename(basename, format);

    // Generate export based on format
    if (format === 'csv') {
      const csv = ExportService.generateCSV({
        filename,
        columns,
        data: cases,
      });

      return new NextResponse(csv, {
        status: 200,
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="${filename}"`,
        },
      });
    } else {
      // PDF export
      const pdfBuffer = await ExportService.generatePDF({
        filename,
        columns,
        data: cases,
        title: 'Cases Export',
      });

      return new NextResponse(pdfBuffer as any, {
        status: 200,
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="${filename}"`,
        },
      });
    }
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
