import type { VehicleIdentifier } from '@/features/internet-search/services/query-builder.service';

const normalize = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const contains = (text: string, term: string) => ` ${normalize(text)} `.includes(` ${normalize(term)} `);

export function vehicleModelEstablished(item: VehicleIdentifier, text: string): boolean {
  if (contains(text, item.model)) return true;
  if (normalize(item.make) !== 'jeep' || !item.year || !contains(text, String(item.year))) return false;
  // Jeep lists JK as 2007-2018; JL also launched for 2018. Do not infer
  // generation in that overlap year or infer trim/door configuration.
  // https://www.jeep.com/history/2000s.html
  const model = normalize(item.model);
  if (model === 'wrangler jk' && item.year >= 2007 && item.year < 2018) {
    return contains(text, 'wrangler') && !contains(text, 'jl') && !contains(text, 'tj');
  }
  if (model === 'wrangler jl' && item.year > 2018) {
    return contains(text, 'wrangler') && !contains(text, 'jk') && !contains(text, 'tj');
  }
  return false;
}
