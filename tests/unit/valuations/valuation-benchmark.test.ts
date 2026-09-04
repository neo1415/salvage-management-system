import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { evaluateValuationBenchmark, valuationBenchmarkJsonSchema, wilsonLower95, type ValuationBenchmarkCase, type ValuationBenchmarkInput } from '../../../src/features/valuations/services/valuation-benchmark';

// All cases here are invented arithmetic test inputs, never empirical evidence.
function row(id: string, category = 'vehicle', prediction: ValuationBenchmarkCase['prediction'] = { status: 'accepted', price: 100 }): ValuationBenchmarkCase {
  return { caseId: id, category, appraisal: { price: 100, appraiserReference: 'synthetic-appraiser', evidenceReference: 'synthetic-evidence', independentOfPrediction: true }, prediction };
}

function input(cases: ValuationBenchmarkCase[] = []): ValuationBenchmarkInput {
  return { schemaVersion: 1, datasetId: 'synthetic-test-only', predictionVersion: 'test-only', dataKind: 'synthetic', currency: 'NGN', valuationBasis: 'synthetic salvage value', config: { categories: [{ category: 'vehicle' }] }, cases };
}

describe('offline valuation benchmark', () => {
  it('uses inclusive 10% relative error boundaries', () => {
    const report = evaluateValuationBenchmark(input([90, 110, 89.99, 110.01].map((price, i) => row(String(i), 'vehicle', { status: 'accepted', price }))));
    expect(report.overall.withinTolerance).toBe(2);
    expect(report.overall.withinToleranceRate).toBe(0.5);
    expect(report.categories[0].relativeErrorTolerance).toBe(0.1);
    expect(report.minimumSamplesPerCategory).toBe(100);
  });

  it('uses the appraised price as denominator and tolerates only rounding noise', () => {
    const dataset = input([row('decimal', 'vehicle', { status: 'accepted', price: 0.33 }), row('denominator', 'vehicle', { status: 'accepted', price: 111 })]);
    dataset.cases[0].appraisal.price = 0.3;
    const report = evaluateValuationBenchmark(dataset);
    expect(report.caseResults[0].withinTolerance).toBe(true);
    expect(report.caseResults[1].relativeError).toBeCloseTo(0.11);
    expect(report.caseResults[1].withinTolerance).toBe(false);
  });

  it('separates review and abstention from accepted numeric predictions', () => {
    const report = evaluateValuationBenchmark(input([
      row('hit'), row('miss', 'vehicle', { status: 'accepted', price: 200 }),
      row('review', 'vehicle', { status: 'review', price: 100, reason: 'Needs inspection' }),
      row('abstain', 'vehicle', { status: 'abstained', reason: 'No evidence' }),
    ]));
    expect(report.overall).toMatchObject({ totalCases: 4, acceptedNumericPredictions: 2, reviewCases: 1, abstentions: 1, withinTolerance: 1, coverage: 0.5, withinToleranceRate: 0.5, allCaseWithinToleranceRate: 0.25 });
    expect(report.caseResults[2]).toMatchObject({ relativeError: null, withinTolerance: false });
  });

  it('supports a default tolerance with per-category overrides and equal-weight macro rates', () => {
    const dataset = input([row('a'), row('b'), row('c', 'electronics', { status: 'accepted', price: 115 })]);
    dataset.config = { relativeErrorTolerance: 0.05, categories: [{ category: 'vehicle' }, { category: 'electronics', relativeErrorTolerance: 0.1 }] };
    const report = evaluateValuationBenchmark(dataset);
    expect(report.overall.withinToleranceRate).toBeCloseTo(2 / 3);
    expect(report.macroCategory.withinToleranceRate).toBe(0.5);
    dataset.config.categories[1].relativeErrorTolerance = 0.2;
    expect(evaluateValuationBenchmark(dataset).overall.withinTolerance).toBe(3);
  });

  it('keeps absent categories and undefined denominators visible', () => {
    const dataset = input([row('only')]);
    dataset.config.categories.push({ category: 'property' });
    const report = evaluateValuationBenchmark(dataset);
    expect(report.categories[1]).toMatchObject({ totalCases: 0, coverage: null, withinToleranceRate: null, minimumSamplesMet: false, targetMet: false });
    expect(report.macroCategory.withinToleranceRate).toBeNull();
    expect(report.benchmarkTargetMet).toBe(false);
    const empty = input();
    empty.dataKind = 'independently_appraised';
    expect(evaluateValuationBenchmark(empty).status).toBe('unmeasured');
  });

  it('reports no accepted predictions honestly', () => {
    const report = evaluateValuationBenchmark(input([row('review', 'vehicle', { status: 'review', reason: 'Uncertain' })]));
    expect(report.overall).toMatchObject({ coverage: 0, withinToleranceRate: null, allCaseWithinToleranceRate: 0, acceptedHitRateWilsonLower95: null, allCaseHitRateWilsonLower95: 0 });
  });

  it('requires minimum accepted samples in every category', () => {
    const dataset = input(Array.from({ length: 99 }, (_, i) => row(String(i))));
    dataset.dataKind = 'independently_appraised'; // Exercises the metadata gate only; still fabricated data.
    expect(evaluateValuationBenchmark(dataset).status).toBe('insufficient_samples');
    dataset.cases.push(row('100'));
    expect(evaluateValuationBenchmark(dataset).benchmarkTargetMet).toBe(true);
    dataset.config.categories.push({ category: 'rare' });
    dataset.cases.push(row('rare', 'rare'));
    expect(evaluateValuationBenchmark(dataset).benchmarkTargetMet).toBe(false);
  });

  it('does not mistake 95% observed hits or high selective accuracy for a proven target', () => {
    const dataset = input(Array.from({ length: 100 }, (_, i) => row(String(i), 'vehicle', { status: 'accepted', price: i < 95 ? 100 : 200 })));
    dataset.dataKind = 'independently_appraised';
    expect(evaluateValuationBenchmark(dataset).status).toBe('target_not_met');
    dataset.cases = Array.from({ length: 100 }, (_, i) => row(String(i)));
    dataset.cases.push(...Array.from({ length: 100 }, (_, i) => row(`skip-${i}`, 'vehicle', { status: 'abstained', reason: 'Uncertain' })));
    const report = evaluateValuationBenchmark(dataset);
    expect(report.overall.withinToleranceRate).toBe(1);
    expect(report.benchmarkTargetMet).toBe(false);
  });

  it('keeps synthetic data from passing the empirical gate', () => {
    const report = evaluateValuationBenchmark(input(Array.from({ length: 100 }, (_, i) => row(String(i)))));
    expect(report.categories[0].targetMet).toBe(true);
    expect(report.status).toBe('synthetic_only');
    expect(report.benchmarkTargetMet).toBe(false);
  });

  it.each([0, -1, NaN, Infinity, '100', null, undefined])('rejects invalid accepted prices: %s', value => {
    const dataset = input([row('bad')]);
    (dataset.cases[0].prediction as { price: unknown }).price = value;
    expect(() => evaluateValuationBenchmark(dataset)).toThrow();
  });

  it.each([0, -1, NaN, Infinity])('rejects invalid appraisal denominators: %s', value => {
    const dataset = input([row('bad')]);
    dataset.cases[0].appraisal.price = value;
    expect(() => evaluateValuationBenchmark(dataset)).toThrow();
  });

  it('rejects duplicates, undeclared categories, missing provenance and unknown fields', () => {
    expect(() => evaluateValuationBenchmark(input([row('same'), row('same')]))).toThrow();
    expect(() => evaluateValuationBenchmark(input([row('other', 'undeclared')]))).toThrow();
    const dataset = input([row('a')]);
    dataset.config.categories.push({ category: 'vehicle' });
    expect(() => evaluateValuationBenchmark(dataset)).toThrow();
    expect(() => evaluateValuationBenchmark({ ...input(), extra: true })).toThrow();
    const invalid = input([row('a')]);
    expect(() => evaluateValuationBenchmark({ ...invalid, cases: [{ ...invalid.cases[0], appraisal: { price: 100, independentOfPrediction: false } }] })).toThrow();
  });

  it.each([{ relativeErrorTolerance: -0.1 }, { relativeErrorTolerance: 1.1 }, { minimumSamplesPerCategory: 0 }, { minimumSamplesPerCategory: 1.5 }, { categories: [] }])('rejects invalid config %j', config => {
    const dataset = input();
    expect(() => evaluateValuationBenchmark({ ...dataset, config: { ...dataset.config, ...config } })).toThrow();
  });

  it('supports zero tolerance and refuses arithmetic overflow', () => {
    const dataset = input([row('a', 'vehicle', { status: 'accepted', price: 100.000001 })]);
    dataset.config.relativeErrorTolerance = 0;
    expect(evaluateValuationBenchmark(dataset).overall.withinTolerance).toBe(0);
    dataset.cases[0].appraisal.price = Number.MIN_VALUE;
    expect(() => evaluateValuationBenchmark(dataset)).toThrow('overflow');
  });

  it('is deterministic, JSON-safe and does not mutate inputs', () => {
    const dataset = input([row('a')]);
    const before = JSON.stringify(dataset);
    const report = evaluateValuationBenchmark(dataset);
    expect(JSON.stringify(dataset)).toBe(before);
    expect(JSON.parse(JSON.stringify(report))).toEqual(report);
    expect(evaluateValuationBenchmark(dataset)).toEqual(report);
    expect(valuationBenchmarkJsonSchema).toHaveProperty('properties');
  });
});

describe('Wilson lower bound', () => {
  it('matches known arithmetic and handles empty and extreme counts', () => {
    expect(wilsonLower95(95, 100)).toBeCloseTo(0.88824953, 7);
    expect(wilsonLower95(100, 100)).toBeCloseTo(0.9630065, 7);
    expect(wilsonLower95(1, 1)).toBeCloseTo(0.2065493, 7);
    expect(wilsonLower95(0, 100)).toBe(0);
    expect(wilsonLower95(0, 0)).toBeNull();
  });
  it.each([[2, 1], [-1, 1], [1, 0], [0.5, 1], [0, Infinity]])('rejects invalid counts %s/%s', (hits, samples) => {
    expect(() => wilsonLower95(hits, samples)).toThrow();
  });
});

describe('local CLI', () => {
  const tsx = resolve('node_modules/tsx/dist/cli.mjs');
  const script = resolve('scripts/evaluate-valuation.ts');
  const env = { ...process.env, DATABASE_URL: 'postgres://offline:offline@127.0.0.1:1/offline', TEST_DATABASE_URL: 'postgres://offline:offline@127.0.0.1:1/offline' };

  it('exports the JSON schema without loading application services', () => {
    const output = execFileSync(process.execPath, [tsx, script, '--schema'], { encoding: 'utf8', env });
    expect(JSON.parse(output)).toEqual(valuationBenchmarkJsonSchema);
  });

  it('reads only the supplied local file, emits a report and uses meaningful exit codes', () => {
    const directory = mkdtempSync(join(tmpdir(), 'valuation-benchmark-'));
    const file = join(directory, 'synthetic.json');
    try {
      const content = JSON.stringify(input([row('a')]));
      writeFileSync(file, content);
      const run = () => spawnSync(process.execPath, [tsx, script, file], { encoding: 'utf8', env });
      const result = run();
      expect(result.status).toBe(1);
      expect(JSON.parse(result.stdout).status).toBe('synthetic_only');
      expect(readFileSync(file, 'utf8')).toBe(content);
      writeFileSync(file, '{invalid');
      expect(run().status).toBe(2);
      const passing = input(Array.from({ length: 100 }, (_, i) => row(String(i))));
      passing.dataKind = 'independently_appraised'; // Fabricated metadata-gate test, not an accuracy claim.
      writeFileSync(file, JSON.stringify(passing));
      expect(run().status).toBe(0);
    } finally {
      // Only the unique directory created above is removed.
      rmSync(directory, { recursive: true, force: true });
    }
  });
});
