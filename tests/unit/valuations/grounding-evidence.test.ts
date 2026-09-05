import { describe, expect, it } from 'vitest';
import { collectClaudeGrounding, collectGeminiGrounding, evidenceUrl } from '@/features/valuations/services/grounding-evidence';

describe('native grounding evidence', () => {
  it('maps a Gemini supported price statement to exactly one grounding URL', () => {
    const statements = collectGeminiGrounding({ candidates: [{ groundingMetadata: {
      groundingChunks: [{ web: { uri: 'https://dealer.example/jeep', title: 'Dealer' } }],
      groundingSupports: [{ segment: { text: '2015 Jeep Wrangler JK used price NGN 18,500,000' }, groundingChunkIndices: [0] }],
    } }] });
    expect(statements).toEqual([{ url: 'https://dealer.example/jeep', text: '2015 Jeep Wrangler JK used price NGN 18,500,000' }]);
  });

  it('rejects a Gemini sentence attributed to multiple sources', () => {
    expect(collectGeminiGrounding({ candidates: [{ groundingMetadata: {
      groundingChunks: [{ web: { uri: 'https://a.example' } }, { web: { uri: 'https://b.example' } }],
      groundingSupports: [{ segment: { text: 'Price NGN 10,000' }, groundingChunkIndices: [0, 1] }],
    } }] })).toEqual([]);
  });

  it('accepts Claude cited text only when the URL came from its native search result', () => {
    const statements = collectClaudeGrounding({ content: [
      { type: 'web_search_tool_result', content: [{ type: 'web_search_result', url: 'https://parts.example/item' }] },
      { type: 'text', text: 'The OEM bumper is NGN 480,000.', citations: [{ type: 'web_search_result_location', url: 'https://parts.example/item', cited_text: 'Jeep Wrangler JK OEM bumper NGN 480,000' }] },
      { type: 'text', text: 'Fake', citations: [{ type: 'web_search_result_location', url: 'https://invented.example', cited_text: 'NGN 1' }] },
    ] });
    expect(statements).toEqual([{
      url: 'https://parts.example/item',
      text: 'Jeep Wrangler JK OEM bumper NGN 480,000',
    }]);
  });

  it('does not import unsupported model or condition from generated prose', () => {
    const statements = collectClaudeGrounding({ content: [
      { type: 'web_search_tool_result', content: [{ type: 'web_search_result', url: 'https://cars.example/jeep' }] },
      {
        type: 'text',
        text: 'A 2015 Jeep Wrangler JK, foreign used, is listed for NGN 20,500,000.',
        citations: [{
          type: 'web_search_result_location',
          url: 'https://cars.example/jeep',
          title: 'Used Jeep Wrangler 2015',
          cited_text: 'Price starting from NGN 20,500,000',
        }],
      },
    ] });
    expect(statements[0].text).not.toContain('JK, foreign used');
    expect(statements[0].text).toContain('Used Jeep Wrangler 2015');
    expect(statements[0].text).toContain('Price starting from NGN 20,500,000');
  });

  it('rejects non-web URLs and embedded credentials', () => {
    expect(evidenceUrl('javascript:alert(1)')).toBeUndefined();
    expect(evidenceUrl('https://user:pass@example.com/item')).toBeUndefined();
  });
});
