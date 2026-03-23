/**
 * Admin API: Vehicle Valuations Management
 * 
 * GET /api/admin/valuations - List valuations with filters
 * POST /api/admin/valuations - Create new valuation
 * 
 * Requirements: 7.1, 7.2, 7.3, 7.5, 7.6, 12.1
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/next-auth.config';
import { db } from '@/lib/db';
import { vehicleValuations } from '@/lib/db/schema/vehicle-valuations';
import { eq, and, like, desc } from 'drizzle-orm';
import { valuationSchema } from '@/features/valuations/validation/schemas';

/**
 * GET /api/admin/valuations
 * List valuations with optional filters and pagination
 * Requirements: 7.1, 7.2, 7.5
 */
export async function GET(request: NextRequest) {
  try {
    // Check authentication and authorization
    const session = await auth();
    
    if (!session?.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }
    
    // Restrict to admin and manager roles (Requirement 7.5)
    if (session.user.role !== 'admin' && session.user.role !== 'manager') {
      return NextResponse.json(
        { error: 'Forbidden - Admin or Manager role required' },
        { status: 403 }
      );
    }

    // Parse query parameters
    const searchParams = request.nextUrl.searchParams;
    const make = searchParams.get('make');
    const model = searchParams.get('model');
    const year = searchParams.get('year');
    const condition = searchParams.get('condition');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = (page - 1) * limit;

    // Build query with filters (Requirement 7.1)
    const conditions = [];

    if (make) {
      conditions.push(like(vehicleValuations.make, `%${make}%`));
    }
    if (model) {
      conditions.push(like(vehicleValuations.model, `%${model}%`));
    }
    if (year) {
      conditions.push(eq(vehicleValuations.year, parseInt(year)));
    }
    if (condition) {
      conditions.push(eq(vehicleValuations.conditionCategory, condition));
    }

    // Apply pagination and ordering (Requirement 7.2)
    let query = db.select().from(vehicleValuations);
    
    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as typeof query;
    }
    
    const results = await query
      .orderBy(desc(vehicleValuations.createdAt))
      .limit(limit)
      .offset(offset);

    // Get total count for pagination
    let countQuery = db.select().from(vehicleValuations);
    if (conditions.length > 0) {
      countQuery = countQuery.where(and(...conditions)) as typeof countQuery;
    }
    const totalResults = await countQuery;
    const total = totalResults.length;

    return NextResponse.json({
      data: results,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Error fetching valuations:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/valuations
 * Create new valuation
 * Requirements: 7.3, 7.6, 12.1
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

    // Parse and validate request body (Requirement 7.3)
    const body = await request.json();
    const validationResult = valuationSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        { 
          error: 'Validation failed',
          details: validationResult.error.issues 
        },
        { status: 400 }
      );
    }

    const data = validationResult.data;

    // Create valuation (Requirement 7.6)
    const result = await db.insert(vehicleValuations).values({
      make: data.make,
      model: data.model,
      year: data.year,
      conditionCategory: data.conditionCategory,
      lowPrice: data.lowPrice.toString(),
      highPrice: data.highPrice.toString(),
      averagePrice: data.averagePrice.toString(),
      mileageLow: data.mileageLow,
      mileageHigh: data.mileageHigh,
      marketNotes: data.marketNotes,
      dataSource: 'admin_entry',
      createdBy: session.user.id,
    }).returning();

    // TODO: Log creation in audit logs (Requirement 12.1)
    // This will be implemented in task 7

    return NextResponse.json(
      { 
        message: 'Valuation created successfully',
        data: result[0]
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error creating valuation:', error);
    
    // Check for unique constraint violation
    if (error instanceof Error && error.message.includes('unique')) {
      return NextResponse.json(
        { error: 'Valuation already exists for this make/model/year/condition combination' },
        { status: 409 }
      );
    }
    
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
