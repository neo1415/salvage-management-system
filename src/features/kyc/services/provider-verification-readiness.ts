import { sql } from 'drizzle-orm';
import { db } from '@/lib/db/drizzle';

export const PROVIDER_VERIFICATION_MIGRATION_MISSING = 'Provider verification migration missing.';

export class ProviderVerificationStorageError extends Error {
  constructor() {
    super(PROVIDER_VERIFICATION_MIGRATION_MISSING);
    this.name = 'ProviderVerificationStorageError';
  }
}

export async function hasProviderVerificationStorage(): Promise<boolean> {
  const [{ exists } = { exists: false }] = await db.execute<{ exists: boolean }>(
    sql`select to_regclass('public.provider_verification_records') is not null as "exists"`
  );
  return Boolean(exists);
}

export async function assertProviderVerificationStorageReady(): Promise<void> {
  if (!(await hasProviderVerificationStorage())) {
    throw new ProviderVerificationStorageError();
  }
}

export function isProviderVerificationStorageError(error: unknown): error is ProviderVerificationStorageError {
  return error instanceof ProviderVerificationStorageError ||
    (error instanceof Error && error.message === PROVIDER_VERIFICATION_MIGRATION_MISSING);
}
