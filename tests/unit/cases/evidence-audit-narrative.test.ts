import { describe, expect, it } from 'vitest';
import { buildCaseEvidenceAuditNarrative } from '@/lib/cases/evidence-audit-narrative';

describe('buildCaseEvidenceAuditNarrative', () => {
  it('builds chronological operational narrative', () => {
    const createdAt = new Date('2026-01-01T10:00:00Z');
    const approvedAt = new Date('2026-01-02T10:00:00Z');
    const startTime = new Date('2026-01-03T10:00:00Z');
    const bid1At = new Date('2026-01-03T11:00:00Z');
    const bid2At = new Date('2026-01-03T12:00:00Z');
    const endTime = new Date('2026-01-04T10:00:00Z');
    const signedAt = new Date('2026-01-05T10:00:00Z');
    const verifiedAt = new Date('2026-01-06T10:00:00Z');
    const pickupVendorAt = new Date('2026-01-07T10:00:00Z');
    const pickupAdminAt = new Date('2026-01-08T10:00:00Z');

    const events = buildCaseEvidenceAuditNarrative({
      claimReference: 'CLM-001',
      adjusterName: 'Ada Lovelace',
      createdAt,
      approvedAt,
      winnerName: 'Vendor B',
      auction: {
        startTime,
        endTime,
        currentBid: '500000',
        pickupConfirmedVendor: true,
        pickupConfirmedVendorAt: pickupVendorAt,
        pickupConfirmedAdmin: true,
        pickupConfirmedAdminAt: pickupAdminAt,
      },
      bids: [
        { vendorName: 'Vendor A', amount: '400000', createdAt: bid1At },
        { vendorName: 'Vendor B', amount: '500000', createdAt: bid2At },
      ],
      payments: [
        {
          vendorName: 'Vendor B',
          amount: '500000',
          status: 'verified',
          verifiedAt,
          createdAt: verifiedAt,
        },
      ],
      documents: [
        {
          vendorName: 'Vendor B',
          title: 'Bill of Sale',
          documentType: 'bill_of_sale',
          status: 'signed',
          signedAt,
          createdAt: signedAt,
        },
      ],
      pickupEvidence: [
        {
          vendorName: 'Vendor B',
          createdAt: pickupVendorAt,
          reviewedAt: pickupAdminAt,
        },
      ],
    });

    expect(events[0].description).toContain('CLM-001');
    expect(events.some((event) => event.description.includes('approved the case'))).toBe(true);
    expect(events.some((event) => event.description.includes('opening bid'))).toBe(true);
    expect(events.some((event) => event.description.includes('outbid'))).toBe(true);
    expect(events.some((event) => event.description.includes('auction closed'))).toBe(true);
    expect(events.some((event) => event.description.includes('signed the Bill of Sale'))).toBe(true);
    expect(events.some((event) => event.description.includes('completed payment'))).toBe(true);
    expect(events.some((event) => event.description.includes('submitted pickup evidence'))).toBe(true);
    expect(events.some((event) => event.description.includes('Staff confirmed pickup'))).toBe(true);
    expect(events[events.length - 1].at).toEqual(pickupAdminAt);
  });
});
