import { readFileSync } from 'node:fs';
import { evaluateValuationBenchmark, valuationBenchmarkJsonSchema } from '../src/features/valuations/services/valuation-benchmark';

try {
  const args = process.argv.slice(2);
  if (args.length !== 1) throw new Error('Usage: tsx scripts/evaluate-valuation.ts <local-anonymized.json> | --schema');
  if (args[0] === '--schema') {
    process.stdout.write(`${JSON.stringify(valuationBenchmarkJsonSchema, null, 2)}\n`);
  } else {
    const raw = JSON.parse(readFileSync(args[0], 'utf8').replace(/^\uFEFF/, ''));
    const report = evaluateValuationBenchmark(raw);
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    process.exitCode = report.benchmarkTargetMet ? 0 : 1;
  }
} catch (error) {
  process.stderr.write(`Valuation benchmark failed: ${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 2;
}
