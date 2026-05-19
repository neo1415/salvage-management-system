import 'dotenv/config';

const baseUrl = process.env.DOJAH_BASE_URL || 'https://api.dojah.io';
const appId = process.env.DOJAH_APP_ID;
const apiKey =
  process.env.DOJAH_API_KEY ||
  process.env.DOJAH_PROD_PRIVATE_API_KEY ||
  process.env.DOJAH_API_TOKEN;
const webhookSecret = process.env.DOJAH_WEBHOOK_SECRET;
const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
const webhookPublicUrl = process.env.DOJAH_WEBHOOK_PUBLIC_URL;
const nodeEnv = process.env.NODE_ENV || 'development';
const confirmed = process.argv.includes('--confirm');

const services = (process.env.DOJAH_WEBHOOK_SERVICES || 'kyc_widget,address,AML Monitoring,Business Registration')
  .split(',')
  .map((service) => service.trim())
  .filter(Boolean);

if (!appId || !apiKey || !webhookSecret) {
  throw new Error('Missing DOJAH_APP_ID, DOJAH_API_KEY/DOJAH_PROD_PRIVATE_API_KEY, or DOJAH_WEBHOOK_SECRET');
}

const candidateBaseUrl = (webhookPublicUrl || appUrl).replace(/\/$/, '');
const isLocalhost = /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(?::\d+)?/i.test(candidateBaseUrl);
const isHttps = candidateBaseUrl.startsWith('https://');

const webhook = `${candidateBaseUrl}/api/webhooks/dojah?secret=${encodeURIComponent(webhookSecret)}`;
const redactedWebhook = `${candidateBaseUrl}/api/webhooks/dojah?secret=<redacted>`;

async function subscribe(service: string) {
  const response = await fetch(`${baseUrl.replace(/\/$/, '')}/api/v1/webhook/subscribe`, {
    method: 'POST',
    headers: {
      AppId: appId!,
      Authorization: apiKey!,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ webhook, service }),
  });

  const body = await response.text();
  return {
    service,
    status: response.status,
    ok: response.ok,
    body,
  };
}

async function main() {
  console.log('[Dojah Webhook Subscribe] Environment summary');
  console.log(`NODE_ENV: ${nodeEnv}`);
  console.log(`NEXT_PUBLIC_APP_URL: ${appUrl}`);
  console.log(`DOJAH_WEBHOOK_PUBLIC_URL: ${webhookPublicUrl || '(not set)'}`);
  console.log(`Final webhook URL: ${redactedWebhook}`);
  console.log(`Selected services: ${services.join(', ') || '(none)'}`);

  if (!confirmed) {
    console.log('');
    if (isLocalhost) {
      console.log('Warning: current webhook URL is localhost. Dojah cannot deliver webhooks to localhost.');
      console.log('Set DOJAH_WEBHOOK_PUBLIC_URL to an HTTPS tunnel URL before running with --confirm.');
    } else if (!isHttps) {
      console.log('Warning: current webhook URL is not HTTPS. Dojah webhook registration requires a public HTTPS URL.');
    }
    console.log('Dry run only. Re-run with --confirm to register these webhook subscriptions with Dojah.');
    return;
  }

  if (isLocalhost) {
    throw new Error(
      'Refusing to register localhost. Set DOJAH_WEBHOOK_PUBLIC_URL to an HTTPS tunnel URL ' +
      '(for example ngrok/cloudflared) for local webhook testing, or run this in production with NEXT_PUBLIC_APP_URL=https://nemsalvage.com.'
    );
  }

  if (!isHttps) {
    throw new Error('Refusing to register a non-HTTPS webhook URL. Set DOJAH_WEBHOOK_PUBLIC_URL or NEXT_PUBLIC_APP_URL to an https:// URL.');
  }

  console.log(`Subscribing ${services.length} Dojah webhook service(s)...`);
  for (const service of services) {
    const result = await subscribe(service);
    console.log(`${result.ok ? 'OK' : 'FAILED'} ${result.service} (${result.status}) ${result.body}`);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
