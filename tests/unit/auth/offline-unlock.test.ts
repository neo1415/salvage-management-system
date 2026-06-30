import { beforeEach, describe, expect, it } from 'vitest';
import {
  clearOfflineUnlockGrant,
  getOfflineUnlockGrant,
  saveOfflineUnlockGrant,
} from '@/lib/auth/offline-unlock';

describe('offline unlock grant', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('stores only claims-adjuster grants', () => {
    const managerGrant = saveOfflineUnlockGrant({
      userId: 'manager-1',
      role: 'salvage_manager',
      fullName: 'Manager',
    });

    expect(managerGrant).toBeNull();
    expect(getOfflineUnlockGrant()).toBeNull();

    const adjusterGrant = saveOfflineUnlockGrant({
      userId: 'adjuster-1',
      role: 'claims_adjuster',
      fullName: 'Adjuster',
      ttlMs: 60_000,
    });

    expect(adjusterGrant).toMatchObject({
      userId: 'adjuster-1',
      role: 'claims_adjuster',
      fullName: 'Adjuster',
    });
    expect(getOfflineUnlockGrant()).toMatchObject({
      userId: 'adjuster-1',
      role: 'claims_adjuster',
    });
  });

  it('removes expired grants', () => {
    const grant = saveOfflineUnlockGrant({
      userId: 'adjuster-1',
      role: 'claims_adjuster',
      ttlMs: 1,
    });

    expect(grant).not.toBeNull();
    expect(getOfflineUnlockGrant(Date.now() + 10_000)).toBeNull();
  });

  it('can clear the grant explicitly', () => {
    saveOfflineUnlockGrant({
      userId: 'adjuster-1',
      role: 'claims_adjuster',
    });

    clearOfflineUnlockGrant();
    expect(getOfflineUnlockGrant()).toBeNull();
  });
});

