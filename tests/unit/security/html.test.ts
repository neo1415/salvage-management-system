import { describe, expect, it } from 'vitest';
import { escapeHtml } from '@/lib/security/html';

describe('escapeHtml', () => {
  it('escapes text before it is interpolated into notification HTML', () => {
    expect(escapeHtml(`<script>alert("x")</script> Tom & Jerry's`)).toBe(
      '&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt; Tom &amp; Jerry&#039;s'
    );
  });

  it('preserves ordinary notification text', () => {
    expect(escapeHtml('Pickup evidence is ready.')).toBe(
      'Pickup evidence is ready.'
    );
  });
});
