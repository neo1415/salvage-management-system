import { z } from 'zod';

const name = z.string().trim().min(1);
const price = z.number().finite().positive();
const tolerance = z.number().finite().min(0).max(1);

export const valuationBenchmarkInputSchema = z.object({
  schemaVersion: z.literal(1),
  datasetId: name,
  predictionVersion: name,
  dataKind: z.enum(['independently_appraised', 'synthetic']),
  currency: z.string().regex(/^[A-Z]{3}$/),
  valuationBasis: name,
  config: z.object({
    relativeErrorTolerance: tolerance.default(0.1),
    minimumSamplesPerCategory: z.number().int().min(1).default(100),
    categories: z.array(z.object({
      category: name,
      relativeErrorTolerance: tolerance.optional(),
    }).strict()).min(1),
  }).strict(),
  cases: z.array(z.object({
    caseId: name,
    category: name,
    appraisal: z.object({
      price,
      appraiserReference: name,
      evidenceReference: name,
      independentOfPrediction: z.literal(true),
    }).strict(),
    prediction: z.discriminatedUnion('status', [
      z.object({ status: z.literal('accepted'), price }).strict(),
      z.object({ status: z.literal('review'), price: price.optional(), reason: name }).strict(),
      z.object({ status: z.literal('abstained'), reason: name }).strict(),
    ]),
  }).strict()),
}).strict().superRefine((input, ctx) => {
  const categories = new Set<string>();
  input.config.categories.forEach((entry, index) => {
    if (categories.has(entry.category)) ctx.addIssue({ code: 'custom', path: ['config', 'categories', index], message: 'Duplicate category' });
    categories.add(entry.category);
  });
  const ids = new Set<string>();
  input.cases.forEach((entry, index) => {
    if (ids.has(entry.caseId)) ctx.addIssue({ code: 'custom', path: ['cases', index, 'caseId'], message: 'Duplicate case ID' });
    if (!categories.has(entry.category)) ctx.addIssue({ code: 'custom', path: ['cases', index, 'category'], message: 'Category must be declared in config' });
    ids.add(entry.caseId);
  });
});

export type ValuationBenchmarkInput = z.input<typeof valuationBenchmarkInputSchema>;
export type ValuationBenchmarkCase = ValuationBenchmarkInput['cases'][number];
export const valuationBenchmarkJsonSchema = z.toJSONSchema(valuationBenchmarkInputSchema);

export interface BenchmarkMetrics {
  totalCases: number;
  acceptedNumericPredictions: number;
  reviewCases: number;
  abstentions: number;
  withinTolerance: number;
  coverage: number | null;
  withinToleranceRate: number | null;
  allCaseWithinToleranceRate: number | null;
  acceptedHitRateWilsonLower95: number | null;
  allCaseHitRateWilsonLower95: number | null;
}

export interface CategoryBenchmarkMetrics extends BenchmarkMetrics {
  category: string;
  relativeErrorTolerance: number;
  minimumSamplesMet: boolean;
  targetMet: boolean;
}

export interface ValuationBenchmarkReport {
  schemaVersion: 1;
  datasetId: string;
  predictionVersion: string;
  dataKind: ValuationBenchmarkInput['dataKind'];
  currency: string;
  valuationBasis: string;
  targetHitRate: 0.95;
  minimumSamplesPerCategory: number;
  confidenceMethod: 'two-sided-95-percent-Wilson-lower-bound';
  overall: BenchmarkMetrics;
  categories: CategoryBenchmarkMetrics[];
  macroCategory: {
    coverage: number | null;
    withinToleranceRate: number | null;
    allCaseWithinToleranceRate: number | null;
  };
  caseResults: Array<{
    caseId: string;
    category: string;
    status: ValuationBenchmarkCase['prediction']['status'];
    relativeError: number | null;
    withinTolerance: boolean;
  }>;
  benchmarkTargetMet: boolean;
  status: 'synthetic_only' | 'unmeasured' | 'insufficient_samples' | 'target_not_met' | 'target_met_on_supplied_benchmark';
  limitations: string[];
}

/** Lower endpoint of the two-sided 95% Wilson score interval (z = 1.95996...). */
export function wilsonLower95(hits: number, samples: number): number | null {
  if (!Number.isSafeInteger(samples) || !Number.isSafeInteger(hits) || samples < 0 || hits < 0 || hits > samples) {
    throw new Error('Wilson counts must be nonnegative integers with hits <= samples');
  }
  if (samples === 0) return null;
  if (hits === 0) return 0;
  const z = 1.959963984540054;
  const p = hits / samples;
  const z2 = z * z;
  return Math.max(0, (p + z2 / (2 * samples) - z * Math.sqrt(p * (1 - p) / samples + z2 / (4 * samples * samples))) / (1 + z2 / samples));
}

const rate = (numerator: number, denominator: number) => denominator === 0 ? null : numerator / denominator;
const macro = (values: Array<number | null>): number | null =>
  values.some(value => value === null) ? null : values.reduce<number>((sum, value) => sum + value!, 0) / values.length;

/** Pure offline evaluation. Invalid cases fail the entire input instead of being silently dropped. */
export function evaluateValuationBenchmark(raw: unknown): ValuationBenchmarkReport {
  const input = valuationBenchmarkInputSchema.parse(raw);
  const config = input.config;
  const tolerances = new Map(config.categories.map(entry => [entry.category, entry.relativeErrorTolerance ?? config.relativeErrorTolerance]));
  const caseResults = input.cases.map(entry => {
    const relativeError = entry.prediction.status === 'accepted'
      ? Math.abs(entry.prediction.price - entry.appraisal.price) / entry.appraisal.price
      : null;
    if (relativeError !== null && !Number.isFinite(relativeError)) throw new Error(`Relative error overflow for case ${entry.caseId}`);
    const limit = tolerances.get(entry.category)!;
    // Allow only machine-rounding noise at the inclusive tolerance boundary.
    const withinTolerance = relativeError !== null && relativeError <= limit + 8 * Number.EPSILON * Math.max(1, limit);
    return { caseId: entry.caseId, category: entry.category, status: entry.prediction.status, relativeError, withinTolerance };
  });
  const metrics = (rows: typeof caseResults): BenchmarkMetrics => {
    const totalCases = rows.length;
    const acceptedNumericPredictions = rows.filter(row => row.status === 'accepted').length;
    const withinTolerance = rows.filter(row => row.withinTolerance).length;
    return {
      totalCases, acceptedNumericPredictions, withinTolerance,
      reviewCases: rows.filter(row => row.status === 'review').length,
      abstentions: rows.filter(row => row.status === 'abstained').length,
      coverage: rate(acceptedNumericPredictions, totalCases),
      withinToleranceRate: rate(withinTolerance, acceptedNumericPredictions),
      allCaseWithinToleranceRate: rate(withinTolerance, totalCases),
      acceptedHitRateWilsonLower95: wilsonLower95(withinTolerance, acceptedNumericPredictions),
      allCaseHitRateWilsonLower95: wilsonLower95(withinTolerance, totalCases),
    };
  };
  const overall = metrics(caseResults);
  const categories = config.categories.map(entry => {
    const result = metrics(caseResults.filter(row => row.category === entry.category));
    const minimumSamplesMet = result.acceptedNumericPredictions >= config.minimumSamplesPerCategory;
    return {
      ...result, category: entry.category, relativeErrorTolerance: tolerances.get(entry.category)!, minimumSamplesMet,
      targetMet: minimumSamplesMet && (result.allCaseHitRateWilsonLower95 ?? 0) >= 0.95,
    };
  });
  const enoughSamples = categories.every(entry => entry.minimumSamplesMet);
  const benchmarkTargetMet = input.dataKind === 'independently_appraised' && enoughSamples
    && categories.every(entry => entry.targetMet) && (overall.allCaseHitRateWilsonLower95 ?? 0) >= 0.95;
  return {
    schemaVersion: 1, datasetId: input.datasetId, predictionVersion: input.predictionVersion,
    dataKind: input.dataKind, currency: input.currency, valuationBasis: input.valuationBasis,
    targetHitRate: 0.95, minimumSamplesPerCategory: config.minimumSamplesPerCategory,
    confidenceMethod: 'two-sided-95-percent-Wilson-lower-bound', overall, categories,
    macroCategory: {
      coverage: macro(categories.map(entry => entry.coverage)),
      withinToleranceRate: macro(categories.map(entry => entry.withinToleranceRate)),
      allCaseWithinToleranceRate: macro(categories.map(entry => entry.allCaseWithinToleranceRate)),
    },
    caseResults, benchmarkTargetMet,
    status: input.dataKind === 'synthetic' ? 'synthetic_only' : input.cases.length === 0 ? 'unmeasured'
      : !enoughSamples ? 'insufficient_samples' : benchmarkTargetMet ? 'target_met_on_supplied_benchmark' : 'target_not_met',
    limitations: [
      'Current real-world valuation accuracy is unmeasured by this implementation; a supplied benchmark is not a production guarantee.',
      'Benchmark labels must be provided by independent appraisers. Metadata is an attestation, not verified evidence of independence.',
      'Wilson intervals assume independent representative cases; selection bias, repeated assets and label leakage invalidate broader claims.',
      'Review and abstentions are not accurate predictions. The target gate uses all cases, including these non-hits.',
      'Category intervals are marginal, not simultaneous confidence intervals. Macro rates have no pooled Wilson interval.',
    ],
  };
}
