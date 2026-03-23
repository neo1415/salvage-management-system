/**
 * Flutterwave Webhook Handler
 * 
 * API route that receives and processes webhook events from Flutterwave.
 * This endpoint handles payment confirmation webhooks and auto-verifies
 * successful payments.
 * 
 * @module FlutterwaveWebhookRoute
 * @route POST /api/webhooks/flutterwave
 * 
 * @security
 * - Webhook signature verification required (verif-hash header)
 * - HMAC SHA-256 signature validation
 * - Rejects requests with invalid signatures
 * 
 * @headers
 * - verif-hash: Flutterwave webhook signature (required)
 * - Content-Type: application/json
 * 
 * @requestBody
 * - event: Event type (e.g., 'charge.completed')
 * - data: Event data containing transaction details
 * 
 * @responses
 * - 200: Webhook processed successfully
 * - 400: Missing signature
 * - 500: Webhook processing error
 * 
 * @example
 * ```typescript
 * // Flutterwave sends POST request
 * POST /api/webhooks/flutterwave
 * Headers: { 'verif-hash': 'abc123...' }
 * Body: { event: 'charge.completed', data: {...} }
 * ```
 * 
 * @compliance
 * - NDPR compliant (audit logging)
 * - PCI DSS considerations
 * 
 * @author NEM Insurance Development Team
 * @version 1.0.0
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  processFlutterwaveWebhook,
  type FlutterwaveWebhookPayload,
} from '@/features/payments/services/flutterwave.service';

/**
 * POST handler for Flutterwave webhooks
 * 
 * Receives webhook events from Flutterwave, validates the signature,
 * and processes the event. This endpoint is called by Flutterwave
 * when payment events occur.
 * 
 * @async
 * @function POST
 * @param {NextRequest} request - Next.js request object
 * @returns {Promise<NextResponse>} JSON response with status
 * 
 * @throws {Error} If signature is missing (400)
 * @throws {Error} If webhook processing fails (500)
 * 
 * @example
 * ```typescript
 * // Flutterwave webhook call
 * POST /api/webhooks/flutterwave
 * Headers: { 'verif-hash': 'signature' }
 * Body: { event: 'charge.completed', data: {...} }
 * 
 * // Response
 * { status: 'success', message: 'Webhook processed successfully' }
 * ```
 * 
 * @security
 * - Validates webhook signature before processing
 * - Rejects requests with missing or invalid signatures
 * - All processing errors are logged
 * 
 * @performance
 * - Target response time: <1 second
 * - Async processing for notifications
 */
export async function POST(request: NextRequest) {
  try {
    // Get the raw body as text for signature verification
    const rawBody = await request.text();
    
    // Get the signature from headers
    const signature = request.headers.get('verif-hash');

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
    const payload: FlutterwaveWebhookPayload = JSON.parse(rawBody);

    // Process the webhook
    await processFlutterwaveWebhook(payload, signature, rawBody);

    // Return success response
    return NextResponse.json(
      {
        status: 'success',
        message: 'Webhook processed successfully',
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Flutterwave webhook processing error:', error);

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
