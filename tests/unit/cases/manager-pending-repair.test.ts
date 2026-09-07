import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ auth: vi.fn(), assess: vi.fn(), limit: vi.fn(), set: vi.fn(), whereUpdate: vi.fn() }));
vi.mock('@/lib/auth/next-auth.config', () => ({ auth: mocks.auth }));
vi.mock('@/lib/db/drizzle', () => ({ db: { select: () => ({ from: () => ({ where: () => ({ limit: mocks.limit }) }) }), update: () => ({ set: mocks.set }) } }));
vi.mock('@/features/business-policy/business-policy.service', () => ({ businessPolicyService: { getEffectivePolicy: async () => ({ cases: { aiDamageAssessmentRunner: 'salvage_manager' } }) } }));
vi.mock('@/features/cases/services/ai-assessment-enhanced.service', () => ({ assessDamageEnhanced: mocks.assess }));
import { POST } from '@/app/api/cases/[id]/ai-assessment/route';
import { ValuationUnavailableError, canApprovePendingRepair } from '@/features/valuations/services/valuation-unavailable';
import { NextRequest } from 'next/server';
beforeEach(() => {
  vi.clearAllMocks(); mocks.auth.mockResolvedValue({ user: { id: 'manager', role: 'salvage_manager' } });
  mocks.limit.mockResolvedValue([{ id: 'case-1', status: 'pending_approval', assetType: 'vehicle', assetDetails: { make: 'Jeep', model: 'Wrangler', year: 2015 }, photos: ['a','b','c'] }]);
  mocks.set.mockReturnValue({ where: mocks.whereUpdate }); mocks.whereUpdate.mockResolvedValue(undefined);
});
describe('manager assessment with missing repair pricing', () => {
  it('requires an explicit finite manual salvage value and retains the existing zero-value policy', () => {
    const partial = { valuationStatus: 'repair_pricing_pending' };
    for (const value of [undefined, null, NaN, Infinity, -1, '900000']) expect(canApprovePendingRepair(partial, value)).toBe(false);
    expect(canApprovePendingRepair(partial, 900_000)).toBe(true);
    expect(canApprovePendingRepair(partial, 0)).toBe(true);
    expect(canApprovePendingRepair({}, undefined)).toBe(true);
  });
  it('saves the completed analysis with null salvage instead of discarding it or retaining an old value', async () => {
    const error = new ValuationUnavailableError('Missing suspension price');
    error.partialAssessment = { marketValue: 27_000_000, damageSeverity: 'moderate', labels: [], confidenceScore: 0, damagePercentage: 9, processedAt: new Date(), summary: 'Visible bumper damage; suspension inspection required.', valuationStatus: 'repair_pricing_pending', manualReviewRequired: true, reviewReasons: ['Confirm suspension damage and repair costs'] };
    mocks.assess.mockRejectedValue(error);
    const response = await POST(new NextRequest('http://localhost/api/cases/case-1/ai-assessment', { method: 'POST', body: '{}' }), { params: Promise.resolve({ id: 'case-1' }) });
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ success: true, data: { estimatedSalvageValue: null, valuationStatus: 'repair_pricing_pending', marketValue: 27_000_000 } });
    expect(mocks.set).toHaveBeenCalledWith(expect.objectContaining({ estimatedSalvageValue: null, reservePrice: null, marketValue: '27000000', aiAssessment: expect.objectContaining({ manualReviewRequired: true }) }));
  });
  it('does not save a price when market research itself failed', async () => {
    mocks.assess.mockRejectedValue(new ValuationUnavailableError());
    const response = await POST(new NextRequest('http://localhost/api/cases/case-1/ai-assessment', { method: 'POST', body: '{}' }), { params: Promise.resolve({ id: 'case-1' }) });
    expect(response.status).toBe(422); expect(mocks.set).not.toHaveBeenCalled();
  });
});
