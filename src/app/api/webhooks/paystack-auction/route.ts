/**
 * Paystack Webhook Handler for Auction Deposit System
 * 
 * This webhook handles Paystack payment confirmations for auction payments
 * and atomically unfreezes the deposit when payment is successful.
 * 
 * Requirements:
 * - Requirement 15: Paystack-Only Payment Processing
 * - Requirement 16: Hybrid Payment Processing
 * - Requirement 28: Idempotent Payment Processing
 * 
 * SECURITY: Signature verification, idempotency, atomic transactions
 */

import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { paymentService } from '@/features/auction-deposit/services/payment.service';

interface PaystackWebhookPayload {
  event: string;
  data: {
    reference: string;
    amount: number;
    status: string;
    paid_at: string;
    customer: {
      email: string;
    };
  };
}

/**
 * Verify Paystack webhook signature
 */
function verifySignature(payload: string, signature: string): boolean {
  const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY;
  if (!PAYSTACK_SECRET_KEY) {
    throw new Error('PAYSTACK_SECRET_KEY not configured');
  }
  
  const hash = crypto
    .createHmac('sha512', PAYSTACK_SECRET_KEY)
    .update(payload)
    .digest('hex');
  
  return hash === signature;
}

/**
 * POST /api/webhooks/paystack-auction
 * Handle Paystack webhook for auction payments
 */
export async function POST(request: NextRequest) {
  try {
    console.log('📥 Paystack webhook received');
    
    // Get raw body for signature verification
    const rawBody = await request.text();
    
    // Get signature from headers
    const signature = request.headers.get('x-paystack-signature');
    
    if (!signature) {
      console.error('❌ Missing webhook signature');
      return NextResponse.json(
        { error: 'Missing signature' },
        { status: 400 }
      );
    }
    
    // Verify signature
    if (!verifySignature(rawBody, signature)) {
      console.error('❌ Invalid webhook signature');
      return NextResponse.json(
        { error: 'Invalid signature' },
        { status: 401 }
      );
    }
    
    // Parse payload
    const payload: PaystackWebhookPayload = JSON.parse(rawBody);
    
    console.log('Webhook event:', payload.event);
    console.log('Payment reference:', payload.data.reference);
    console.log('Payment status:', payload.data.status);
    
    // Only process successful charge events
    if (payload.event !== 'charge.success') {
      console.log('ℹ️ Ignoring non-success event:', payload.event);
      return NextResponse.json({ message: 'Event ignored' }, { status: 200 });
    }
    
    // Check if payment was successful
    const success = payload.data.status === 'success';
    
    if (!success) {
      console.log('ℹ️ Payment not successful:', payload.data.status);
      return NextResponse.json({ message: 'Payment not successful' }, { status: 200 });
    }
    
    // Process the webhook
    console.log('✅ Processing successful payment...');
    await paymentService.handlePaystackWebhook(payload.data.reference, true);
    
    console.log('✅ Webhook processed successfully');
    
    return NextResponse.json(
      { message: 'Webhook processed successfully' },
      { status: 200 }
    );
  } catch (error) {
    console.error('❌ Webhook processing error:', error);
    
    return NextResponse.json(
      {
        error: 'Webhook processing failed',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
