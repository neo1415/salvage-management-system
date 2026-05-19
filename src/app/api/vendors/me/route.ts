import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth/next-auth.config';
import { db } from '@/lib/db/drizzle';
import { vendors } from '@/lib/db/schema/vendors';
import { eq } from 'drizzle-orm';

export async function GET() {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const vendor = await db.query.vendors.findFirst({
    where: eq(vendors.userId, session.user.id),
  });

  if (!vendor) {
    return NextResponse.json({ error: 'Vendor profile not found' }, { status: 404 });
  }

  return NextResponse.json({ vendor });
}
