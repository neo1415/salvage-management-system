import {describe,it,expect,vi} from 'vitest';
vi.mock('@/lib/db',()=>({db:{}}));
vi.mock('@/features/valuations/services/valuation-policy.service',()=>({getValuationPolicyConfig:async()=>({repairCostMultipliers:{laborPercent:20,paintAndMaterialsPercent:10,logisticsPercent:5}})}));
import {DamageCalculationService,sumRestorationCosts} from '@/features/valuations/services/damage-calculation.service';
import {parseRecoveryAppraisal} from '@/features/valuations/services/as-is-recovery.service';
import {selectPricingContext} from '@/features/valuations/services/tavily-price-research.service';
import {formatStaffReviewNotes} from '@/features/cases/services/ai-warning-sanitization';
describe('reported inflated restoration cost regression',()=>{
  it('keeps bumper and lamp repair costs independent of component severity and sale allowances',async()=>{
    const result=await new DamageCalculationService().calculateSalvageValueWithPartPrices(31_350_000,[{component:'bumper',damageLevel:'severe',recommendedAction:'replace'},{component:'fog light',damageLevel:'moderate',recommendedAction:'replace'}],[{component:'bumper',partPrice:1_100_000,source:'ai_estimate'},{component:'fog light',partPrice:80_000,source:'ai_estimate'}]);
    const repairCost=sumRestorationCosts(result.deductions);
    expect(repairCost).toBe(1_593_000);
    const recovery=parseRecoveryAppraisal(JSON.stringify({preDamageValue:31_350_000,sellingAllowance:2_194_500,uncertaintyAllowance:2_508_000,confidence:50,assumptions:'Provisional allowances'}),{asset:{type:'vehicle'},marketValue:31_350_000,repairCost,currentRecovery:result.salvageValue,manualMarket:false,damage:[],marketEvidence:{}},'gemini');
    expect(recovery?.salvageValue).toBe(25_054_500);
  });
  it('uses documented database costs and never substitutes a recovery cap for work costs',()=>{
    expect(sumRestorationCosts([{repairCostLow:900_000,repairCostHigh:1_100_000}])).toBe(1_000_000);
  });
  it.each(['vehicle','electronics','property','machinery','furniture','stock','jewelry'])('does not tell the appraisal an excellent %s is brand new',type=>{
    expect(selectPricingContext({type,condition:'Brand New',declaredCondition:'excellent'}).condition).toBeUndefined();
  });
  it('does not repeat cost notes stored in both reviewReasons and warnings',()=>{
    const note='front bumper: AI-estimated cost ₦700,000–₦1,500,000; replacement part';
    const result=formatStaffReviewNotes([note],[`Manual review: ${note}`],{confidenceScore:60});
    expect(result.join(' ').split('front bumper:')).toHaveLength(2);
  });
});
