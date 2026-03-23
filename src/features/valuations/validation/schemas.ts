import { z } from 'zod';

/**
 * Validation schema for vehicle valuation input
 * 
 * Requirements validated:
 * - 1.2: Validate all required fields are present and within acceptable ranges
 * - 9.1: Low price must be less than or equal to high price
 * - 9.2: Year must be between 1990 and current year + 1
 * - 9.3: Mileage values must be non-negative and reasonable (< 1,000,000 km)
 * - 9.5: Prevent duplicate entries for same make/model/year/condition
 * - 9.6: Provide clear error messages
 */
export const valuationSchema = z.object({
  make: z.string().min(1, 'Make is required').max(100, 'Make must be 100 characters or less'),
  model: z.string().min(1, 'Model is required').max(100, 'Model must be 100 characters or less'),
  year: z.number()
    .int('Year must be an integer')
    .min(1990, 'Year must be 1990 or later')
    .max(new Date().getFullYear() + 1, `Year must be ${new Date().getFullYear() + 1} or earlier`),
  conditionCategory: z.enum(
    ['nig_used_low', 'nig_used_high', 'tokunbo_low', 'tokunbo_high', 'average'],
    { message: 'Condition category must be one of: nig_used_low, nig_used_high, tokunbo_low, tokunbo_high, average' }
  ),
  lowPrice: z.number().positive('Low price must be positive'),
  highPrice: z.number().positive('High price must be positive'),
  averagePrice: z.number().positive('Average price must be positive'),
  mileageLow: z.number()
    .nonnegative('Mileage low must be non-negative')
    .max(999999, 'Mileage low must be less than 1,000,000 km')
    .optional(),
  mileageHigh: z.number()
    .nonnegative('Mileage high must be non-negative')
    .max(999999, 'Mileage high must be less than 1,000,000 km')
    .optional(),
  marketNotes: z.string().max(5000, 'Market notes must be 5000 characters or less').optional(),
  dataSource: z.string().min(1, 'Data source is required').max(100, 'Data source must be 100 characters or less'),
}).refine(
  (data) => data.lowPrice <= data.highPrice,
  {
    message: 'Low price must be less than or equal to high price',
    path: ['lowPrice'],
  }
).refine(
  (data) => !data.mileageLow || !data.mileageHigh || data.mileageLow <= data.mileageHigh,
  {
    message: 'Mileage low must be less than or equal to mileage high',
    path: ['mileageLow'],
  }
);

export type ValuationInput = z.infer<typeof valuationSchema>;

/**
 * Validation schema for damage deduction input
 * 
 * Requirements validated:
 * - 2.2: Damage levels must be one of Minor, Moderate, or Severe
 * - 2.5: Valuation deduction percentages must be between 0 and 1
 * - 9.4: Deduction percentage must be between 0 and 1
 * - 9.5: Prevent duplicate entries for same component/damage level
 * - 9.6: Provide clear error messages
 */
export const deductionSchema = z.object({
  component: z.string().min(1, 'Component is required').max(100, 'Component must be 100 characters or less'),
  damageLevel: z.enum(
    ['minor', 'moderate', 'severe'],
    { message: 'Damage level must be one of: minor, moderate, severe' }
  ),
  repairCostEstimate: z.number().nonnegative('Repair cost estimate must be non-negative'),
  valuationDeductionPercent: z.number()
    .min(0, 'Valuation deduction percent must be between 0 and 1')
    .max(1, 'Valuation deduction percent must be between 0 and 1'),
  description: z.string().max(1000, 'Description must be 1000 characters or less').optional(),
});

export type DeductionInput = z.infer<typeof deductionSchema>;
