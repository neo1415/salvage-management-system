import { describe, expect, it } from 'vitest';
import {
  canUserReceiveEmail,
  canUserReceivePush,
  canUserReceiveSms,
} from '@/features/notifications/services/notification-channel-guard';

describe('notification-channel-guard', () => {
  it('allows critical email without user lookup', async () => {
    await expect(canUserReceiveEmail('non-existent-user', { critical: true })).resolves.toBe(true);
  });

  it('defaults to allowed when no preferences row exists', async () => {
    await expect(canUserReceiveSms('non-existent-user')).resolves.toBe(true);
    await expect(canUserReceivePush('non-existent-user')).resolves.toBe(true);
  });
});
