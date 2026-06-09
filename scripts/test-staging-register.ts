import { config } from 'dotenv';
config({ path: '.env.staging', override: true });

import { authService } from '../src/features/auth/services/auth.service';

async function main() {
  const ts = Date.now();
  const result = await authService.register(
    {
      fullName: 'Test Vendor',
      email: `local-staging-${ts}@example.com`,
      phone: `080${String(ts).slice(-8)}`,
      password: 'TestVendor123!',
      dateOfBirth: new Date('1995-06-01'),
      termsAccepted: true,
    } as any,
    '127.0.0.1',
    'desktop'
  );
  console.log(result);
  process.exit(result.success ? 0 : 1);
}

main().catch((e) => {
  console.error('THROWN:', e);
  process.exit(1);
});
