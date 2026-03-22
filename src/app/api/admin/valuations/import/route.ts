/**
 * Admin API: Bulk Import Valuations
 * 
 * POST /api/admin/valuations/import - Import valuations from CSV/JSON
 * 
 * Requirements: 8.1, 8.2, 8.3, 8.4, 8.5
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/next-auth.config';
import { bulkImportService } from '@/features/valuations/services/bulk-import.service';

/**
 * POST /api/admin/valuations/import
 * Import valuations from CSV or JSON file
 * Requirements: 8.1, 8.2, 8.3, 8.4, 8.5
 */
export async function POST(request: NextRequest) {
  try {
    // Check authentication and authorization
    const session = await auth();
    
    if (!session?.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }
    
    // Restrict to admin and manager roles (Requirement 8.1)
    if (session.user.role !== 'admin' && session.user.role !== 'manager') {
      return NextResponse.json(
        { error: 'Forbidden - Admin or Manager role required' },
        { status: 403 }
      );
    }

    // Parse form data
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const format = formData.get('format') as string;

    if (!file) {
      return NextResponse.json(
        { error: 'File is required' },
        { status: 400 }
      );
    }

    if (!format || !['csv', 'json'].includes(format)) {
      return NextResponse.json(
        { error: 'Format must be either "csv" or "json"' },
        { status: 400 }
      );
    }

    // Read file content
    const fileContent = await file.text();

    // Import based on format (Requirements: 8.1, 8.2)
    let result;
    if (format === 'csv') {
      result = await bulkImportService.importValuationsFromCSV(
        fileContent,
        session.user.id
      );
    } else {
      const data = JSON.parse(fileContent);
      result = await bulkImportService.importValuationsFromJSON(
        data,
        session.user.id
      );
    }

    // Return import summary (Requirements: 8.3, 8.5)
    return NextResponse.json({
      message: 'Import completed',
      summary: {
        total: result.totalRecords,
        success: result.successCount,
        updated: result.updateCount,
        failed: result.failureCount,
      },
      errors: result.errors,
    });
  } catch (error) {
    console.error('Error importing valuations:', error);
    
    if (error instanceof SyntaxError) {
      return NextResponse.json(
        { error: 'Invalid file format - unable to parse file' },
        { status: 400 }
      );
    }
    
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
