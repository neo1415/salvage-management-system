import { randomUUID, timingSafeEqual } from 'crypto';
import { after } from 'next/server';
import { and, desc, eq, sql } from 'drizzle-orm';
import { db } from '@/lib/db/drizzle';
import {
  auctions,
  releaseForms,
  salvageCases,
  featureVectors,
  pickupEvidence,
} from '@/lib/db/schema';
import {
  AuditActionType,
  AuditEntityType,
  DeviceType,
  logAction,
} from '@/lib/utils/audit-logger';
import { createNotification } from '@/features/notifications/services/notification.service';
import { cache } from '@/lib/redis/client';
import { formatAssetName } from '@/lib/utils/asset-name';
import { getEffectiveSaleAmount, parseNumericAmount } from '@/lib/finance/effective-sale-amount';
import {
  notifyStaffPickupCompleted,
  sendVendorPickupCompletedEmail,
} from './pickup-lifecycle-notifications.service';

export type PickupLifecycleStatus =
  | 'not_ready'
  | 'ready_for_pickup'
  | 'vendor_confirmed'
  | 'staff_confirmed';

export interface PickupContext {
  auctionId: string;
  caseId: string;
  claimReference: string;
  assetType: string;
  assetDetails: Record<string, unknown>;
  assetName: string;
  pickupLocation: string | null;
  vendorId: string;
  vendorUserId: string;
  vendorBusinessName: string | null;
  vendorName: string;
  vendorEmail: string;
  vendorPhone: string | null;
  saleAmount: string | null;
  collectedAmount: string | null;
  paymentId: string | null;
  paymentStatus: string | null;
  paymentVerifiedAt: string | null;
  pickupAuthDocumentId: string | null;
  pickupDeadline: string | null;
  pickupConfirmedVendor: boolean;
  pickupConfirmedVendorAt: string | null;
  pickupConfirmedAdmin: boolean;
  pickupConfirmedAdminAt: string | null;
  pickupConfirmedAdminBy: string | null;
  lifecycleStatus: PickupLifecycleStatus;
}

export interface PickupAuditRequestContext {
  userId: string;
  userName?: string | null;
  role: string;
  ipAddress: string;
  deviceType: DeviceType;
  userAgent: string;
}

interface PickupQueryRow {
  auction_id: string;
  case_id: string;
  current_bid: string | number | null;
  final_settled_amount: string | number | null;
  vendor_id: string;
  pickup_confirmed_vendor: boolean | null;
  pickup_confirmed_vendor_at: Date | string | null;
  pickup_confirmed_admin: boolean | null;
  pickup_confirmed_admin_at: Date | string | null;
  pickup_confirmed_admin_by: string | null;
  claim_reference: string | null;
  asset_type: string | null;
  asset_details: unknown;
  location_name: string | null;
  business_name: string | null;
  full_name: string | null;
  vendor_user_id: string;
  email: string | null;
  phone: string | null;
  payment_id: string | null;
  payment_amount: string | number | null;
  payment_status: string | null;
  verified_at: Date | string | null;
  pickup_auth_document_id: string | null;
  pickup_deadline: string | null;
}

const STAFF_PICKUP_ROLES = new Set(['salvage_manager', 'system_admin']);
const PICKUP_RESOLUTION_STATUSES = new Set([
  'confirmed_no_adjustment',
  'external_reimbursement_required',
  'external_reimbursement_completed',
  'price_adjustment_recorded',
]);

export function canConfirmPickup(role: string | undefined | null): boolean {
  return !!role && STAFF_PICKUP_ROLES.has(role);
}

export function generatePickupAuthorizationCode(auctionId: string): string {
  return `AUTH-${auctionId.substring(0, 8).toUpperCase()}`;
}

export function normalizePickupCode(code: unknown): string {
  return String(code || '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
}

export function redactPickupCode(code: unknown): string {
  const normalized = normalizePickupCode(code);
  if (!normalized) return '';
  return `${normalized.slice(0, 4)}…${normalized.slice(-4)}`;
}

export function verifyPickupAuthorizationCode(storedCode: unknown, submittedCode: unknown): boolean {
  const normalizedStored = normalizePickupCode(storedCode);
  const normalizedSubmitted = normalizePickupCode(submittedCode);

  if (!normalizedStored || !normalizedSubmitted) return false;

  const storedBuffer = Buffer.from(normalizedStored);
  const submittedBuffer = Buffer.from(normalizedSubmitted);
  if (storedBuffer.length !== submittedBuffer.length) return false;

  return timingSafeEqual(storedBuffer, submittedBuffer);
}

export function derivePickupLifecycleStatus(input: {
  hasVerifiedPayment: boolean;
  hasPickupAuthorization: boolean;
  pickupConfirmedVendor?: boolean | null;
  pickupConfirmedAdmin?: boolean | null;
}): PickupLifecycleStatus {
  if (input.pickupConfirmedAdmin) return 'staff_confirmed';
  if (input.pickupConfirmedVendor) return 'vendor_confirmed';
  if (input.hasVerifiedPayment && input.hasPickupAuthorization) return 'ready_for_pickup';
  return 'not_ready';
}

function normalizeAssetDetails(details: unknown): Record<string, unknown> {
  return typeof details === 'object' && details !== null
    ? (details as Record<string, unknown>)
    : {};
}

function toIso(value: Date | string | null | undefined): string | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

async function invalidatePickupCaches(vendorId: string, auctionId: string) {
  await Promise.allSettled([
    cache.del(`dashboard:vendor:${vendorId}`),
    cache.del(`auction:details:${auctionId}`),
    cache.del('dashboard:admin'),
    cache.del('dashboard:finance:v4:||||'),
  ]);
}

async function recordPickupTrainingSignal(context: PickupContext, confirmedAt: Date) {
  const paymentVerifiedAt = context.paymentVerifiedAt ? new Date(context.paymentVerifiedAt) : null;
  const pickupHoursFromPayment =
    paymentVerifiedAt && !Number.isNaN(paymentVerifiedAt.getTime())
      ? (confirmedAt.getTime() - paymentVerifiedAt.getTime()) / (1000 * 60 * 60)
      : null;

  try {
    await db.insert(featureVectors).values({
      entityType: 'auction_pickup',
      entityId: context.auctionId,
      features: {
        assetType: context.assetType,
        make: typeof context.assetDetails.make === 'string' ? context.assetDetails.make : null,
        model: typeof context.assetDetails.model === 'string' ? context.assetDetails.model : null,
        year:
          typeof context.assetDetails.year === 'number'
            ? context.assetDetails.year
            : typeof context.assetDetails.year === 'string'
              ? Number(context.assetDetails.year) || null
              : null,
        damageSeverity: null,
        marketValue: null,
        estimatedSalvageValue: null,
        hourSin: Math.sin((confirmedAt.getHours() / 24) * 2 * Math.PI),
        hourCos: Math.cos((confirmedAt.getHours() / 24) * 2 * Math.PI),
        dayOfWeekSin: Math.sin((confirmedAt.getDay() / 7) * 2 * Math.PI),
        dayOfWeekCos: Math.cos((confirmedAt.getDay() / 7) * 2 * Math.PI),
        monthSin: Math.sin(((confirmedAt.getMonth() + 1) / 12) * 2 * Math.PI),
        monthCos: Math.cos(((confirmedAt.getMonth() + 1) / 12) * 2 * Math.PI),
        competitionLevel: null,
        avgBidsPerAuction: null,
        priceTrend: null,
        vendorRating: null,
        vendorWinRate: null,
        vendorTotalBids: null,
        vendorAvgBidAmount: null,
        damagedPartsCount: null,
        structuralDamageScore: null,
        mechanicalDamageScore: null,
        cosmeticDamageScore: null,
        region: context.pickupLocation,
        regionalDemandScore: pickupHoursFromPayment,
        regionalPriceVariance: null,
      },
      normalizationParams: {
        pickupHoursFromPayment: {
          mean: null,
          stddev: null,
          min: pickupHoursFromPayment,
          max: pickupHoursFromPayment,
        },
      },
      version: 'pickup-v1',
    });
  } catch (error) {
    console.warn('[Pickup] Training signal skipped:', error);
  }
}

function mapPickupRow(row: PickupQueryRow): PickupContext {
  const assetDetails = normalizeAssetDetails(row.asset_details);
  const hasVerifiedPayment = row.payment_status === 'verified';
  const hasPickupAuthorization = !!row.pickup_auth_document_id;

  return {
    auctionId: row.auction_id,
    caseId: row.case_id,
    claimReference: row.claim_reference || 'Unknown',
    assetType: row.asset_type || 'unknown',
    assetDetails,
    assetName: formatAssetName(row.asset_type || 'salvage item', assetDetails, row.claim_reference),
    pickupLocation: row.location_name || null,
    vendorId: row.vendor_id,
    vendorUserId: row.vendor_user_id,
    vendorBusinessName: row.business_name || null,
    vendorName: row.full_name || row.business_name || 'Vendor',
    vendorEmail: row.email || '',
    vendorPhone: row.phone || null,
    saleAmount: (() => {
      const effective = getEffectiveSaleAmount(
        { finalSettledAmount: row.final_settled_amount, currentBid: row.current_bid },
        { amount: row.payment_amount }
      );
      return effective > 0 ? effective.toFixed(2) : null;
    })(),
    collectedAmount: row.payment_amount == null
      ? null
      : (parseNumericAmount(row.payment_amount) ?? 0).toFixed(2),
    paymentId: row.payment_id || null,
    paymentStatus: row.payment_status || null,
    paymentVerifiedAt: toIso(row.verified_at),
    pickupAuthDocumentId: row.pickup_auth_document_id || null,
    pickupDeadline: row.pickup_deadline || null,
    pickupConfirmedVendor: !!row.pickup_confirmed_vendor,
    pickupConfirmedVendorAt: toIso(row.pickup_confirmed_vendor_at),
    pickupConfirmedAdmin: !!row.pickup_confirmed_admin,
    pickupConfirmedAdminAt: toIso(row.pickup_confirmed_admin_at),
    pickupConfirmedAdminBy: row.pickup_confirmed_admin_by || null,
    lifecycleStatus: derivePickupLifecycleStatus({
      hasVerifiedPayment,
      hasPickupAuthorization,
      pickupConfirmedVendor: row.pickup_confirmed_vendor,
      pickupConfirmedAdmin: row.pickup_confirmed_admin,
    }),
  };
}

export async function getPickupContextByAuction(auctionId: string): Promise<PickupContext | null> {
  const rows = await db.execute(sql`
    SELECT DISTINCT ON (a.id)
      a.id AS auction_id,
      a.case_id,
      a.current_bid,
      a.final_settled_amount,
      a.current_bidder AS vendor_id,
      a.pickup_confirmed_vendor,
      a.pickup_confirmed_vendor_at,
      a.pickup_confirmed_admin,
      a.pickup_confirmed_admin_at,
      a.pickup_confirmed_admin_by,
      sc.claim_reference,
      sc.asset_type,
      sc.asset_details,
      sc.location_name,
      v.business_name,
      u.full_name,
      u.id AS vendor_user_id,
      u.email,
      u.phone,
      p.id AS payment_id,
      p.amount AS payment_amount,
      p.status AS payment_status,
      p.verified_at,
      rf.id AS pickup_auth_document_id,
      rf.document_data->>'pickupDeadline' AS pickup_deadline
    FROM auctions a
    INNER JOIN salvage_cases sc ON sc.id = a.case_id
    INNER JOIN vendors v ON v.id = a.current_bidder
    INNER JOIN users u ON u.id = v.user_id
    LEFT JOIN payments p ON p.auction_id = a.id AND p.vendor_id = v.id AND p.status = 'verified'
    LEFT JOIN release_forms rf ON rf.auction_id = a.id
      AND rf.vendor_id = v.id
      AND rf.document_type = 'pickup_authorization'
      AND rf.status != 'voided'
    WHERE a.id = ${auctionId}
    ORDER BY a.id, p.verified_at DESC NULLS LAST, rf.created_at DESC NULLS LAST
  `) as unknown as PickupQueryRow[];

  return rows[0] ? mapPickupRow(rows[0]) : null;
}

export async function getPickupContextByCode(pickupAuthCode: string): Promise<PickupContext | null> {
  const normalizedCode = normalizePickupCode(pickupAuthCode);
  if (!normalizedCode) return null;

  const rows = await db.execute(sql`
    SELECT DISTINCT ON (a.id)
      a.id AS auction_id,
      a.case_id,
      a.current_bid,
      a.final_settled_amount,
      a.current_bidder AS vendor_id,
      a.pickup_confirmed_vendor,
      a.pickup_confirmed_vendor_at,
      a.pickup_confirmed_admin,
      a.pickup_confirmed_admin_at,
      a.pickup_confirmed_admin_by,
      sc.claim_reference,
      sc.asset_type,
      sc.asset_details,
      sc.location_name,
      v.business_name,
      u.full_name,
      u.id AS vendor_user_id,
      u.email,
      u.phone,
      p.id AS payment_id,
      p.amount AS payment_amount,
      p.status AS payment_status,
      p.verified_at,
      rf.id AS pickup_auth_document_id,
      rf.document_data->>'pickupDeadline' AS pickup_deadline
    FROM release_forms rf
    INNER JOIN auctions a ON a.id = rf.auction_id
    INNER JOIN salvage_cases sc ON sc.id = a.case_id
    INNER JOIN vendors v ON v.id = rf.vendor_id
    INNER JOIN users u ON u.id = v.user_id
    LEFT JOIN payments p ON p.auction_id = a.id AND p.vendor_id = v.id AND p.status = 'verified'
    WHERE rf.document_type = 'pickup_authorization'
      AND rf.status != 'voided'
      AND regexp_replace(upper(COALESCE(rf.document_data->>'pickupAuthCode', '')), '[^A-Z0-9]', '', 'g') = ${normalizedCode}
    ORDER BY a.id, p.verified_at DESC NULLS LAST, rf.created_at DESC NULLS LAST
  `) as unknown as PickupQueryRow[];

  return rows[0] ? mapPickupRow(rows[0]) : null;
}

async function notifyVendorPickupConfirmedChannels(context: PickupContext, confirmedAt: Date) {
  const smsMessage = `Pickup confirmed: ${context.assetName}. Your transaction is complete.`;

  if (context.vendorPhone) {
    try {
      const { smsService } = await import('@/features/notifications/services/sms.service');
      await smsService.sendSMS({
        to: context.vendorPhone,
        message: smsMessage,
        userId: context.vendorUserId,
        category: 'routine',
      });
    } catch (error) {
      console.warn('[Pickup] SMS notification failed', {
        auctionId: context.auctionId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  if (context.vendorEmail) {
    try {
      await sendVendorPickupCompletedEmail(context, confirmedAt);
    } catch (error) {
      console.warn('[Pickup] Email notification failed', {
        auctionId: context.auctionId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
}

export async function confirmPickupByStaff(input: {
  pickupAuthCode?: string;
  auctionId?: string;
  notes?: string;
  resolutionStatus?: string;
  adjustmentAmount?: number | string | null;
  reimbursementMethod?: string | null;
  actor: PickupAuditRequestContext;
}): Promise<PickupContext> {
  if (!canConfirmPickup(input.actor.role)) {
    throw new Error('Only salvage managers and system administrators can confirm pickup.');
  }

  const context = input.pickupAuthCode
    ? await getPickupContextByCode(input.pickupAuthCode)
    : input.auctionId
      ? await getPickupContextByAuction(input.auctionId)
      : null;

  if (!context) {
    throw new Error('Pickup authorization was not found.');
  }

  if (context.pickupConfirmedAdmin) {
    return context;
  }

  if (context.paymentStatus !== 'verified') {
    throw new Error('Pickup cannot be confirmed until payment is verified.');
  }

  if (!context.pickupAuthDocumentId) {
    throw new Error('Pickup authorization document is not ready for this auction.');
  }

  const [latestEvidence] = await db
    .select({
      id: pickupEvidence.id,
      comparisonStatus: pickupEvidence.comparisonStatus,
    })
    .from(pickupEvidence)
    .where(eq(pickupEvidence.auctionId, context.auctionId))
    .orderBy(desc(pickupEvidence.createdAt))
    .limit(1);

  const evidenceNeedsReview =
    latestEvidence?.comparisonStatus === 'review_needed'
    || latestEvidence?.comparisonStatus === 'material_discrepancy';
  if (latestEvidence?.comparisonStatus === 'not_reviewed') {
    throw new Error('Pickup evidence comparison is still processing. Try again shortly.');
  }
  const reviewNotes = input.notes?.trim() || '';
  const requestedResolutionStatus = input.resolutionStatus?.trim() || '';
  const resolutionStatus = evidenceNeedsReview
    ? PICKUP_RESOLUTION_STATUSES.has(requestedResolutionStatus)
      ? requestedResolutionStatus
      : 'confirmed_no_adjustment'
    : 'not_required';
  const parsedAdjustmentAmount =
    input.adjustmentAmount === null || input.adjustmentAmount === undefined || input.adjustmentAmount === ''
      ? null
      : Number(input.adjustmentAmount);
  const adjustmentAmount =
    parsedAdjustmentAmount !== null && Number.isFinite(parsedAdjustmentAmount) && parsedAdjustmentAmount >= 0
      ? parsedAdjustmentAmount
      : null;
  const reimbursementMethod = input.reimbursementMethod?.trim() || null;

  if (
    evidenceNeedsReview
    && (resolutionStatus === 'external_reimbursement_required' || resolutionStatus === 'external_reimbursement_completed' || resolutionStatus === 'price_adjustment_recorded')
    && (!adjustmentAmount || adjustmentAmount <= 0)
  ) {
    throw new Error('Enter the agreed adjustment amount for this discrepancy resolution.');
  }

  const now = new Date();

  const auctionUpdate: {
    pickupConfirmedVendor: boolean;
    pickupConfirmedVendorAt: Date;
    pickupConfirmedAdmin: boolean;
    pickupConfirmedAdminAt: Date;
    pickupConfirmedAdminBy: string;
    updatedAt: Date;
    finalSettledAmount?: string;
    priceAdjustedAt?: Date;
    originalWinningBid?: string;
  } = {
    pickupConfirmedVendor: true,
    pickupConfirmedVendorAt: context.pickupConfirmedVendorAt ? new Date(context.pickupConfirmedVendorAt) : now,
    pickupConfirmedAdmin: true,
    pickupConfirmedAdminAt: now,
    pickupConfirmedAdminBy: input.actor.userId,
    updatedAt: now,
  };

  if (resolutionStatus === 'price_adjustment_recorded' && adjustmentAmount !== null) {
    auctionUpdate.finalSettledAmount = adjustmentAmount.toFixed(2);
    auctionUpdate.priceAdjustedAt = now;
    const original = parseNumericAmount(context.saleAmount) ?? adjustmentAmount;
    auctionUpdate.originalWinningBid = original.toFixed(2);
  }

  await db.transaction(async (tx) => {
    await tx
      .update(auctions)
      .set(auctionUpdate)
      .where(eq(auctions.id, context.auctionId));

    await tx
      .update(salvageCases)
      .set({
        status: 'sold',
        updatedAt: now,
      })
      .where(eq(salvageCases.id, context.caseId));

    if (evidenceNeedsReview && latestEvidence?.id) {
      await tx
        .update(pickupEvidence)
        .set({
          reviewedBy: input.actor.userId,
          reviewedAt: now,
          reviewNotes,
          resolutionStatus,
          adjustmentAmount: adjustmentAmount === null ? null : adjustmentAmount.toFixed(2),
          reimbursementMethod,
          updatedAt: now,
        })
        .where(eq(pickupEvidence.id, latestEvidence.id));
    }
  });

  const updated = await getPickupContextByAuction(context.auctionId);
  const finalContext = updated || {
    ...context,
    pickupConfirmedVendor: true,
    pickupConfirmedVendorAt: toIso(context.pickupConfirmedVendorAt) || now.toISOString(),
    pickupConfirmedAdmin: true,
    pickupConfirmedAdminAt: now.toISOString(),
    pickupConfirmedAdminBy: input.actor.userId,
    lifecycleStatus: 'staff_confirmed' as const,
  };

  await invalidatePickupCaches(context.vendorId, context.auctionId);

  after(async () => {
    await Promise.allSettled([
      createNotification({
        userId: context.vendorUserId,
        type: 'PICKUP_CONFIRMED_ADMIN',
        title: 'Pickup Confirmed',
        message: `${context.assetName} pickup is confirmed. Review the receipt for final settlement details.`,
        data: {
          auctionId: context.auctionId,
          caseId: context.caseId,
          pickupConfirmedAt: now.toISOString(),
        },
      }),
      notifyVendorPickupConfirmedChannels(finalContext, now),
      notifyStaffPickupCompleted(finalContext, now),
      logAction({
      userId: input.actor.userId,
      actionType: AuditActionType.PICKUP_CONFIRMED_ADMIN,
      entityType: AuditEntityType.AUCTION,
      entityId: context.auctionId,
      ipAddress: input.actor.ipAddress,
      deviceType: input.actor.deviceType,
      userAgent: input.actor.userAgent,
      beforeState: {
        pickupConfirmedVendor: context.pickupConfirmedVendor,
        pickupConfirmedAdmin: context.pickupConfirmedAdmin,
        caseStatus: 'pre_pickup_confirmation',
      },
      afterState: {
        pickupConfirmedVendor: true,
        pickupConfirmedAdmin: true,
        pickupConfirmedAdminAt: now.toISOString(),
        pickupConfirmedAdminBy: input.actor.userId,
        confirmedByRole: input.actor.role,
        codeProvided: !!input.pickupAuthCode,
        pickupCodeRedacted: input.pickupAuthCode ? redactPickupCode(input.pickupAuthCode) : undefined,
        notes: input.notes?.trim() || null,
        pickupEvidenceResolution: evidenceNeedsReview
          ? {
              resolutionStatus,
              adjustmentAmount,
              reimbursementMethod,
              pickupEvidenceId: latestEvidence?.id,
            }
          : undefined,
        caseStatus: 'sold',
      },
      }),
      recordPickupTrainingSignal(finalContext, now),
    ]);
  });

  return finalContext;
}

export async function confirmPickupByVendor(input: {
  auctionId: string;
  vendorId: string;
  pickupAuthCode: string;
  actor: PickupAuditRequestContext;
}): Promise<PickupContext> {
  const context = await getPickupContextByAuction(input.auctionId);

  if (!context || context.vendorId !== input.vendorId) {
    throw new Error('Only the auction winner can confirm pickup.');
  }

  if (context.pickupConfirmedVendor) {
    throw new Error('Pickup already confirmed by vendor.');
  }

  const [pickupAuthDoc] = await db
    .select()
    .from(releaseForms)
    .where(
      and(
        eq(releaseForms.auctionId, input.auctionId),
        eq(releaseForms.vendorId, input.vendorId),
        eq(releaseForms.documentType, 'pickup_authorization')
      )
    )
    .limit(1);

  if (!pickupAuthDoc?.documentData?.pickupAuthCode) {
    throw new Error('Pickup authorization code not generated yet.');
  }

  if (!verifyPickupAuthorizationCode(pickupAuthDoc.documentData.pickupAuthCode, input.pickupAuthCode)) {
    throw new Error('Invalid pickup authorization code.');
  }

  const now = new Date();
  await db
    .update(auctions)
    .set({
      pickupConfirmedVendor: true,
      pickupConfirmedVendorAt: now,
      updatedAt: now,
    })
    .where(eq(auctions.id, input.auctionId));

  await Promise.allSettled([
    logAction({
      userId: input.actor.userId,
      actionType: AuditActionType.PICKUP_CONFIRMED_VENDOR,
      entityType: AuditEntityType.AUCTION,
      entityId: input.auctionId,
      ipAddress: input.actor.ipAddress,
      deviceType: input.actor.deviceType,
      userAgent: input.actor.userAgent,
      beforeState: { pickupConfirmedVendor: false },
      afterState: {
        pickupConfirmedVendor: true,
        pickupConfirmedVendorAt: now.toISOString(),
        vendorId: input.vendorId,
        pickupCodeRedacted: redactPickupCode(input.pickupAuthCode),
      },
    }),
    invalidatePickupCaches(input.vendorId, input.auctionId),
  ]);

  const updated = await getPickupContextByAuction(input.auctionId);
  if (!updated) throw new Error('Pickup was confirmed but could not be reloaded.');
  return updated;
}

export function createPickupAttemptId(): string {
  return randomUUID();
}
