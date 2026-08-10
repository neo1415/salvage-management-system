import { NextRequest, NextResponse } from 'next/server';
import { and, asc, eq, ne } from 'drizzle-orm';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db/drizzle';
import { departments, EXECUTIVE_DEPARTMENT_CODES } from '@/lib/db/schema/departments';

const departmentSchema = z.object({
  name: z.string().trim().min(2).max(160),
  code: z.string().trim().regex(/^[a-z0-9_]+$/).max(80).optional(),
  kind: z.enum(['claims', 'support']).default('claims'),
  insuranceClasses: z.array(z.string().trim().min(1).max(120)).max(50).default([]),
});

function makeCode(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 80);
}

async function requireAdmin() {
  const session = await auth();
  return session?.user?.role === 'system_admin' ? session : null;
}

export async function GET() {
  if (!await requireAdmin()) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const rows = await db.select().from(departments)
    .where(eq(departments.isActive, true))
    .orderBy(asc(departments.kind), asc(departments.name));
  const executiveOrder = new Map(EXECUTIVE_DEPARTMENT_CODES.map((code, index) => [code, index]));
  rows.sort((a, b) => {
    const left = executiveOrder.get(a.code as (typeof EXECUTIVE_DEPARTMENT_CODES)[number]);
    const right = executiveOrder.get(b.code as (typeof EXECUTIVE_DEPARTMENT_CODES)[number]);
    if (left !== undefined || right !== undefined) return (left ?? 99) - (right ?? 99);
    return a.name.localeCompare(b.name);
  });
  return NextResponse.json({ success: true, departments: rows });
}

export async function POST(request: NextRequest) {
  if (!await requireAdmin()) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const parsed = departmentSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: 'Invalid department', details: parsed.error.flatten() }, { status: 400 });
  const code = parsed.data.code || makeCode(parsed.data.name);
  if (!code || (EXECUTIVE_DEPARTMENT_CODES as readonly string[]).includes(code)) {
    return NextResponse.json({ error: 'This department code is reserved' }, { status: 409 });
  }
  try {
    const [created] = await db.insert(departments).values({ ...parsed.data, code }).returning();
    return NextResponse.json({ success: true, department: created }, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'A department with this name or code already exists' }, { status: 409 });
  }
}

export async function PATCH(request: NextRequest) {
  if (!await requireAdmin()) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const parsed = z.object({ id: z.string().uuid(), isActive: z.boolean() }).safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  const [row] = await db.select().from(departments).where(and(eq(departments.id, parsed.data.id), ne(departments.isSystem, true))).limit(1);
  if (!row) return NextResponse.json({ error: 'System designations cannot be disabled' }, { status: 409 });
  await db.update(departments).set({ isActive: parsed.data.isActive, updatedAt: new Date() }).where(eq(departments.id, row.id));
  return NextResponse.json({ success: true });
}
