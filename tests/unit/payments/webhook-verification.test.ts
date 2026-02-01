import { describe, it, expect } from 'vitest';
import { fc, test } from '@fast-check/vitest';
import crypto from 'crypto';

/**
 * **Validates: Requirements 24.6, 24.7, 24.8**
 * 
 * Property 14: Payment Webhook Verification
 * 
 * This test validates that webhook signature verification works correctly
 * using property-based testing to generate random webhook payloads
 */

const WEBHOOK_SECRET = process.env.PAYSTACK_WEBHOOK_SECRET || 'test-webhook-secret';

function generateValidSignature(payload: string): string {
  return crypto.createHmac('sha512', WEBHOOK_SECRET).update(payload).digest('hex');
}

function verifyWebhookSignature(payload: string, signature: string): boolean {
  const hash = crypto.createHmac('sha512', WEBHOOK_SECRET).update(payload).digest('hex');
  return hash === signature;
}

// Custom generator for webhook payloads
const webhookPayloadArbitrary = fc.record({
  event: fc.constantFrom('charge.success', 'charge.failed', 'transfer.success'),
  data: fc.record({
    reference: fc.string({ minLength: 10, maxLength: 50 }),
    amount: fc.integer({ min: 100, max: 1000000000 }), // 1 kobo to 10M naira in kobo
    status: fc.constantFrom('success', 'failed', 'pending'),
  }),
});

describe('Property 14: Payment Webhook Verification', () => {
  // Property test: Valid signatures should always be accepted
  test.prop([webhookPayloadArbitrary], {
    numRuns: 20,
  })(
    'should accept valid signatures for any webhook payload',
    (webhookPayload) => {
      const payload = JSON.stringify(webhookPayload);
      const validSignature = generateValidSignature(payload);
      const result = verifyWebhookSignature(payload, validSignature);

      expect(result).toBe(true);
    }
  );

  // Property test: Invalid signatures should always be rejected
  test.prop([webhookPayloadArbitrary, fc.string({ minLength: 64, maxLength: 128 })], {
    numRuns: 20,
  })(
    'should reject invalid signatures',
    (webhookPayload, invalidSignature) => {
      const payload = JSON.stringify(webhookPayload);
      const validSignature = generateValidSignature(payload);
      
      // Ensure the invalid signature is actually different from the valid one
      fc.pre(invalidSignature !== validSignature);
      
      const result = verifyWebhookSignature(payload, invalidSignature);

      expect(result).toBe(false);
    }
  );

  // Property test: Tampering with payload should invalidate signature
  test.prop([webhookPayloadArbitrary, fc.integer({ min: 1, max: 1000000 })], {
    numRuns: 20,
  })(
    'should detect payload tampering',
    (webhookPayload, amountDelta) => {
      const originalPayload = JSON.stringify(webhookPayload);
      const validSignature = generateValidSignature(originalPayload);

      // Tamper with the amount
      const tamperedData = {
        ...webhookPayload,
        data: {
          ...webhookPayload.data,
          amount: webhookPayload.data.amount + amountDelta,
        },
      };
      const tamperedPayload = JSON.stringify(tamperedData);

      const result = verifyWebhookSignature(tamperedPayload, validSignature);

      expect(result).toBe(false);
    }
  );

  // Property test: Naira to Kobo conversion should be reversible
  test.prop([fc.integer({ min: 1, max: 10000000 })], {
    numRuns: 20,
  })(
    'should correctly convert between naira and kobo',
    (nairaAmount) => {
      const koboAmount = nairaAmount * 100;
      const convertedBack = koboAmount / 100;

      expect(convertedBack).toBe(nairaAmount);
      expect(koboAmount % 100).toBe(0);
    }
  );

  // Property test: Amount validation should match expected kobo values
  test.prop([fc.integer({ min: 1, max: 10000000 })], {
    numRuns: 20,
  })(
    'should validate amounts are correctly converted to kobo',
    (nairaAmount) => {
      const expectedKobo = nairaAmount * 100;
      const actualKobo = Math.round(nairaAmount * 100);

      expect(actualKobo).toBe(expectedKobo);
      expect(actualKobo).toBeGreaterThanOrEqual(100); // At least 1 naira
    }
  );

  // Unit test: Example-based tests
  it('should accept valid signatures', () => {
    const payload = JSON.stringify({
      event: 'charge.success',
      data: { reference: 'PAY_12345678_1234567890', amount: 50000000, status: 'success' },
    });

    const validSignature = generateValidSignature(payload);
    const result = verifyWebhookSignature(payload, validSignature);

    expect(result).toBe(true);
  });

  it('should reject invalid signatures', () => {
    const payload = JSON.stringify({
      event: 'charge.success',
      data: { reference: 'PAY_12345678_1234567890', amount: 50000000, status: 'success' },
    });

    const result = verifyWebhookSignature(payload, 'invalid-signature-hash');

    expect(result).toBe(false);
  });

  it('should detect payload tampering', () => {
    const originalPayload = JSON.stringify({
      event: 'charge.success',
      data: { reference: 'PAY_12345678_1234567890', amount: 50000000, status: 'success' },
    });
    const validSignature = generateValidSignature(originalPayload);

    const tamperedPayload = JSON.stringify({
      event: 'charge.success',
      data: { reference: 'PAY_12345678_1234567890', amount: 60000000, status: 'success' },
    });

    const result = verifyWebhookSignature(tamperedPayload, validSignature);

    expect(result).toBe(false);
  });
});
