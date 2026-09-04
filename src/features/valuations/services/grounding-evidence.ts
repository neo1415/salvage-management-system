import { priceExtractor, type ExtractedPrice } from '@/features/internet-search/services/price-extraction.service';
import type { PriceAdjudicationInput } from './price-adjudication.service';

export interface GroundedPriceStatement {
  url: string;
  text: string;
}

type NativeObject = Record<string, unknown>;
const object = (value: unknown): NativeObject => value && typeof value === 'object' ? value as NativeObject : {};
const array = (value: unknown): unknown[] => Array.isArray(value) ? value : [];

export function evidenceUrl(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  try {
    const url = new URL(value);
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) return undefined;
    url.hash = '';
    return url.href;
  } catch {
    return undefined;
  }
}

export function collectGeminiGrounding(response: unknown): GroundedPriceStatement[] {
  const statements: GroundedPriceStatement[] = [];
  // Only the selected candidate supplies evidence; alternatives are not independent listings.
  const metadata = object(object(array(object(response).candidates)[0]).groundingMetadata);
  const chunks = array(metadata.groundingChunks);
  for (const value of array(metadata.groundingSupports)) {
    const support = object(value);
    const text = object(support.segment).text;
    const indices = [...new Set(array(support.groundingChunkIndices))];
    // A multi-source sentence cannot establish which listing owns an amount.
    if (typeof text !== 'string' || !text.trim() || indices.length !== 1) continue;
    const index = indices[0];
    if (typeof index !== 'number' || !Number.isInteger(index) || index < 0) continue;
    const url = evidenceUrl(object(object(chunks[index]).web).uri);
    if (url) statements.push({ url, text });
  }
  return statements;
}

export function collectClaudeGrounding(response: unknown): GroundedPriceStatement[] {
  const blocks = array(object(response).content).map(object);
  const nativeUrls = new Set<string>();
  for (const block of blocks) {
    if (block.type !== 'web_search_tool_result') continue;
    for (const value of array(block.content)) {
      const result = object(value);
      const url = evidenceUrl(result.url);
      if (result.type === 'web_search_result' && url) nativeUrls.add(url);
    }
  }
  const statements: GroundedPriceStatement[] = [];
  for (const block of blocks) {
    if (block.type !== 'text') continue;
    const citations = array(block.citations).map(object).filter(c => c.type === 'web_search_result_location');
    for (const citation of citations) {
      const url = evidenceUrl(citation.url);
      if (!url || !nativeUrls.has(url)) continue;
      const citedText = typeof citation.cited_text === 'string' ? citation.cited_text.trim() : '';
      // Block-level fallback is safe only when the block has one cited source.
      const text = citedText || (citations.length === 1 && typeof block.text === 'string' ? block.text : '');
      if (text) statements.push({ url, text });
    }
  }
  return statements;
}

export function extractGroundedPrices(statements: GroundedPriceStatement[], input: PriceAdjudicationInput): ExtractedPrice[] {
  const byUrl = new Map<string, Set<string>>();
  for (const statement of statements) {
    const url = evidenceUrl(statement.url);
    if (!url) continue;
    const texts = byUrl.get(url) || new Set<string>();
    texts.add(statement.text);
    byUrl.set(url, texts);
  }
  // Group by listing before extraction so conflicting amounts cannot masquerade as listings.
  return priceExtractor.extractPrices([...byUrl].map(([link, texts], position) => ({
    link, title: [...texts].join(' '), snippet: [...texts].join(' '), position: position + 1,
  })), input.item.type, input.item.type === 'vehicle' ? input.item.year : undefined, {
    item: input.item,
    mode: input.mode,
    partName: input.partName,
    exchangeRates: input.policy.exchangeRates,
    pricePlausibility: input.policy.pricePlausibility,
  }).prices;
}
