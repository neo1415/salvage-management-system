# Assessment price research

Tavily first searches with explicit Nigeria/NGN context and extracts source passages. The enhanced assessment identifies damage first, then sends the exact asset identity and all priceable components to Gemini with Google Search enabled in one request, including Tavily evidence and the valuation-relevant form fields. If any prices remain unverified, Claude receives one web-search request containing those gaps. The result is reused for market value and component costs; the new assessment research path does not call Serper.

Source-backed listings accepted by identity, currency, unit and operation checks take priority. Model summary amounts are never treated as listings. Component prices cannot enter the whole-asset average. Repair services are separate from replacement parts, accessories and bundles. For missing component quotes, the same model batch supplies labelled NGN cost ranges and assumptions. After both providers attempt research, the midpoint is used with source ai_estimate and confidence capped at 60. Replacement estimates are part-only and receive existing fitting/materials/logistics allowances; service estimates are inclusive. Estimated costs never become fabricated listings. Bulk quantity scaling, manual market values and specialist-appraisal rules remain in effect.

## Configuration

Existing provider controls remain authoritative: `PRICE_ADJUDICATION_AI_ENABLED`, `GEMINI_PRICE_ADJUDICATION_ENABLED`, `CLAUDE_PRICE_ADJUDICATION_ENABLED`. With configured keys, research is enabled unless explicitly disabled. Tavily remains available when the model providers are disabled or unconfigured; the legacy search path is used only when Tavily and both model providers are disabled. Serper is not a prerequisite for model research.

`GEMINI_PRICE_ADJUDICATION_MODEL` overrides `GEMINI_MODEL`; otherwise research uses `gemini-2.5-flash`. `CLAUDE_PRICE_ADJUDICATION_MODEL` overrides `CLAUDE_MODEL`; otherwise it uses `claude-sonnet-4-6`. `PRICE_RESEARCH_TIMEOUT_MS` bounds each provider request (default 60 seconds). Claude permits at most 10 searches in its single batch request. A single model request may perform multiple billed web searches.

As checked on 2026-09-07, Google's pricing page lists Gemini 3.8 Flash with free-tier text inference but no free-tier Google Search grounding. Gemini 2.5 Flash still lists a free grounding allowance, subject to account quotas. Retaining 2.5 Flash avoids assuming that the newest free inference model also has free API search. Existing environment overrides are preserved.

Sources: https://ai.google.dev/gemini-api/docs/pricing and https://platform.claude.com/docs/en/agents-and-tools/tool-use/web-search-tool

## Verification

Run `npx vitest run --config vitest.valuation.config.ts`. Batch regressions cover provider call counts, partial fallback, citation-only amounts, separation of component and market evidence, operation compatibility, duplicate components and asset-category routing. A live local Wrangler probe confirmed both configured models can perform native web research independently of Serper. Its findings are diagnostics, not a saved case appraisal.

## Tavily and incomplete repair pricing

Tavily uses the server-only `TAVILY_API_KEY` when configured; otherwise it uses the documented rate-limited keyless Search/Extract mode. Set `TAVILY_PRICE_RESEARCH_ENABLED=false` only to disable this provider. No credential is sent to a model or browser. Search explicitly uses `country=nigeria`, `topic=general`, `search_depth=advanced`, `auto_parameters=false`, `include_answer=false`, and bounded queries/results. Search failure does not block Gemini/Claude research. Queries retain manufacturer, model, year, usage condition and applicable size, capacity, quantity and location; full allowlisted context also goes to the models. Policy numbers, contact details and serials are excluded. Saved quality grades do not establish usage/import history.

Only when researched prices, valid model cost estimates, and documented database costs are all unavailable, it saves the partial assessment with `valuationStatus=repair_pricing_pending`, clears the old salvage/reserve values, and returns a successful partial result. No zero or invented salvage price is published. Approval requires an explicit non-negative salvage override with the existing mandatory explanation. Missing market evidence still prevents a new valuation. Other callers retain the review-required error contract.

Tavily references: https://tavily.com/agent-setup/SKILL.md and https://docs.tavily.com/documentation/api-reference/endpoint/search
