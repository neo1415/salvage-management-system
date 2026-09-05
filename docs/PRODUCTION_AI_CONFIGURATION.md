# Production AI Configuration

## Objective

Production assessments use Gemini for detailed damage analysis and grounded price research. Paid Claude takes over when Gemini is unavailable or does not return native-cited price evidence. The assessment endpoints allow up to five minutes for the complete damage, market, and replacement-part workflow.

## Required Vercel Variables

Set these values for the **Production** environment in the Vercel project that serves `salvagebridge.com`:

```text
GEMINI_API_KEY=<existing Gemini key>
CLAUDE_API_KEY=<existing Anthropic key>
MOCK_AI_ASSESSMENT=false
CLAUDE_DAMAGE_FALLBACK_ENABLED=true
PRICE_ADJUDICATION_AI_ENABLED=true
GEMINI_PRICE_ADJUDICATION_ENABLED=true
CLAUDE_PRICE_ADJUDICATION_ENABLED=true
GEMINI_DAMAGE_TIMEOUT_MS=75000
PRICE_RESEARCH_TIMEOUT_MS=60000
GEMINI_DAILY_REQUEST_LIMIT=20
CLAUDE_DAMAGE_DAILY_LIMIT=2
CLAUDE_DAMAGE_MAX_TOKENS=2200
PART_PRICE_SEARCH_LIMIT=8
```

The request limits are application-side guardrails, not provider quota increases or account-wide spend caps. The Claude damage limit does not cap paid price research. Keep provider-console spend limits in place. Set both Claude enable flags to false for no paid Claude calls; this reduces availability when Gemini cannot supply evidence. Serper credits are not required for native Gemini/Claude research, but neither provider guarantees a matching listing.

## Vercel Dashboard

1. Open the `salvagebridge.com` project in Vercel.
2. Open **Settings**, then **Environment Variables**.
3. Add or update every variable above and select **Production**.
4. Mark `GEMINI_API_KEY` and `CLAUDE_API_KEY` as sensitive.
5. Open **Deployments**, select the latest production deployment, and choose **Redeploy**.
6. Run one assessment and inspect its response and saved assessment for the provider, accepted source URLs, market value, and part evidence. Production builds may remove console messages, so absence of a success log is not a reliable failure signal.

Vercel applies changed variables only to new deployments. A redeploy is therefore required even when no code changed.

## Vercel CLI

The local checkout must first be authenticated and linked:

```powershell
npx vercel@latest login
npx vercel@latest link
npx vercel@latest env ls production
```

Add non-secret controls with `env add` or `env update`, for example:

```powershell
npx vercel@latest env add PRICE_ADJUDICATION_AI_ENABLED production
npx vercel@latest env add GEMINI_PRICE_ADJUDICATION_ENABLED production
npx vercel@latest env add CLAUDE_PRICE_ADJUDICATION_ENABLED production
npx vercel@latest env add CLAUDE_DAMAGE_FALLBACK_ENABLED production
npx vercel@latest env add GEMINI_DAMAGE_TIMEOUT_MS production
npx vercel@latest env add PRICE_RESEARCH_TIMEOUT_MS production
npx vercel@latest deploy --prod
```

Enter values only at the CLI prompts. Do not place API keys directly in command history.

## Production Verification

Use a case with exact asset identity, condition, quantity/unit where applicable, and the required photo angles. A complete run should return:

- detailed damage assessment from Gemini or Claude;
- exact-identity market comparables with source URLs;
- replacement-part evidence for repairable damaged components;
- market value, repair cost, salvage value, confidence, and review reasons;
- no cached result when evidence is empty or still requires manual review.

If both grounded providers fail, the system deliberately refuses to invent a valuation. Check provider quota, billing, function logs, and outbound connectivity before retrying.

## Verification Status and Launch Gate

The local provider keys were usable, but the live research checks did not establish an accepted exact-match valuation. A complete production assessment has not been verified. Vercel CLI authentication was unavailable, so these production variables have not been applied from this checkout.

Automated tests measure extraction and orchestration behavior, not real-world valuation accuracy. Public asking prices are not completed-sale prices. The public Auctionit pages inspected had conflicting sale/status indicators and must not be used as confirmed sale benchmarks. No 95% or 99% accuracy claim is justified by these checks.

Before launch, compare complete assessments against independently reviewed, dated local appraisals for every supported asset category, including parts, labour, quantities, taxes, condition, and salvage recovery costs. Record price error separately from availability. Photos alone cannot confirm internal damage or safety-critical repairability; those decisions require inspection.
