import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { NextRequest } from 'next/server';

function makeChain(result: unknown = []) {
  const chain: Record<string, unknown> = {};
  const passthrough = vi.fn(() => chain);
  chain.from = passthrough;
  chain.innerJoin = passthrough;
  chain.where = passthrough;
  chain.orderBy = passthrough;
  chain.limit = vi.fn(() => Promise.resolve(result));
  chain.returning = vi.fn(() => Promise.resolve(result));
  chain.values = vi.fn(() => chain);
  chain.set = vi.fn(() => chain);
  chain.onConflictDoUpdate = vi.fn(() => Promise.resolve(result));
  chain.then = (resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) =>
    Promise.resolve(result).then(resolve, reject);
  return chain;
}

async function json(response: Response) {
  return response.json() as Promise<Record<string, unknown>>;
}

describe('provider evidence display helpers', () => {
  it('masks sensitive identifiers and uses safe fallbacks', async () => {
    const { maskIdentifier, displayOrFallback, buildDojahEvidenceSections } = await import(
      '@/features/kyc/utils/provider-evidence-display'
    );

    expect(maskIdentifier('RC123456789')).toBe('*******6789');
    expect(displayOrFallback(null)).toBe('Not provided by Dojah');

    const sections = buildDojahEvidenceSections(
      { livenessScore: 88, verificationStatus: 'completed' },
      {
        provider: 'dojah',
        providerReference: 'ref-1',
        status: 'review_required',
        riskLevel: 'medium',
        checksCompleted: ['liveness'],
        pendingChecks: [],
        failedChecks: [],
        reasonCodes: [],
      }
    );

    expect(sections.liveness['Liveness score']).toBe('88%');
    expect(sections.providerSummary.Provider).toBe('dojah');
  });
});

describe('Dojah widget config route', () => {
  beforeEach(() => {
    vi.resetModules();
    process.env.DOJAH_APP_ID = 'app_test';
    process.env.DOJAH_PUBLIC_KEY = 'test_public_key';
    process.env.DOJAH_WIDGET_ID = 'widget_123';
    process.env.DOJAH_SECRET_KEY = 'secret_should_never_leave_server';
    process.env.DOJAH_WEBHOOK_SECRET = 'webhook_should_never_leave_server';
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it('returns only safe public Dojah config and non-sensitive metadata', async () => {
    vi.doMock('@/lib/auth/next-auth.config', () => ({
      auth: vi.fn(async () => ({
        user: {
          id: 'user-1',
          phone: '+2348012345678',
          email: 'vendor@example.com',
          bvn: '22222222222',
          nin: '12345678901',
        },
      })),
    }));

    vi.doMock('@/lib/db/schema/vendors', () => ({ vendors: { id: 'vendors.id', userId: 'vendors.userId' } }));
    vi.doMock('@/lib/db/schema/users', () => ({ users: { id: 'users.id', dateOfBirth: 'users.dateOfBirth' } }));
    vi.doMock('drizzle-orm', () => ({ eq: vi.fn(() => ({ op: 'eq' })) }));
    vi.doMock('@/features/kyc/services/provider-verification.service', () => ({
      getProviderVerificationService: () => ({
        getOrCreatePendingWorkflow: vi.fn(async () => ({
          providerReference: 'nem-tier2-vendor-1-reference',
          created: true,
        })),
      }),
    }));
    vi.doMock('@/features/kyc/services/dojah-reconcile.service', () => ({
      reconcileTier2FromDojah: vi.fn(async () => ({ synced: false })),
    }));
    vi.doMock('@/lib/utils/audit-logger', () => ({
      getIpAddress: vi.fn(() => '127.0.0.1'),
    }));
    vi.doMock('@/lib/db/drizzle', () => ({
      db: {
        select: vi.fn(() => makeChain([{ vendorId: 'vendor-1', dateOfBirth: new Date('1990-01-15T00:00:00Z') }])),
      },
    }));

    const route = await import('@/app/api/kyc/widget-config/route');
    const response = await route.GET(new Request('http://localhost:3000/api/kyc/widget-config'));
    const body = await json(response);

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      appId: 'app_test',
      publicKey: 'test_public_key',
      widgetId: 'widget_123',
      phone: '+2348012345678',
      dob: '1990-01-15',
      vendorId: 'vendor-1',
      workflowSlug: 'salvage',
      verificationReference: 'nem-tier2-vendor-1-reference',
    });

    const serialized = JSON.stringify(body).toLowerCase();
    expect(serialized).not.toContain('22222222222');
    expect(serialized).not.toContain('12345678901');
    expect(serialized).not.toContain('secret_should_never_leave_server');
    expect(serialized).not.toContain('webhook_should_never_leave_server');
    expect(serialized).not.toContain('secretkey');
    expect(serialized).not.toContain('rawpayload');
  });
});

describe('camera permission helpers', () => {
  const originalNavigator = globalThis.navigator;

  afterEach(() => {
    Object.defineProperty(globalThis, 'navigator', {
      value: originalNavigator,
      configurable: true,
    });
    vi.restoreAllMocks();
  });

  it('does not store or upload media during preflight and stops local tracks immediately', async () => {
    const stop = vi.fn();
    const getUserMedia = vi.fn(async (constraints) => ({
      getTracks: () => [{ stop }],
      constraints,
    }));

    Object.defineProperty(globalThis, 'navigator', {
      value: {
        mediaDevices: { getUserMedia },
        userAgent: 'Chrome',
      },
      configurable: true,
    });

    const { requestCameraPermission } = await import('@/lib/utils/camera-permissions');
    const result = await requestCameraPermission();

    expect(result).toEqual({ granted: true });
    expect(getUserMedia).toHaveBeenCalledWith({ video: true, audio: false });
    expect(stop).toHaveBeenCalledTimes(1);
  });

  it('handles denied and unavailable camera states safely', async () => {
    Object.defineProperty(globalThis, 'navigator', {
      value: {
        mediaDevices: {
          getUserMedia: vi.fn(async () => {
            const error = new Error('denied');
            error.name = 'NotAllowedError';
            throw error;
          }),
        },
        permissions: {
          query: vi.fn(async () => ({ state: 'denied' })),
        },
        userAgent: 'Chrome',
      },
      configurable: true,
    });

    const { checkCameraPermission, requestCameraPermission } = await import('@/lib/utils/camera-permissions');

    await expect(checkCameraPermission()).resolves.toMatchObject({
      granted: false,
      error: expect.stringContaining('Camera access is blocked'),
    });
    await expect(requestCameraPermission()).resolves.toMatchObject({
      granted: false,
      error: expect.stringContaining('Camera access was denied'),
    });
  });
});

describe('Dojah result normalization', () => {
  it('normalizes high-risk Dojah workflow evidence into review-required risk signals', async () => {
    const { normalizeDojahWorkflowResult } = await import('@/features/kyc/services/dojah-normalizer.service');

    const normalized = normalizeDojahWorkflowResult({
      reference_id: 'dojah-ref-1',
      verification_status: 'pending_review',
      status: false,
      data: {
        id: { status: false },
        government_data: { status: false },
        user_data: { status: false },
        phone_number: { status: false },
        selfie: { data: { liveness_score: 30, match_score: 60 } },
        address: { status: 'failed' },
      },
      aml: { status: false },
      metadata: { ipinfo: { proxy: true } },
    } as never);

    expect(normalized.status).toBe('review_required');
    expect(normalized.riskLevel).toBe('critical');
    expect(normalized.failedChecks).toEqual(expect.arrayContaining([
      'government_id',
      'government_data',
      'user_data_consistency',
      'phone_consistency',
      'liveness',
      'face_match',
      'digital_address',
      'aml_screening',
      'ip_device_screening',
    ]));
    expect(normalized.reasonCodes).toEqual(expect.arrayContaining([
      'dojah_government_id_failed',
      'dojah_aml_flagged',
      'dojah_ip_device_flagged',
    ]));
  });
});

describe('Provider verification service', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('creates/updates provider records and creates fraud alerts for Dojah risk signals', async () => {
    vi.doUnmock('@/features/kyc/services/provider-verification.service');
    const insert = vi.fn(() => makeChain());
    const update = vi.fn(() => makeChain());
    const select = vi.fn(() => makeChain([{ id: 'admin-1' }]));
    const logAction = vi.fn(async () => undefined);

    vi.doMock('@/lib/db/drizzle', () => ({
      db: {
        insert,
        update,
        select,
        query: {
          fraudAlerts: { findFirst: vi.fn(async () => null) },
        },
      },
    }));
    vi.doMock('@/features/kyc/services/encryption.service', () => ({
      getEncryptionService: () => ({ encrypt: vi.fn(() => 'encrypted-payload') }),
    }));
    vi.doMock('@/features/notifications/services/notification.service', () => ({
      createRoleNotifications: vi.fn(async () => undefined),
    }));
    vi.doMock('@/lib/db/schema/users', () => ({ users: { id: 'users.id', role: 'users.role' } }));
    vi.doMock('@/lib/db/schema/intelligence', () => ({
      fraudAlerts: {
        id: 'fraud_alerts.id',
        entityType: 'fraud_alerts.entity_type',
        entityId: 'fraud_alerts.entity_id',
      },
    }));
    vi.doMock('@/lib/db/schema/provider-verifications', () => ({
      providerVerificationRecords: {
        provider: 'provider_verification_records.provider',
        providerReference: 'provider_verification_records.provider_reference',
        workflowReference: 'provider_verification_records.workflow_reference',
        verificationType: 'provider_verification_records.verification_type',
      },
      providerWebhookEvents: {
        provider: 'provider_webhook_events.provider',
        eventId: 'provider_webhook_events.event_id',
      },
    }));
    vi.doMock('drizzle-orm', () => ({
      and: vi.fn(() => ({})),
      eq: vi.fn(() => ({})),
    }));
    vi.doMock('@/lib/utils/audit-logger', () => ({
      logAction,
      AuditActionType: {
        DOJAH_KYC_REVIEW_REQUIRED: 'dojah_kyc_review_required',
        DOJAH_KYC_PASSED: 'dojah_kyc_passed',
        DOJAH_KYC_FAILED: 'dojah_kyc_failed',
        PROVIDER_UNAVAILABLE: 'provider_unavailable',
        FRAUD_ALERT_CREATED_FROM_DOJAH: 'fraud_alert_created_from_dojah',
        FRAUD_ALERT_UPDATED_FROM_DOJAH: 'fraud_alert_updated_from_dojah',
      },
      AuditEntityType: { KYC: 'kyc', FRAUD_FLAG: 'fraud_flag' },
      DeviceType: { DESKTOP: 'desktop' },
    }));

    const { ProviderVerificationService } = await import('@/features/kyc/services/provider-verification.service');
    await new ProviderVerificationService().persistVerification({
      userId: 'user-1',
      vendorId: 'vendor-1',
      actorId: 'admin-1',
      result: {
        provider: 'dojah',
        providerReference: 'dojah-ref-1',
        workflowReference: 'dojah-ref-1',
        verificationType: 'tier2',
        status: 'review_required',
        riskLevel: 'high',
        checksCompleted: ['liveness'],
        pendingChecks: [],
        failedChecks: ['aml_screening'],
        reasonCodes: ['dojah_aml_flagged'],
        displayMessage: 'Review required',
        normalizedResult: { amlStatus: false },
      },
      rawPayload: { sensitive: 'raw' },
    });

    expect(insert).toHaveBeenCalledTimes(2);
    expect(logAction).toHaveBeenCalledWith(expect.objectContaining({
      actionType: 'dojah_kyc_review_required',
      entityType: 'kyc',
      entityId: 'vendor-1',
    }));
    expect(logAction).toHaveBeenCalledWith(expect.objectContaining({
      actionType: 'fraud_alert_created_from_dojah',
      entityType: 'fraud_flag',
      entityId: 'vendor-1',
    }));
  });
});

describe('Dojah webhook route', () => {
  beforeEach(() => {
    vi.resetModules();
    process.env.DOJAH_WEBHOOK_SECRET = 'correct-secret';
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  function mockWebhookDependencies(options: { duplicate?: boolean } = {}) {
    const providerService = {
      recordWebhookEvent: vi.fn(async () => ({ duplicate: Boolean(options.duplicate) })),
      markWebhookProcessed: vi.fn(async () => undefined),
      markWebhookFailed: vi.fn(async () => undefined),
      persistVerification: vi.fn(async () => undefined),
    };

    vi.doMock('@/features/kyc/services/provider-verification.service', () => ({
      getProviderVerificationService: () => providerService,
    }));
    vi.doMock('@/features/kyc/services/dojah.service', () => ({
      getDojahService: () => ({ getVerificationResult: vi.fn(async () => null) }),
    }));
    vi.doMock('@/features/kyc/services/dojah-normalizer.service', () => ({
      normalizeDojahWorkflowResult: vi.fn(() => ({
        provider: 'dojah',
        providerReference: 'ref-1',
        workflowReference: 'ref-1',
        verificationType: 'tier2',
        status: 'review_required',
        riskLevel: 'medium',
        checksCompleted: [],
        pendingChecks: [],
        failedChecks: ['liveness'],
        reasonCodes: ['dojah_liveness_failed'],
        displayMessage: 'Review required',
        normalizedResult: {},
      })),
    }));
    vi.doMock('@/lib/utils/audit-logger', () => ({
      logAction: vi.fn(async () => undefined),
      getIpAddress: vi.fn(() => '127.0.0.1'),
      AuditActionType: {
        DOJAH_WEBHOOK_SIGNATURE_FAILED: 'dojah_webhook_signature_failed',
        DOJAH_WEBHOOK_DUPLICATE_IGNORED: 'dojah_webhook_duplicate_ignored',
        DOJAH_WEBHOOK_RECEIVED: 'dojah_webhook_received',
        DOJAH_WEBHOOK_PROCESSING_FAILED: 'dojah_webhook_processing_failed',
      },
      AuditEntityType: { KYC: 'kyc' },
      DeviceType: { DESKTOP: 'desktop' },
    }));
    vi.doMock('@/lib/db/schema/users', () => ({ users: { id: 'users.id', role: 'users.role' } }));
    vi.doMock('@/lib/db/schema/vendors', () => ({ vendors: { id: 'vendors.id', userId: 'vendors.userId' } }));
    vi.doMock('@/lib/db/schema/provider-verifications', () => ({
      providerVerificationRecords: {
        providerReference: 'provider_reference',
        vendorId: 'vendor_id',
        userId: 'user_id',
      },
    }));
    vi.doMock('drizzle-orm', () => ({ eq: vi.fn(() => ({})), or: vi.fn(() => ({})) }));
    vi.doMock('@/lib/db/drizzle', () => ({
      db: {
        select: vi.fn((selection?: unknown) => {
          if (selection && typeof selection === 'object' && 'id' in (selection as Record<string, unknown>)) {
            return makeChain([{ id: 'system-admin-1' }]);
          }
          return makeChain([]);
        }),
        query: {
          users: { findFirst: vi.fn(async () => ({ id: 'user-1' })) },
        },
      },
    }));

    return providerService;
  }

  it('rejects invalid webhook secrets before recording provider events', async () => {
    const providerService = mockWebhookDependencies();
    const route = await import('@/app/api/webhooks/dojah/route');
    const request = new NextRequest('https://nemsalvage.com/api/webhooks/dojah?secret=wrong-secret', {
      method: 'POST',
      body: JSON.stringify({ event_id: 'evt-1', event: 'kyc_widget', reference_id: 'ref-1' }),
      headers: { 'content-type': 'application/json' },
    });

    const response = await route.POST(request);

    expect(response.status).toBe(401);
    expect(await json(response)).toMatchObject({ error: 'Invalid signature' });
    expect(providerService.recordWebhookEvent).not.toHaveBeenCalled();
  });

  it('handles duplicate webhook events idempotently', async () => {
    const providerService = mockWebhookDependencies({ duplicate: true });
    const route = await import('@/app/api/webhooks/dojah/route');
    const request = new NextRequest('https://nemsalvage.com/api/webhooks/dojah?secret=correct-secret', {
      method: 'POST',
      body: JSON.stringify({ event_id: 'evt-1', event: 'kyc_widget', reference_id: 'ref-1' }),
      headers: { 'content-type': 'application/json' },
    });

    const response = await route.POST(request);

    expect(response.status).toBe(200);
    expect(await json(response)).toMatchObject({ ok: true, duplicate: true });
    expect(providerService.recordWebhookEvent).toHaveBeenCalledTimes(1);
    expect(providerService.persistVerification).not.toHaveBeenCalled();
  });

  it('fails closed in production when webhook secret is not configured', async () => {
    delete process.env.DOJAH_WEBHOOK_SECRET;
    const previousNodeEnv = process.env.NODE_ENV;
    vi.stubEnv('NODE_ENV', 'production');

    const providerService = mockWebhookDependencies();
    const route = await import('@/app/api/webhooks/dojah/route');
    const request = new NextRequest('https://nemsalvage.com/api/webhooks/dojah', {
      method: 'POST',
      body: JSON.stringify({ event_id: 'evt-1', event: 'kyc_widget', reference_id: 'ref-1' }),
      headers: { 'content-type': 'application/json' },
    });

    const response = await route.POST(request);

    expect(response.status).toBe(401);
    expect(providerService.recordWebhookEvent).not.toHaveBeenCalled();
    vi.stubEnv('NODE_ENV', previousNodeEnv);
  });
});

describe('Dojah service logging safety', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it('redacts BVN/NIN-style query values from provider error logs', async () => {
    vi.doUnmock('@/features/kyc/services/dojah.service');
    process.env.DOJAH_API_KEY = 'server-secret';
    process.env.DOJAH_APP_ID = 'app-id';
    process.env.DOJAH_PUBLIC_KEY = 'public-key';
    process.env.DOJAH_BASE_URL = 'https://api.dojah.io';

    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    vi.stubGlobal('fetch', vi.fn(async () => new Response('provider down', { status: 500 })));

    const { DojahService } = await import('@/features/kyc/services/dojah.service');
    await expect(new DojahService().validateBVN({
      bvn: '22222222222',
      firstName: 'Secret',
      lastName: 'Person',
      dateOfBirth: '1990-01-01',
      customerReference: 'customer-reference',
    })).rejects.toThrow();

    const serializedLogs = errorSpy.mock.calls.map((call) => JSON.stringify(call)).join('\n');
    expect(serializedLogs).not.toContain('22222222222');
    expect(serializedLogs).not.toContain('Secret');
    expect(serializedLogs).not.toContain('Person');
    expect(serializedLogs).not.toContain('1990-01-01');
    expect(serializedLogs).toContain('%5BREDACTED%5D');
  });
});

describe('evidence export route', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('exports redacted evidence and writes an audit log', async () => {
    vi.doMock('@/lib/auth/next-auth.config', () => ({
      auth: vi.fn(async () => ({ user: { id: 'manager-1', role: 'salvage_manager' } })),
    }));
    vi.doMock('@/features/export/services/export.service', () => ({
      ExportService: {
        generateCSV: ({ columns, data }: { columns: Array<{ key: string; header: string }>; data: Array<Record<string, unknown>> }) =>
          [
            columns.map((column) => column.header).join(','),
            ...data.map((row) => columns.map((column) => String(row[column.key] ?? '')).join(',')),
          ].join('\n'),
      },
    }));
    vi.doMock('@/lib/utils/audit-logger', () => ({
      logAction: vi.fn(async () => undefined),
      createAuditLogData: vi.fn((_request, userId, actionType, entityType, entityId, beforeState, afterState) => ({
        userId,
        actionType,
        entityType,
        entityId,
        beforeState,
        afterState,
      })),
      AuditActionType: { REPORT_GENERATED: 'report_generated' },
      AuditEntityType: { KYC: 'kyc' },
    }));
    vi.doMock('@/lib/db/schema/users', () => ({ users: { id: 'users.id', fullName: 'users.fullName', email: 'users.email', phone: 'users.phone', status: 'users.status', role: 'users.role', createdAt: 'users.createdAt' } }));
    vi.doMock('@/lib/db/schema/vendors', () => ({ vendors: { id: 'vendors.id', userId: 'vendors.userId' } }));
    vi.doMock('@/lib/db/schema/intelligence', () => ({ fraudAlerts: { entityId: 'entity_id', entityType: 'entity_type', createdAt: 'created_at' } }));
    vi.doMock('@/lib/db/schema/provider-verifications', () => ({ providerVerificationRecords: { vendorId: 'vendor_id', updatedAt: 'updated_at' } }));
    vi.doMock('@/lib/db/schema/audit-logs', () => ({ auditLogs: { entityId: 'entity_id', createdAt: 'created_at' } }));
    vi.doMock('drizzle-orm', () => ({
      and: vi.fn(() => ({})),
      desc: vi.fn(() => ({})),
      eq: vi.fn(() => ({})),
      inArray: vi.fn(() => ({})),
      or: vi.fn(() => ({})),
    }));

    const selectResults = [
      [{
        id: 'vendor-1',
        userId: 'user-1',
        status: 'pending',
        tier: 'tier1',
        createdAt: new Date('2026-01-01T00:00:00Z'),
        businessName: 'Acme Motors',
        businessType: 'limited_company',
        cacNumber: 'RC123456789',
        tin: 'TIN987654321',
        bankName: 'Demo Bank',
        bankAccountNumber: '0123456789',
        bankAccountName: 'Acme Motors Ltd',
      }],
      [{ id: 'user-1', fullName: 'Vendor One', email: 'vendor@example.com', phone: '+2348012345678', status: 'active', role: 'vendor', createdAt: new Date('2026-01-01T00:00:00Z') }],
      [{
        provider: 'dojah',
        verificationType: 'tier2',
        providerReference: 'ref-1',
        workflowReference: 'ref-1',
        status: 'review_required',
        riskLevel: 'high',
        checksCompleted: ['liveness'],
        pendingChecks: [],
        failedChecks: ['aml_screening'],
        reasonCodes: ['dojah_aml_flagged'],
        reviewedBy: null,
        finalDecision: null,
        decisionReason: null,
        reviewedAt: null,
        updatedAt: new Date('2026-01-02T00:00:00Z'),
      }],
      [{
        status: 'pending',
        riskScore: 80,
        flagReasons: ['dojah_aml_flagged'],
        metadata: { source: 'dojah', providerReference: 'ref-1', reasonCodes: ['dojah_aml_flagged'] },
        createdAt: new Date('2026-01-02T00:00:00Z'),
      }],
    ];

    vi.doMock('@/lib/db/drizzle', () => ({
      db: {
        select: vi.fn(() => makeChain(selectResults.shift() ?? [])),
        query: {
          auditLogs: {
            findMany: vi.fn(async () => [{ createdAt: new Date('2026-01-02T00:00:00Z'), actionType: 'dojah_kyc_review_required', entityType: 'kyc', entityId: 'vendor-1' }]),
          },
        },
      },
    }));

    const route = await import('@/app/api/kyc/approvals/[id]/evidence/export/route');
    const response = await route.GET(
      new NextRequest('https://nemsalvage.com/api/kyc/approvals/vendor-1/evidence/export'),
      { params: Promise.resolve({ id: 'vendor-1' }) }
    );
    const text = await response.text();

    expect(response.status).toBe(200);
    expect(text).toContain('NEM Salvage Vendor Verification Evidence Packet');
    expect(text).toContain('*******6789');
    expect(text).toContain('********4321');
    expect(text).toContain('******6789');
    expect(text).toContain('Linked Fraud Alerts');
    expect(text).toContain('dojah_aml_flagged');
    expect(text).not.toContain('RC123456789');
    expect(text).not.toContain('TIN987654321');
    expect(text).not.toContain('0123456789');
    expect(text.toLowerCase()).not.toContain('rawpayload');
  });
});

describe('fraud alert action route', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('creates audit logs for review actions', async () => {
    const logAction = vi.fn(async () => undefined);
    vi.doMock('@/lib/auth/next-auth.config', () => ({
      auth: vi.fn(async () => ({ user: { id: 'admin-1', role: 'system_admin' } })),
    }));
    vi.doMock('@/lib/utils/audit-logger', () => ({
      logAction,
      createAuditLogData: vi.fn((_request, userId, actionType, entityType, entityId, beforeState, afterState) => ({
        userId,
        actionType,
        entityType,
        entityId,
        beforeState,
        afterState,
      })),
      AuditActionType: {
        FRAUD_FLAG_DISMISSED: 'fraud_flag_dismissed',
        FRAUD_ALERT_UPDATED_FROM_DOJAH: 'fraud_alert_updated_from_dojah',
        VENDOR_SUSPENDED: 'vendor_suspended',
        USER_SUSPENDED: 'user_suspended',
      },
      AuditEntityType: { FRAUD_FLAG: 'fraud_flag', VENDOR: 'vendor', USER: 'user' },
    }));
    vi.doMock('@/lib/redis/client', () => ({ cache: { del: vi.fn(async () => undefined) } }));
    vi.doMock('@/lib/db/schema/users', () => ({ users: { id: 'users.id', role: 'users.role', status: 'users.status', updatedAt: 'users.updatedAt' } }));
    vi.doMock('@/lib/db/schema/vendors', () => ({ vendors: { id: 'vendors.id', userId: 'vendors.userId', status: 'vendors.status', updatedAt: 'vendors.updatedAt' } }));
    vi.doMock('@/lib/db/schema/intelligence', () => ({ fraudAlerts: { id: 'fraud_alerts.id' } }));
    vi.doMock('drizzle-orm', () => ({ eq: vi.fn(() => ({})) }));

    const updateReturning = makeChain([{ id: 'alert-1', status: 'reviewed' }]);
    vi.doMock('@/lib/db/drizzle', () => ({
      db: {
        query: {
          users: { findFirst: vi.fn(async () => ({ id: 'admin-1', role: 'system_admin', fullName: 'Admin User' })) },
        },
        select: vi.fn(() => makeChain([{ id: 'alert-1', entityType: 'vendor', entityId: 'vendor-1', status: 'pending', metadata: { source: 'dojah' } }])),
        update: vi.fn(() => updateReturning),
      },
    }));

    const route = await import('@/app/api/admin/fraud-alerts/[id]/action/route');
    const response = await route.POST(
      new NextRequest('https://nemsalvage.com/api/admin/fraud-alerts/alert-1/action', {
        method: 'POST',
        body: JSON.stringify({ action: 'mark_under_review' }),
        headers: { 'content-type': 'application/json' },
      }),
      { params: Promise.resolve({ id: 'alert-1' }) }
    );

    expect(response.status).toBe(200);
    expect(logAction).toHaveBeenCalledWith(expect.objectContaining({
      actionType: 'fraud_alert_updated_from_dojah',
      entityType: 'fraud_flag',
      entityId: 'alert-1',
    }));
  });
});
