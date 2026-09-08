import {describe,it,expect} from 'vitest';
import {parseRecoveryAppraisal, type RecoveryInput} from '@/features/valuations/services/as-is-recovery.service';
const input: RecoveryInput = {asset:{type:'vehicle'},marketValue:35_700_000,repairCost:1_000_000,currentRecovery:34_700_000,manualMarket:false,damage:[],marketEvidence:{}};
const proposal = {preDamageValue:27_000_000,sellingAllowance:1_000_000,uncertaintyAllowance:2_000_000,confidence:80,assumptions:'Working comparable adjustment and provisional sale allowances'};
describe('as-is recovery appraisal',()=>{
  it.each(['vehicle', 'machinery', 'electronics', 'property', 'stock', 'other'])('values uneconomic %s recovery independently of the ten percent floor', type => {
    const result = parseRecoveryAppraisal(JSON.stringify({...proposal, preDamageValue:14_000_000, basis:'as_is_recovery', recoveryLow:3_000_000, recoveryHigh:5_000_000, sellingAllowance:200_000, uncertaintyAllowance:300_000}), {...input, asset:{type}, marketValue:14_000_000, repairCost:18_000_000, currentRecovery:1_400_000}, 'gemini');
    expect(result?.salvageValue).toBe(3_500_000);
    expect(result?.basis).toBe('as_is_recovery');
  });
  it('rejects a repair-subtraction appraisal for uneconomic repairs', () => {
    expect(parseRecoveryAppraisal(JSON.stringify(proposal), {...input,repairCost:30_000_000}, 'gemini')).toBeUndefined();
  });
  it.each([{recoveryLow:-1,recoveryHigh:5}, {recoveryLow:5,recoveryHigh:4}, {recoveryLow:1,recoveryHigh:99_000_000}])('rejects invalid direct recovery ranges %j', range => {
    expect(parseRecoveryAppraisal(JSON.stringify({...proposal,basis:'as_is_recovery',...range}),input,'gemini')).toBeUndefined();
  });
  it.each(['vehicle','electronics','appliance','property','machinery','furniture','stock','goods_in_transit','building_materials','agriculture','scrap','equipment','medical_equipment','energy_equipment','aviation_equipment','jewelry','artwork','other'])('uses explicit amounts and one repair deduction for %s',type=>{
    const result=parseRecoveryAppraisal(JSON.stringify(proposal),{...input,asset:{type}},'gemini');
    expect(result?.salvageValue).toBe(23_000_000);
    expect(result?.confidence).toBe(60);
  });
  it('preserves existing recovery/total-loss caps',()=>{
    expect(parseRecoveryAppraisal(JSON.stringify(proposal),{...input,currentRecovery:5_000_000},'gemini')?.salvageValue).toBe(5_000_000);
  });
  it('rejects changes to manual market value',()=>{
    expect(parseRecoveryAppraisal(JSON.stringify(proposal),{...input,manualMarket:true},'gemini')).toBeUndefined();
    expect(parseRecoveryAppraisal(JSON.stringify({...proposal,preDamageValue:input.marketValue}),{...input,manualMarket:true},'gemini')).toBeDefined();
  });
  it.each([{sellingAllowance:-1},{preDamageValue:50_000_000},{uncertaintyAllowance:100_000_000},{confidence:'90'},{assumptions:''}])('rejects invalid or destructive model output %j',patch=>{
    expect(parseRecoveryAppraisal(JSON.stringify({...proposal,...patch}),input,'gemini')).toBeUndefined();
  });
  it('allows no discounts when evidence warrants none',()=>{
    expect(parseRecoveryAppraisal(JSON.stringify({...proposal,preDamageValue:input.marketValue,sellingAllowance:0,uncertaintyAllowance:0}),input,'gemini')?.salvageValue).toBe(input.currentRecovery);
  });
});
