import {describe,it,expect} from 'vitest';
import {providerErrorMessage} from '@/lib/ai/provider-error-message';
describe('safe provider errors',()=>{
  it.each(['specified API usage limits','specified workspace API usage limits'])('explains %s without leaking the response',limit=>{
    const message=providerErrorMessage('Claude',new Error(`400 {"message":"You have reached your ${limit}. You will regain access on 2026-10-01","request_id":"req_private"}`));
    expect(message).toContain('spending limit');
    expect(message).toContain('credit balance alone');
    expect(message).not.toContain('req_private');
    expect(message).not.toContain('{');
  });
  it('distinguishes quota and credit failures',()=>{
    expect(providerErrorMessage('Gemini',new Error('429 RESOURCE_EXHAUSTED'))).toContain('quota');
    expect(providerErrorMessage('Claude',new Error('credit balance too low'))).toContain('credit balance is insufficient');
  });
});
