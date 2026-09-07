# Assessment price research

The enhanced assessment identifies damage first, then sends the exact asset identity and all priceable components to Gemini with Google Search enabled in one request. If any prices remain unverified, Claude receives one web-search request containing those gaps. The result is reused for market value and component costs; the assessment does not call Serper when a model research provider is enabled.

Only native-cited listings accepted by identity, currency, unit and operation checks supply numeric prices. Model summary amounts are never treated as listings. Component prices cannot enter the whole-asset average. Repair services are separate from replacement parts, accessories and bundles. Missing costs remain unavailable for review or documented database repair pricing. Bulk quantity scaling, manual market values and specialist-appraisal rules remain in effect.

## Configuration

Existing provider controls remain authoritative: `PRICE_ADJUDICATION_AI_ENABLED`, `GEMINI_PRICE_ADJUDICATION_ENABLED`, `CLAUDE_PRICE_ADJUDICATION_ENABLED`. With configured keys, research is enabled unless explicitly disabled. If both model providers are disabled or unconfigured, the legacy search path remains available. Serper is not a prerequisite for model research.

`GEMINI_PRICE_ADJUDICATION_MODEL` overrides `GEMINI_MODEL`; otherwise research uses `gemini-2.5-flash`. `CLAUDE_PRICE_ADJUDICATION_MODEL` overrides `CLAUDE_MODEL`; otherwise it uses `claude-sonnet-4-6`. `PRICE_RESEARCH_TIMEOUT_MS` bounds each provider request (default 60 seconds). Claude permits at most 10 searches in its single batch request. A single model request may perform multiple billed web searches.

As checked on 2026-09-07, Google's pricing page lists Gemini 3.8 Flash with free-tier text inference but no free-tier Google Search grounding. Gemini 2.5 Flash still lists a free grounding allowance, subject to account quotas. Retaining 2.5 Flash avoids assuming that the newest free inference model also has free API search. Existing environment overrides are preserved.

Sources: https://ai.google.dev/gemini-api/docs/pricing and https://platform.claude.com/docs/en/agents-and-tools/tool-use/web-search-tool

## Verification

Run `npx vitest run --config vitest.valuation.config.ts`. Batch regressions cover provider call counts, partial fallback, citation-only amounts, separation of component and market evidence, operation compatibility, duplicate components and asset-category routing. A live local Wrangler probe confirmed both configured models can perform native web research independently of Serper. Its findings are diagnostics, not a saved case appraisal.
