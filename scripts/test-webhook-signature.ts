import crypto from 'crypto';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const PAYSTACK_WEBHOOK_SECRET = process.env.PAYSTACK_WEBHOOK_SECRET!;

// Sample webhook payload from your ngrok logs
const samplePayload = JSON.stringify({
  "event": "charge.success",
  "data": {
    "id": 5803673233,
    "domain": "test",
    "status": "success",
    "reference": "WALLET_8f63926d_1770138613068",
    "amount": 20000000,
    "message": null,
    "gateway_response": "Successful",
    "paid_at": "2026-02-03T17:10:21.000Z",
    "created_at": "2026-02-03T17:10:13.000Z",
    "channel": "card",
    "currency": "NGN",
    "ip_address": "102.89.23.110",
    "metadata": {
      "walletId": "8f63926d-6550-4667-85ed-242514adc549",
      "vendorId": "03e25544-54e0-427e-b64d-1e9c824321d6",
      "type": "wallet_funding",
      "custom_fields": [
        {
          "display_name": "Wallet ID",
          "variable_name": "wallet_id",
          "value": "8f63926d-6550-4667-85ed-242514adc549"
        },
        {
          "display_name": "Vendor ID",
          "variable_name": "vendor_id",
          "value": "03e25544-54e0-427e-b64d-1e9c824321d6"
        }
      ],
      "referrer": "http://localhost:3000/"
    },
    "fees_breakdown": null,
    "log": null,
    "fees": 200000,
    "fees_split": null,
    "authorization": {
      "authorization_code": "AUTH_w9ydiv21t7",
      "bin": "408408",
      "last4": "4081",
      "exp_month": "12",
      "exp_year": "2030",
      "channel": "card",
      "card_type": "visa ",
      "bank": "TEST BANK",
      "country_code": "NG",
      "brand": "visa",
      "reusable": true,
      "signature": "SIG_bmIbCI2M194ZJk5bUWf0",
      "account_name": null,
      "receiver_bank_account_number": null,
      "receiver_bank": null
    },
    "customer": {
      "id": 336891239,
      "first_name": null,
      "last_name": null,
      "email": "adneo502@gmail.com",
      "customer_code": "CUS_83o63usna30a99g",
      "phone": null,
      "metadata": null,
      "risk_action": "default",
      "international_format_phone": null
    },
    "plan": {},
    "subaccount": {},
    "split": {},
    "order_id": null,
    "paidAt": "2026-02-03T17:10:21.000Z",
    "requested_amount": 20000000,
    "pos_transaction_data": null,
    "source": {
      "type": "api",
      "source": "merchant_api",
      "entry_point": "transaction_initialize",
      "identifier": null
    }
  }
});

console.log('=== WEBHOOK SIGNATURE TEST ===');
console.log('Secret from .env:', PAYSTACK_WEBHOOK_SECRET);
console.log('Secret length:', PAYSTACK_WEBHOOK_SECRET.length);
console.log('');

// Test with the secret as-is
const hash1 = crypto.createHmac('sha512', PAYSTACK_WEBHOOK_SECRET).update(samplePayload).digest('hex');
console.log('Hash with secret as-is:', hash1);
console.log('');

// Test with base64 decoded secret (if it's base64)
try {
  const decodedSecret = Buffer.from(PAYSTACK_WEBHOOK_SECRET, 'base64').toString('utf-8');
  const hash2 = crypto.createHmac('sha512', decodedSecret).update(samplePayload).digest('hex');
  console.log('Hash with base64-decoded secret:', hash2);
  console.log('Decoded secret:', decodedSecret);
} catch (error) {
  console.log('Failed to decode as base64');
}

console.log('');
console.log('INSTRUCTIONS:');
console.log('1. Make a new payment to trigger a webhook');
console.log('2. Check ngrok logs for the x-paystack-signature header');
console.log('3. Compare it with the hashes above');
console.log('4. If neither matches, the secret in .env is wrong');
console.log('5. Get the correct secret from Paystack Dashboard > Settings > Webhooks');
