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

function nameLooksClose(expected: string, actual?: string | null): boolean {
  if (!actual) return false;
  const left = normalizeName(expected);
  const right = normalizeName(actual);
  if (!left || !right) return false;
  if (left === right || left.includes(right) || right.includes(left)) return true;
  const leftTokens = new Set(left.split(/\s+/).filter((part) => part.length > 1));
  const rightTokens = right.split(/\s+/).filter((part) => part.length > 1);
  if (!leftTokens.size || !rightTokens.length) return false;
  const overlap = rightTokens.filter((part) => leftTokens.has(part)).length;
  return overlap / Math.max(leftTokens.size, rightTokens.length) >= 0.55;
}

function businessNameLooksClose(expected: string, actual?: string | null): boolean {
  return nameLooksClose(expected, actual);
}

function businessTypeAliases(value: string): string[] {
  const normalized = normalizeName(value);
  if (!normalized || normalized.includes('individual')) return [];
  if (normalized.includes('business name')) return ['business name', 'enterprise', 'ventures'];
  if (normalized.includes('trust')) return ['incorporated trustees', 'trustees', 'trust'];
  if (normalized.includes('liability partnership') || normalized.includes('llp')) return ['limited liability partnership', 'llp'];
  if (normalized.includes('limited partnership')) return ['limited partnership', 'lp'];
  if (normalized.includes('public') || /\bplc\b/i.test(value)) return ['public limited company', 'plc', 'company limited by shares', 'limited by shares'];
  if (normalized.includes('guarantee')) return ['company limited by guarantee', 'limited by guarantee'];
  if (normalized.includes('unlimited')) return ['unlimited company'];
  return ['private limited company', 'limited company', 'incorporated company', 'company limited by shares', 'limited by shares'];
}

function businessTypeLooksClose(expectedType: string, actual?: string | null): boolean {
  if (!actual) return true;
  const normalizedActual = normalizeName(actual);
  return businessTypeAliases(expectedType).some((alias) => {
    const normalizedAlias = normalizeName(alias);
    return normalizedActual.includes(normalizedAlias) || nameLooksClose(normalizedAlias, normalizedActual);
  });
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

function extractBusinessType(value: unknown): string | null {
  const keys = ['business_type', 'businessType', 'type_of_company', 'typeOfCompany', 'company_type', 'companyType', 'entity_type', 'entityType', 'type'];
  return extractFirstString(value, keys);
}

function extractFirstString(value: unknown, keys: string[]): string | null {
  const seen = new Set<unknown>();
  const wanted = new Set(keys);

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
      if (wanted.has(key) && typeof child === 'string' && child.trim()) return child.trim();
    }
    for (const child of Object.values(record)) {
      const found = walk(child);
      if (found) return found;
    }
    return null;
  }

  return walk(value);
}

function extractPersonName(value: unknown): string | null {
  const seen = new Set<unknown>();
  const nameKeys = new Set([
    'full_name',
    'fullName',
    'name',
    'firstname',
    'first_name',
    'middlename',
    'middle_name',
    'surname',
    'last_name',
    'lastname',
  ]);

  function walk(node: unknown): string[] {
    if (!node || typeof node !== 'object' || seen.has(node)) return [];
    seen.add(node);
    if (Array.isArray(node)) return node.flatMap(walk);

    const record = node as Record<string, unknown>;
    const directFullName = ['full_name', 'fullName', 'name']
      .map((key) => record[key])
      .find((value): value is string => typeof value === 'string' && value.trim().length > 0);
    if (directFullName) return [directFullName.trim()];

    const parts = ['firstname', 'first_name', 'middlename', 'middle_name', 'surname', 'last_name', 'lastname']
      .map((key) => record[key])
      .filter((value): value is string => typeof value === 'string' && value.trim().length > 0);
    if (parts.length >= 2) return [parts.join(' ')];

    const nested: string[] = [];
    for (const [key, child] of Object.entries(record)) {
      if (nameKeys.has(key) && typeof child === 'string' && child.trim()) nested.push(child.trim());
      else nested.push(...walk(child));
    }
    return nested;
  }

  return walk(value)[0] ?? null;
}

function redactProviderValue(key: string, value: unknown, depth = 0): unknown {
  if (depth > 4) return '[depth-limit]';
  if (value === null || value === undefined) return value;
  const lower = key.toLowerCase();

  if (typeof value === 'string') {
    if (/(nin|bvn|phone|mobile|email|address|url|image|photo|selfie|document|id_url|back_url)/i.test(lower)) {
      return value.length <= 4 ? '****' : `****${value.slice(-4)}`;
    }
    return value.slice(0, 120);
  }

  if (typeof value === 'number' || typeof value === 'boolean') return value;

  if (Array.isArray(value)) {
    return value.slice(0, 5).map((item, index) => redactProviderValue(`${key}[${index}]`, item, depth + 1));
  }

  if (typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .slice(0, 30)
        .map(([childKey, childValue]) => [childKey, redactProviderValue(childKey, childValue, depth + 1)])
    );
  }

  return String(value);
}

function redactedProviderSnapshot(value: unknown): unknown {
  return redactProviderValue('root', value);
}

function providerErrorMessage(value: unknown): string | null {
  if (!value || typeof value !== 'object') return null;
  const record = value as Record<string, unknown>;
  const error = record.error ?? record.message;
  return typeof error === 'string' && error.trim() ? error.trim() : null;
}

function extractBirthDate(value: unknown): string | null {
  const seen = new Set<unknown>();
  const dateKeys = new Set(['birthdate', 'birth_date', 'date_of_birth', 'dob', 'dateOfBirth']);

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
      if (dateKeys.has(key) && (typeof child === 'string' || child instanceof Date)) {
        const value = String(child).slice(0, 10);
        if (value) return value;
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

function safeProviderDiagnostics(
  check: 'nin' | 'cac',
  data: {
    result: unknown;
    submittedName?: string;
    providerName?: string | null;
    submittedBusinessName?: string;
    providerBusinessName?: string | null;
    providerBusinessType?: string | null;
    nameMatched?: boolean;
    typeMatched?: boolean;
    dobMatched?: boolean;
    status?: unknown;
  }
) {
  const enabled = process.env.KYC_PROVIDER_DEBUG_LOGS === 'true' || process.env.NODE_ENV !== 'production';
  if (!enabled) return;
  const record = data.result && typeof data.result === 'object' ? (data.result as Record<string, unknown>) : {};
  const entity = record.entity && typeof record.entity === 'object' ? (record.entity as Record<string, unknown>) : null;
  console.info('[Manual KYC Verify Field] provider diagnostics', {
    check,
    status: data.status,
    topLevelKeys: Object.keys(record).slice(0, 20),
    entityKeys: entity ? Object.keys(entity).slice(0, 30) : [],
    providerSnapshot: redactedProviderSnapshot(record),
    submittedName: data.submittedName,
    providerName: data.providerName,
    submittedBusinessName: data.submittedBusinessName,
    providerBusinessName: data.providerBusinessName,
    providerBusinessType: data.providerBusinessType,
    nameMatched: data.nameMatched,
    typeMatched: data.typeMatched,
    dobMatched: data.dobMatched,
  });
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
        const expected = normalizeName(row.fullName ?? session.user.name ?? '');
        const providerRawName = extractPersonName(result);
        const providerName = normalizeName(providerRawName ?? '');
        const providerBirthDate = extractBirthDate(result);
        const dobMatches = !dateOfBirth || !providerBirthDate || providerBirthDate === dateOfBirth;
        const nameMatched = nameLooksClose(expected, providerName);
        safeProviderDiagnostics('nin', {
          result,
          status: result.status,
          submittedName: expected,
          providerName,
          nameMatched,
          dobMatched: dobMatches,
        });
        if (result.status !== false && providerName && nameMatched && dobMatches) {
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
      const result = await dojah.verifyCAC(cacNumber, businessName, String(body?.businessType ?? ''));
      const providerError = providerErrorMessage(result);
      const providerBusinessName = extractBusinessName(result);
      const providerBusinessType = extractBusinessType(result);
      const businessMatched = businessNameLooksClose(businessName, providerBusinessName);
      const typeMatched = businessTypeLooksClose(String(body?.businessType ?? ''), providerBusinessType);
      safeProviderDiagnostics('cac', {
        result,
        status: result.status,
        submittedBusinessName: businessName,
        providerBusinessName,
        providerBusinessType,
        nameMatched: businessMatched,
        typeMatched,
      });
      if (providerError && /unable to reach|unavailable|timeout|service/i.test(providerError)) {
        return response('unavailable', 'CAC provider check is temporarily unavailable. Managers can still review the uploaded business document.', {
          providerBusinessName,
        });
      }
      if (result.status !== false && businessMatched && typeMatched) {
        return response('verified', 'CAC record looks consistent with the business name.', {
          providerBusinessName,
          providerBusinessType,
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
