/**
 * Admin API: Damage Deductions Management
 * 
 * GET /api/admin/deductions - List deductions with filters
 * POST /api/admin/deductions - Create new deduction
 * 
 * Requirements: 7.1, 7.2, 7.3, 7.5, 7.6, 12.1
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/next-auth.config';
import { db } from '@/lib/db';
import { damageDeductions } from '@/lib/db/schema/vehicle-valuations';
import { eq, and, like, desc } from 'drizzle-orm';
import { deductionSchema } from '@/features/valuations/validation/schemas';

/**
 * GET /api/admin/deductions
 * List deductions with optional filters and pagination
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
    const component = searchParams.get('component');
    const damageLevel = searchParams.get('damageLevel');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = (page - 1) * limit;

    // Build query with filters (Requirement 7.1)
    const conditions = [];

    if (component) {
      conditions.push(like(damageDeductions.component, `%${component}%`));
    }
    if (damageLevel) {
      conditions.push(eq(damageDeductions.damageLevel, damageLevel as 'minor' | 'moderate' | 'severe'));
    }

    // Apply pagination and ordering (Requirement 7.2)
    let query = db.select().from(damageDeductions);
    
    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as typeof query;
    }
    
    const results = await query
      .orderBy(desc(damageDeductions.createdAt))
      .limit(limit)
      .offset(offset);

    // Get total count for pagination
    let countQuery = db.select().from(damageDeductions);
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
    console.error('Error fetching deductions:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/deductions
 * Create new deduction
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
    const validationResult = deductionSchema.safeParse(body);

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

    // Create deduction (Requirement 7.6)
    const result = await db.insert(damageDeductions).values({
      component: data.component,
      damageLevel: data.damageLevel,
      repairCostEstimate: data.repairCostEstimate.toString(),
      valuationDeductionPercent: data.valuationDeductionPercent.toString(),
      description: data.description,
      createdBy: session.user.id,
    }).returning();

    // TODO: Log creation in audit logs (Requirement 12.1)
    // This will be implemented in task 7

    return NextResponse.json(
      { 
        message: 'Deduction created successfully',
        data: result[0]
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error creating deduction:', error);
    
    // Check for unique constraint violation
    if (error instanceof Error && error.message.includes('unique')) {
      return NextResponse.json(
        { error: 'Deduction already exists for this component/damage level combination' },
        { status: 409 }
      );
    }
    
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
