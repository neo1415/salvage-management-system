import http from 'k6/http';
import { check, sleep } from 'k6';

const BASE_URL = __ENV.BASE_URL || 'https://staging.nemsalvage.com';
const AUCTION_ID = __ENV.AUCTION_ID;
const EMAIL = __ENV.VENDOR_EMAIL;
const PASSWORD = __ENV.VENDOR_PASSWORD;

export const options = {
  scenarios: {
    auction_read_smoke: {
      executor: 'ramping-vus',
      stages: [
        { duration: '1m', target: Number(__ENV.VUS || 20) },
        { duration: __ENV.HOLD || '3m', target: Number(__ENV.VUS || 20) },
        { duration: '1m', target: 0 },
      ],
    },
  },
  thresholds: {
    http_req_failed: ['rate<0.02'],
    http_req_duration: ['p(95)<1500'],
  },
};

function requireEnv(name, value) {
  if (!value) {
    throw new Error(`${name} is required`);
  }
}

export default function () {
  requireEnv('AUCTION_ID', AUCTION_ID);
  requireEnv('VENDOR_EMAIL', EMAIL);
  requireEnv('VENDOR_PASSWORD', PASSWORD);

  const login = http.post(
    `${BASE_URL}/api/auth/login`,
    JSON.stringify({ email: EMAIL, password: PASSWORD }),
    { headers: { 'Content-Type': 'application/json' } }
  );

  check(login, {
    'login succeeds': (res) => res.status === 200,
  });

  const me = http.get(`${BASE_URL}/api/auth/me`);
  check(me, {
    'session is valid': (res) => res.status === 200,
  });

  const poll = http.get(`${BASE_URL}/api/auctions/${AUCTION_ID}/poll`);
  check(poll, {
    'auction poll succeeds': (res) => res.status === 200 || res.status === 304,
    'auction poll is not too slow': (res) => res.timings.duration < 2000,
  });

  sleep(Number(__ENV.SLEEP_SECONDS || 2));
}
