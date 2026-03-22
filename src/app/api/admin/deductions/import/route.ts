/**
 * Admin API: Bulk Import Damage Deductions
 * 
 * POST /api/admin/deductions/import - Import deductions from CSV/JSON
 * 
 * Requirements: 8.6
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/next-auth.config';
import { bulkImportService } from '@/features/valuations/services/bulk-import.service';

/**
 * POST /api/admin/deductions/import
 * Import deductions from CSV or JSON file
 * Requirements: 8.6
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
    
    // Restrict to admin and manager roles
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

    // Import based on format
    let result;
    if (format === 'csv') {
      result = await bulkImportService.importDeductionsFromCSV(
        fileContent,
        session.user.id
      );
    } else {
      const data = JSON.parse(fileContent);
      result = await bulkImportService.importDeductionsFromJSON(
        data,
        session.user.id
      );
    }

    // Return import summary
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
    console.error('Error importing deductions:', error);
    
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
