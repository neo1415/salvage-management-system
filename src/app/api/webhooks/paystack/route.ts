import { NextRequest, NextResponse } from 'next/server';
import {
  processPaystackWebhook,
  type PaystackWebhookPayload,
} from '@/features/payments/services/paystack.service';

export async function POST(request: NextRequest) {
  try {
    // Get the raw body as text for signature verification
    const rawBody = await request.text();
    
    // Get the signature from headers
    const signature = request.headers.get('x-paystack-signature');

    if (!signature) {
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

    // Parse the payload
    const payload: PaystackWebhookPayload = JSON.parse(rawBody);

    // Process the webhook
    await processPaystackWebhook(payload, signature, rawBody);

    // Return success response
    return NextResponse.json(
      {
        status: 'success',
        message: 'Webhook processed successfully',
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Webhook processing error:', error);

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
