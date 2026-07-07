/**
 * Deep Termii delivery diagnosis: sender IDs, DND check, and dnd transactional send.
 * Usage: npx tsx scripts/diagnose-termii-delivery.ts [phone]
 */
import 'dotenv/config';

const API_KEY = process.env.TERMII_API_KEY || '';
const SENDER_ID = process.env.TERMII_SENDER_ID || process.env.TERMII_DEFAULT_SENDER_ID || 'NEM';
const TEST_PHONE = process.argv[2]?.replace(/\D/g, '').replace(/^0/, '234') || '2348141252812';

function normalize(phone: string): string {
  const c = phone.replace(/\D/g, '');
  if (c.startsWith('234')) return c;
  if (c.startsWith('0')) return `234${c.slice(1)}`;
  if (c.length === 10) return `234${c}`;
  return c;
}

async function getJson(url: string, method = 'GET', body?: object) {
  const res = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    data = text;
  }
  return { ok: res.ok, status: res.status, data };
}

async function main() {
  const phone = normalize(TEST_PHONE);
  console.log('=== Termii Delivery Diagnosis ===\n');
  console.log(`Test phone: ${phone}`);
  console.log(`Sender ID: ${SENDER_ID}`);
  console.log(`WAT time: ${new Date().toLocaleString('en-NG', { timeZone: 'Africa/Lagos' })}\n`);

  if (!API_KEY) {
    console.error('TERMII_API_KEY missing');
    process.exit(1);
  }

  // 1. Sender IDs (correct field: content)
  console.log('1) Sender IDs');
  const senders = await getJson(`https://api.ng.termii.com/api/sender-id?api_key=${API_KEY}`);
  const content = (senders.data as { content?: Array<{ sender_id: string; status: string }> })?.content;
  if (content?.length) {
    for (const s of content) {
      const match = s.sender_id === SENDER_ID ? ' <-- .env' : '';
      console.log(`   ${s.sender_id}: ${s.status}${match}`);
    }
  } else {
    console.log('   ', JSON.stringify(senders.data));
  }

  // 2. DND status for test number
  console.log('\n2) DND status (Number API)');
  const dndCheck = await getJson('https://api.ng.termii.com/api/check/dnd', 'POST', {
    api_key: API_KEY,
    phone_number: phone,
  });
  console.log('   ', JSON.stringify(dndCheck.data, null, 2));

  // 3. Recent inbox for this number
  console.log('\n3) Recent messages to this number (inbox API)');
  const inbox = await getJson(`https://api.ng.termii.com/api/sms/inbox?api_key=${API_KEY}`);
  const list = Array.isArray(inbox.data) ? inbox.data : [];
  const mine = list.filter((m: { receiver?: string }) => m.receiver === phone).slice(0, 5);
  if (mine.length === 0) {
    console.log('   (no recent messages to this number in last inbox page)');
    console.log('   Latest overall:', list[0] ? `${list[0].receiver} status=${list[0].status} type=${list[0].sms_type}` : 'none');
  } else {
    for (const m of mine) {
      console.log(`   ${m.created_at} | ${m.status} | ${m.sms_type} | ${m.message?.slice(0, 60)}...`);
    }
  }

  // 4. Send test via dnd (current app config)
  console.log('\n4) Test send: channel=dnd (current app default)');
  const msgGeneric = `NEM test app ${Date.now().toString().slice(-6)}. Reply OK if received.`;
  const gen = await getJson('https://api.ng.termii.com/api/sms/send', 'POST', {
    api_key: API_KEY,
    to: phone,
    from: SENDER_ID,
    sms: msgGeneric,
    type: 'plain',
    channel: 'dnd',
  });
  console.log('   API:', gen.ok ? 'accepted' : 'rejected', JSON.stringify(gen.data));

  // 5. Send test via dnd (recommended for OTP)
  console.log('\n5) Test send: channel=dnd (Termii recommended for OTP/transactional)');
  const msgDnd = `NEM test dnd ${Date.now().toString().slice(-6)}. Reply OK if received.`;
  const dnd = await getJson('https://api.ng.termii.com/api/sms/send', 'POST', {
    api_key: API_KEY,
    to: phone,
    from: SENDER_ID,
    sms: msgDnd,
    type: 'plain',
    channel: 'dnd',
  });
  console.log('   API:', dnd.ok ? 'accepted' : 'rejected', JSON.stringify(dnd.data));

  console.log('\n6) Wait 15s then re-check inbox for delivery status...');
  await new Promise((r) => setTimeout(r, 15000));
  const inbox2 = await getJson(`https://api.ng.termii.com/api/sms/inbox?api_key=${API_KEY}`);
  const list2 = Array.isArray(inbox2.data) ? inbox2.data : [];
  const recent = list2.filter((m: { receiver?: string }) => m.receiver === phone).slice(0, 4);
  for (const m of recent) {
    console.log(`   ${m.created_at} | status=${m.status} | sms_type=${m.sms_type} | ${m.message?.slice(0, 50)}`);
  }

  console.log('\n=== Interpretation ===');
  console.log('- Termii "Successfully Sent" + API message_id = accepted by Termii, NOT proof of handset delivery.');
  console.log('- Inbox status "Failed" = carrier/network rejected delivery.');
  console.log('- Inbox status "Sent" on generic + OTP = may still not reach phone (DND / MTN 8PM-8AM / wrong channel).');
  console.log('- OTP/transactional should use channel=dnd; generic is promotional-only per Termii docs.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
