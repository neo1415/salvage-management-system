/** Server-only Tavily REST client. Keys never enter queries, logs or browser payloads. */
export interface TavilyResult { url: string; title?: string; content?: string; raw_content?: string; score?: number }
export class TavilyApiClient {
  private async request(path: 'search' | 'extract', body: Record<string, unknown>): Promise<TavilyResult[]> {
    const key = process.env.TAVILY_API_KEY?.trim();
    const response = await fetch(`https://api.tavily.com/${path}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', ...(key ? { Authorization: `Bearer ${key}` } : { 'X-Tavily-Access-Mode': 'keyless' }) },
      body: JSON.stringify(body), signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok) throw new Error(`Tavily ${path} unavailable (HTTP ${response.status})`);
    const data = await response.json() as { results?: TavilyResult[] };
    if (!Array.isArray(data.results)) throw new Error('Tavily returned an invalid result');
    return data.results.filter(result => typeof result.url === 'string');
  }
  search(query: string) {
    if (!query.trim() || query.length > 400) throw new Error('Tavily query must contain 1–400 characters');
    return this.request('search', { query, country: 'nigeria', topic: 'general', search_depth: 'advanced',
      max_results: 6, chunks_per_source: 3, include_answer: false, include_raw_content: false, auto_parameters: false });
  }
  extract(urls: string[], query: string) {
    return this.request('extract', { urls: urls.slice(0, 6), query: query.slice(0, 400), chunks_per_source: 3,
      extract_depth: 'advanced', format: 'text', timeout: 10 });
  }
}
export const tavilyApi = new TavilyApiClient();
