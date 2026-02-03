import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/next-auth.config';
import { db } from '@/lib/db/drizzle';
import { auditLogs } from '@/lib/db/schema/audit-logs';
import { users } from '@/lib/db/schema/users';
import { eq, and, gte, lte, desc, sql, or } from 'drizzle-orm';

/**
 * GET /api/admin/audit-logs
 * 
 * Retrieve audit logs with filtering, pagination, and export support
 * 
 * Query Parameters:
 * - userId: Filter by user ID
 * - actionType: Filter by action type
 * - entityType: Filter by entity type
 * - startDate: Filter by start date (ISO 8601)
 * - endDate: Filter by end date (ISO 8601)
 * - page: Page number (default: 1)
 * - limit: Items per page (default: 50, max: 100)
 * - export: Export format ('csv' or 'excel')
 * 
 * Requirements: 11, Enterprise Standards Section 6.4
 */
export async function GET(request: NextRequest) {
  try {
    // Check authentication
    const session = await auth();
    
    if (!session?.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }
    
    // Check if user is admin
    if (session.user.role !== 'system_admin') {
      return NextResponse.json(
        { error: 'Forbidden - Admin access required' },
        { status: 403 }
      );
    }
    
    // Parse query parameters
    const searchParams = request.nextUrl.searchParams;
    const userId = searchParams.get('userId');
    const actionType = searchParams.get('actionType');
    const entityType = searchParams.get('entityType');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 100);
    const exportFormat = searchParams.get('export');
    
    // Build filter conditions
    const conditions = [];
    
    if (userId) {
      conditions.push(eq(auditLogs.userId, userId));
    }
    
    if (actionType) {
      conditions.push(eq(auditLogs.actionType, actionType));
    }
    
    if (entityType) {
      conditions.push(eq(auditLogs.entityType, entityType));
    }
    
    if (startDate) {
      const start = new Date(startDate);
      if (!isNaN(start.getTime())) {
        conditions.push(gte(auditLogs.createdAt, start));
      }
    }
    
    if (endDate) {
      const end = new Date(endDate);
      if (!isNaN(end.getTime())) {
        conditions.push(lte(auditLogs.createdAt, end));
      }
    }
    
    // Build where clause
    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
    
    // Handle export
    if (exportFormat === 'csv' || exportFormat === 'excel') {
      // Fetch all matching logs (no pagination for export)
      const logs = await db
        .select({
          id: auditLogs.id,
          userId: auditLogs.userId,
          userName: users.fullName,
          userEmail: users.email,
          actionType: auditLogs.actionType,
          entityType: auditLogs.entityType,
          entityId: auditLogs.entityId,
          ipAddress: auditLogs.ipAddress,
          deviceType: auditLogs.deviceType,
          userAgent: auditLogs.userAgent,
          createdAt: auditLogs.createdAt,
        })
        .from(auditLogs)
        .leftJoin(users, eq(auditLogs.userId, users.id))
        .where(whereClause)
        .orderBy(desc(auditLogs.createdAt))
        .limit(10000); // Safety limit for exports
      
      if (exportFormat === 'csv') {
        // Generate CSV
        const csvRows = [
          // Header row
          ['Timestamp', 'User ID', 'User Name', 'User Email', 'Action Type', 'Entity Type', 'Entity ID', 'IP Address', 'Device Type', 'User Agent'].join(','),
          // Data rows
          ...logs.map(log => [
            log.createdAt.toISOString(),
            log.userId,
            log.userName || '',
            log.userEmail || '',
            log.actionType,
            log.entityType,
            log.entityId,
            log.ipAddress,
            log.deviceType,
            `"${(log.userAgent || '').replace(/"/g, '""')}"`, // Escape quotes in user agent
          ].join(','))
        ];
        
        const csv = csvRows.join('\n');
        
        return new NextResponse(csv, {
          status: 200,
          headers: {
            'Content-Type': 'text/csv',
            'Content-Disposition': `attachment; filename="audit-logs-${new Date().toISOString().split('T')[0]}.csv"`,
          },
        });
      }
      
      if (exportFormat === 'excel') {
        // For Excel, we'll return CSV with Excel-specific headers
        // In a production app, you'd use a library like exceljs
        const csvRows = [
          // Header row
          ['Timestamp', 'User ID', 'User Name', 'User Email', 'Action Type', 'Entity Type', 'Entity ID', 'IP Address', 'Device Type', 'User Agent'].join('\t'),
          // Data rows
          ...logs.map(log => [
            log.createdAt.toISOString(),
            log.userId,
            log.userName || '',
            log.userEmail || '',
            log.actionType,
            log.entityType,
            log.entityId,
            log.ipAddress,
            log.deviceType,
            (log.userAgent || '').replace(/\t/g, ' '), // Remove tabs
          ].join('\t'))
        ];
        
        const tsv = csvRows.join('\n');
        
        return new NextResponse(tsv, {
          status: 200,
          headers: {
            'Content-Type': 'application/vnd.ms-excel',
            'Content-Disposition': `attachment; filename="audit-logs-${new Date().toISOString().split('T')[0]}.xls"`,
          },
        });
      }
    }
    
    // Regular paginated query
    const offset = (page - 1) * limit;
    
    // Get total count
    const countResult = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(auditLogs)
      .where(whereClause);
    
    const totalCount = countResult[0]?.count || 0;
    
    // Get paginated logs with user details
    const logs = await db
      .select({
        id: auditLogs.id,
        userId: auditLogs.userId,
        userName: users.fullName,
        userEmail: users.email,
        userRole: users.role,
        actionType: auditLogs.actionType,
        entityType: auditLogs.entityType,
        entityId: auditLogs.entityId,
        ipAddress: auditLogs.ipAddress,
        deviceType: auditLogs.deviceType,
        userAgent: auditLogs.userAgent,
        beforeState: auditLogs.beforeState,
        afterState: auditLogs.afterState,
        createdAt: auditLogs.createdAt,
      })
      .from(auditLogs)
      .leftJoin(users, eq(auditLogs.userId, users.id))
      .where(whereClause)
      .orderBy(desc(auditLogs.createdAt))
      .limit(limit)
      .offset(offset);
    
    // Calculate pagination metadata
    const totalPages = Math.ceil(totalCount / limit);
    const hasNextPage = page < totalPages;
    const hasPreviousPage = page > 1;
    
    return NextResponse.json({
      logs,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages,
        hasNextPage,
        hasPreviousPage,
      },
    });
  } catch (error) {
    console.error('Error fetching audit logs:', error);
    return NextResponse.json(
      { error: 'Failed to fetch audit logs' },
      { status: 500 }
    );
  }
}
