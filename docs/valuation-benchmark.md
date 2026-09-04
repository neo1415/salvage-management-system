# Offline Valuation Benchmark

**Current actual valuation accuracy is unmeasured. This evaluator does not establish or guarantee 95% real-world accuracy.** Benchmark labels must be supplied by independent appraisers. No empirical dataset ships with this implementation; every test case is synthetic arithmetic data.

## Run Offline

Use the installed local tools; no dependency download, external data, provider call, database connection, environment-file loading or production write is required:

```powershell
node node_modules/tsx/dist/cli.mjs scripts/evaluate-valuation.ts C:\benchmarks\anonymized.json
node node_modules/tsx/dist/cli.mjs scripts/evaluate-valuation.ts --schema
```

The CLI reads one local JSON file and writes the report to stdout. It never writes the input. Exit codes: `0` supplied independent benchmark meets the gate; `1` valid evaluation but target not met, insufficient samples, empty or synthetic data; `2` invalid input, usage or read failure. `--schema` exits `0` and emits the input JSON Schema. Runtime validation additionally enforces unique case IDs, unique categories and category membership; these cross-record checks are not expressed by the generated schema.

## Input Contract

`valuationBenchmarkInputSchema` validates unknown input without coercion; `ValuationBenchmarkInput`, `ValuationBenchmarkCase` and `ValuationBenchmarkReport` are exported TypeScript contracts. All objects reject unknown fields. Schema version is `1`.

This empty template has **no appraisals and no measured accuracy**:

```json
{
  "schemaVersion": 1,
  "datasetId": "replace-with-held-out-dataset-version",
  "predictionVersion": "replace-with-frozen-model-and-policy-version",
  "dataKind": "independently_appraised",
  "currency": "NGN",
  "valuationBasis": "salvage value at the agreed valuation date and location",
  "config": {
    "relativeErrorTolerance": 0.1,
    "minimumSamplesPerCategory": 100,
    "categories": [
      { "category": "vehicle" },
      { "category": "electronics", "relativeErrorTolerance": 0.1 }
    ]
  },
  "cases": []
}
```

Each case requires a unique anonymized `caseId`, a declared `category`, an `appraisal` and a `prediction`. Appraisal fields are `price` (finite and strictly positive), `appraiserReference` and `evidenceReference` (opaque nonempty references), and `independentOfPrediction: true`. The flag is an attestation, not verification of independence. Use `dataKind: "synthetic"` for generated/test data; it can never pass the empirical benchmark gate.

Prediction variants:

| Status | Fields | Scored as a numeric prediction? |
| --- | --- | --- |
| `accepted` | `price`: finite, strictly positive number | Yes |
| `review` | nonempty `reason`, optional positive numeric `price` | No, even if the price matches |
| `abstained` | nonempty `reason` | No |

Missing, string, negative, zero or nonfinite accepted prices fail the entire input. Invalid labels also fail; nothing is silently dropped. Zero appraisal values require a separately designed absolute-error benchmark, not division by zero. Extremely disparate numbers that overflow relative error fail. All cases must use the declared currency, valuation basis and consistent price units; the evaluator performs no conversion or verification of these assertions.

## Metrics And Gate

For each accepted prediction, relative error is `abs(predicted - appraised) / appraised`. A hit is error at or below the category tolerance (default `0.10`, with only machine-rounding slack at the boundary). Configure tolerances in `[0, 1]` before looking at results. A 95% target means 95% of cases within the chosen price tolerance, not prices being 95% exact and not model self-reported confidence.

Each category and the pooled overall result include total cases, accepted numeric predictions, review count, abstentions, hit count, coverage (`accepted / total`), conditional within-tolerance rate (`hits / accepted`) and all-case within-tolerance rate (`hits / total`). Reviews and abstentions remain in the all-case denominator as non-hits. Zero denominators yield `null`, never perfect accuracy. Case results include status, relative error (`null` for review/abstention) and hit flag.

`macroCategory` is the unweighted arithmetic mean of the declared categories' coverage and rates, preventing large categories from dominating the headline. A missing category or undefined conditional rate makes the respective macro metric `null`; categories are never silently excluded. Counts remain pooled in `overall`. No Wilson interval is computed for the macro average because it is not a binomial proportion.

Both accepted-only and all-case hit rates receive the lower endpoint of the **two-sided 95% Wilson score interval**, using `z = 1.959963984540054`:

```text
p = hits / n
lower = (p + z^2/(2n) - z*sqrt(p*(1-p)/n + z^2/(4n^2))) / (1 + z^2/n)
```

This is not the one-sided 95% convention (`z = 1.645`). Empty counts return `null`. For arithmetic illustration only, 95 hits among 100 predictions gives a lower bound of about 88.82%, not evidence of a 95% hit rate.

The fixed target is `0.95`. `benchmarkTargetMet` requires independent-appraisal dataset metadata, at least `minimumSamplesPerCategory` accepted predictions (default 100) in **every declared category**, every category's **all-case** lower bound at least 0.95, and the pooled all-case lower bound at least 0.95. Category `targetMet` is the numerical check only; synthetic datasets still cannot pass the report-level gate. Lowering the sample requirement never bypasses the confidence check. An absent category fails the sample requirement. This gate is intentionally stricter than reporting accuracy only on easy accepted cases.

Report `status` distinguishes `synthetic_only`, `unmeasured`, `insufficient_samples`, `target_not_met`, and `target_met_on_supplied_benchmark`. Passing means only that the supplied dataset meets the declared protocol, not that appraiser independence or real-world representativeness was proven.

## Appraisal Protocol

- Obtain labels from independent appraisers blinded to model predictions; preserve auditable appraisal evidence outside the anonymized file. Do not use model estimates, scraped asking prices or policy defaults as ground truth.
- Agree on salvage versus pre-loss/retail value, currency, taxes/fees, condition, location and valuation date. Resolve appraiser disagreements before unblinding predictions.
- Freeze the prediction system, acceptance/review policy, category universe, tolerances, minimum sample sizes and sampling plan before evaluation. Include all sampled cases, including failures, reviews and abstentions.
- Use a representative held-out cohort covering intended asset categories and operating conditions. Keep related assets and repeated appraisals out of independent sample counts. Do not tune on this test set or cherry-pick categories.
- Wilson intervals assume independent representative Bernoulli outcomes and do not correct selection bias, label uncertainty, distribution shift or repeated evaluation. Per-category intervals are marginal, not simultaneous 95% confidence across all categories. Formal broad claims require a prespecified statistical review and new external validation.
- Use opaque IDs only; omit names, contacts, VINs, registration plates, addresses and secrets. Reports repeat case IDs and dataset metadata, so anonymize those too.

## Safe Tests

**Do not run the default Vitest configuration for this evaluator.** Its shared setup connects to a database and runs `ALTER TABLE`. The dedicated configuration uses Node, `setupFiles: []`, only this test file, and no app/provider imports. Additional sentinel URLs can be set for defense in depth:

```powershell
$env:DATABASE_URL = 'postgres://offline:offline@127.0.0.1:1/offline'
$env:TEST_DATABASE_URL = $env:DATABASE_URL
node node_modules/vitest/vitest.mjs run --config tests/unit/valuations/valuation-benchmark.config.ts
```

The tests cover tolerances, denominators, coverage, review/abstention, macro weighting, missing categories, minimum samples, Wilson arithmetic, invalid input, synthetic gating, serialization and the local CLI. CLI tests create and remove only their own temporary synthetic JSON files. No existing production valuation behavior is changed.
