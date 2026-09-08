import { describe, expect, it } from 'vitest';
import { parseRepairEstimates } from '@/features/valuations/services/repair-estimation.service';
describe('independent repair estimate parsing', () => {
  const targets = [{component:'front bumper',action:'replace'},{component:'fender liner',action:'repair'}];
  it('uses numeric ids so spelling changes cannot discard component estimates', () => {
    const result = parseRepairEstimates('```json\n{"estimates":[{"id":1,"component":"Fender lining","low":100,"high":300,"confidence":95,"assumptions":"Labour included"}]}\n```', targets, 'gemini');
    expect(result).toEqual([{component:'fender liner',low:100,high:300,confidence:60,assumptions:'Labour included',provider:'gemini'}]);
  });
  it('rejects malformed output and invalid or unrelated entries', () => {
    expect(parseRepairEstimates('unavailable',targets,'gemini')).toEqual([]);
    for(const row of [{id:8,low:100,high:200,assumptions:'x'}, {id:0,low:-10,high:20,assumptions:'x'}, {id:0,low:30,high:20,assumptions:'x'}, {id:0,low:10,high:20}]) expect(parseRepairEstimates(JSON.stringify({estimates:[row]}),targets,'gemini')).toEqual([]);
  });
});
