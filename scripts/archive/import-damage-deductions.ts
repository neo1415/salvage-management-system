import { db } from '../../src/lib/db/drizzle';
import { damageDeductions } from '../../src/lib/db/schema/vehicle-valuations';

const SYSTEM_USER_ID = '00000000-0000-0000-0000-000000000001';

const deductionsData = [
  // Front Bumper
  {
    make: 'Toyota',
    component: 'Front Bumper',
    damageLevel: 'minor',
    repairCostLow: 25000,
    repairCostHigh: 60000,
    valuationDeductionLow: 70000,
    valuationDeductionHigh: 160000,
    notes: 'Respray + minor repair. Toyota panel spray: ₦25–50k most workshops. Very affordable.',
  },
  {
    make: 'Toyota',
    component: 'Front Bumper',
    damageLevel: 'moderate',
    repairCostLow: 60000,
    repairCostHigh: 150000,
    valuationDeductionLow: 160000,
    valuationDeductionHigh: 380000,
    notes: 'Replace or bond. Genuine Toyota bumper ₦80–180k. Local copy ₦35–80k. Very available.',
  },
  {
    make: 'Toyota',
    component: 'Front Bumper',
    damageLevel: 'severe',
    repairCostLow: 150000,
    repairCostHigh: 350000,
    valuationDeductionLow: 400000,
    valuationDeductionHigh: 900000,
    notes: 'Full replacement. Check airbag sensors. Toyota parts available at Ladipo/Apapa markets.',
  },
  // Rear Bumper
  {
    make: 'Toyota',
    component: 'Rear Bumper',
  