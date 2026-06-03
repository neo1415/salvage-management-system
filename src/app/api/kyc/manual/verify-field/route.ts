import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/next-auth.config';
import { db } from '@/lib/db/drizzle';
import { users, vendors } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { getDojahService } from '@/features/kyc/services/dojah.service';

type CheckState = 'verified' | 'review' | 'unavailable' | 'failed';

function splitName(fullName: string): { firstName: string; middleName?: string; lastName: string } {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { firstName: 'Unknown', lastName: 'Unknown' };
  if (parts.length === 1) return { firstName: parts[0], lastName: parts[0] };
  return {
    firstName: parts[0],
    middleName: parts.length > 2 ? parts.slice(1, -1).join(' ') : undefined,
    lastName: parts[parts.length - 1],
  };
}

function normalizeName(value: string): string {
  return value
    .toLowerCase()
    .replace(/\b(plc|ltd|limited|incorporated|inc|company|co|nigeria|ng|the)\b/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function businessNameLooksClose(expected: string, actual?: string | null): boolean {
  if (!actual) return false;
  const left = normalizeName(expected);
  const right = normalizeName(actual);
  if (!left || !right) return false;
  if (left === right || left.includes(right) || right.includes(left)) return true;
  const leftTokens = new Set(left.split(/\s+/).filter((part) => part.length > 2));
  const rightTokens = right.split(/\s+/).filter((part) => part.length > 2);
  if (!leftTokens.size || !rightTokens.length) return false;
  const overlap = rightTokens.filter((part) => leftTokens.has(part)).length;
  return overlap / Math.max(leftTokens.size, rightTokens.length) >= 0.6;
}

function response(state: CheckState, message: string, extra?: Record<string, unknown>) {
  return NextResponse.json({ state, message, ...(extra ?? {}) });
}

function extractBusinessName(value: unknown): string | null {
  const seen = new Set<unknown>();
  const nameKeys = new Set([
    'company_name',
    'companyName',
    'business_name',
    'businessName',
    'registered_name',
    'registeredName',
    'name',
  ]);

  function walk(node: unknown): string | null {
    if (!node || typeof node !== 'object' || seen.has(node)) return null;
    seen.add(node);
    if (Array.isArray(node)) {
      for (const child of node) {
        const found = walk(child);
        if (found) return found;
      }
      return null;
    }

    const record = node as Record<string, unknown>;
    for (const [key, child] of Object.entries(record)) {
      if (nameKeys.has(key) && typeof child === 'string' && child.trim()) {
        return child.trim();
      }
    }
    for (const child of Object.values(record)) {
      const found = walk(child);
      if (found) return found;
    }
    return null;
  }

  return walk(value);
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const type = body?.type as 'bvn' | 'nin' | 'cac' | undefined;
    if (!type || !['bvn', 'nin', 'cac'].includes(type)) {
      return NextResponse.json({ error: 'Invalid verification type' }, { status: 400 });
    }

    const [row] = await db
      .select({
        userId: users.id,
        fullName: users.fullName,
        dateOfBirth: users.dateOfBirth,
        vendorId: vendors.id,
        bvnVerifiedAt: vendors.bvnVerifiedAt,
      })
      .from(users)
      .innerJoin(vendors, eq(vendors.userId, users.id))
      .where(eq(users.id, session.user.id))
      .limit(1);

    if (!row) return NextResponse.json({ error: 'Vendor profile not found' }, { status: 404 });

    const dojah = getDojahService();
    const dateOfBirth = row.dateOfBirth ? new Date(row.dateOfBirth).toISOString().slice(0, 10) : undefined;

    if (type === 'bvn') {
      if (row.bvnVerifiedAt) return response('verified', 'BVN already verified from Tier 1.');
      const bvn = String(body?.bvn ?? '').replace(/\D/g, '');
      if (!/^\d{11}$/.test(bvn)) return response('failed', 'BVN must be exactly 11 digits.');
      const name = splitName(row.fullName ?? session.user.name ?? '');
      try {
        const result = await dojah.validateBVN({
          bvn,
          firstName: name.firstName,
          middleName: name.middleName,
          lastName: name.lastName,
          dateOfBirth,
          customerReference: `tier2-inline-bvn-${row.vendorId}`,
        });
        const bvnValid = result.entity?.bvn?.status !== false;
        const dobValid = result.entity?.dob?.status !== false;
        const firstName = result.entity?.first_name?.confidence_value ?? 0;
        const lastName = result.entity?.last_name?.confidence_value ?? 0;
        if (result.status !== false && bvnValid && dobValid && firstName >= 70 && lastName >= 70) {
          return response('verified', 'BVN matches the name and date of birth on your profile.');
        }
        return response('review', 'BVN check completed, but one or more details need manager review.');
      } catch {
        return response('unavailable', 'BVN provider check is unavailable. You can still submit for manager review.');
      }
    }

    if (type === 'nin') {
      const nin = String(body?.nin ?? '').replace(/\D/g, '');
      if (!/^\d{11}$/.test(nin)) return response('failed', 'NIN must be exactly 11 digits.');
      try {
        const result = await dojah.verifyNINAdvanced(nin);
        const entity = result.entity;
        const expected = normalizeName(row.fullName ?? session.user.name ?? '');
        const providerName = normalizeName([entity?.firstname, entity?.middlename, entity?.surname].filter(Boolean).join(' '));
        const dobMatches = !dateOfBirth || !entity?.birthdate || String(entity.birthdate).slice(0, 10) === dateOfBirth;
        if (result.status !== false && providerName && (expected.includes(providerName) || providerName.includes(expected)) && dobMatches) {
          return response('verified', 'NIN matches the name and date of birth on your profile.');
        }
        return response('review', 'NIN lookup completed, but the details need manager review.');
      } catch {
        return response('unavailable', 'NIN provider check is unavailable. You can still submit for manager review.');
      }
    }

    const cacNumber = String(body?.cacNumber ?? '').trim();
    const businessName = String(body?.businessName ?? '').trim();
    if (!cacNumber || !businessName) return response('failed', 'Business name and CAC/RC number are required.');
    try {
      const result = await dojah.verifyCAC(cacNumber);
      const providerBusinessName = extractBusinessName(result);
      if (result.status !== false && businessNameLooksClose(businessName, providerBusinessName)) {
        return response('verified', 'CAC record looks consistent with the business name.', {
          providerBusinessName,
        });
      }
      return response(
        'review',
        providerBusinessName
          ? `CAC lookup found "${providerBusinessName}", but it still needs manager review against your uploaded business document.`
          : 'CAC lookup completed, but no business name was returned for automatic matching. A manager will review the uploaded business document.',
        { providerBusinessName }
      );
    } catch {
      return response('unavailable', 'CAC provider check is unavailable. You can still submit for manager review.');
    }
  } catch (error) {
    console.error('[Manual KYC Verify Field] Error:', error);
    return NextResponse.json({ error: 'Verification check failed' }, { status: 500 });
  }
}
