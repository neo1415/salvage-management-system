import { NextRequest, NextResponse } from 'next/server';
import {
  processPaystackWebhook,
  type PaystackWebhookPayload,
} from '@/features/payments/services/paystack.service';
import { paymentService } from '@/features/auction-deposit/services/payment.service';
import crypto from 'crypto';

/**
 * Unified Paystack Webhook Handler
 * 
 * This webhook handles ALL Paystack payments:
 * - Wallet funding (reference starts with "WF-")
 * - Auction payments (reference starts with "PAY-" or "PAY_")
 * 
 * Routes to the appropriate handler based on payment reference pattern.
 */

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

export async function POST(request: NextRequest) {
  try {
    console.log('📥 Paystack webhook received (unified handler)');
    
    // Get the raw body as text for signature verification
    const rawBody = await request.text();
    
    // Get the signature from headers
    const signature = request.headers.get('x-paystack-signature');

    if (!signature) {
      console.error('❌ Missing webhook signature');
      return NextResponse.json(
        {
          status: 'error',
          error: {
            code: 'MISSING_SIGNATURE',
            message: 'Webhook signature is missing',
            timestamp: new Date().toISOString(),
          },
        },
        { status: 400 }
      );
    }

    // Verify signature
    if (!verifySignature(rawBody, signature)) {
      console.error('❌ Invalid webhook signature');
      return NextResponse.json(
        {
          status: 'error',
          error: {
            code: 'INVALID_SIGNATURE',
            message: 'Webhook signature verification failed',
            timestamp: new Date().toISOString(),
          },
        },
        { status: 401 }
      );
    }

    // Parse the payload
    const payload: PaystackWebhookPayload = JSON.parse(rawBody);
    
    console.log('Webhook event:', payload.event);
    console.log('Payment reference:', payload.data?.reference);

    // Only process successful charge events
    if (payload.event !== 'charge.success') {
      console.log('ℹ️ Ignoring non-success event:', payload.event);
      return NextResponse.json(
        {
          status: 'success',
          message: 'Event ignored (not charge.success)',
        },
        { status: 200 }
      );
    }

    // Check if payment was successful
    if (payload.data?.status !== 'success') {
      console.log('ℹ️ Payment not successful:', payload.data?.status);
      return NextResponse.json(
        {
          status: 'success',
          message: 'Payment not successful',
        },
        { status: 200 }
      );
    }

    const reference = payload.data.reference;

    // Route to appropriate handler based on reference pattern
    if (reference.startsWith('PAY-') || reference.startsWith('PAY_')) {
      // Auction payment
      console.log('🎯 Routing to auction payment handler');
      await paymentService.handlePaystackWebhook(reference, true);
      console.log('✅ Auction payment processed successfully');
    } else if (reference.startsWith('REG-')) {
      // Registration fee payment
      console.log('💳 Routing to registration fee handler');
      const { registrationFeeService } = await import('@/features/vendors/services/registration-fee.service');
      await registrationFeeService.handleRegistrationFeeWebhook(reference, true);
      console.log('✅ Registration fee processed successfully');
    } else {
      // Wallet funding or other payment
      console.log('💰 Routing to wallet funding handler');
      await processPaystackWebhook(payload, signature, rawBody);
      console.log('✅ Wallet funding processed successfully');
    }

    // Return success response
    return NextResponse.json(
      {
        status: 'success',
        message: 'Webhook processed successfully',
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('❌ Webhook processing error:', error);

    // Return error response
    return NextResponse.json(
      {
        status: 'error',
        error: {
          code: 'WEBHOOK_PROCESSING_ERROR',
          message: error instanceof Error ? error.message : 'Failed to process webhook',
          timestamp: new Date().toISOString(),
        },
      },
      { status: 500 }
    );
  }
}
