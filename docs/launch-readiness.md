# Launch and staging workflow

Early auction closure requests can be reviewed by active system administrators assigned to either the Managing Director or Executive Director department. Both designations receive the approval notice and can access the request list, detail, and decision endpoints.

The public NEM site uses `https://nemsalvage.com` for its canonical URLs. Requests on salvagebridge.com receive `X-Robots-Tag: noindex, follow`; crawling remains allowed so search engines can read the directive. Staging has noindex responses and an empty sitemap. Google must recrawl before existing search results disappear.

## Staging

- Production Vercel project: `salvage-management-system`, tracking `main`.
- Staging Vercel project: `salvage-staging`, tracking `staging`.
- Local staging: `npm run dev:staging`, reading `.env.staging`.
- Keep database, authentication URLs, and environment-specific credentials separate when adding configuration.
- Apply forward SQL migrations to staging before testing schema-dependent features. Migration 0055 records previously untracked schema additions.
- Promote tested commits through normal Git merges. Do not force-push over staging-only work.

The September 2026 launch reset retained the current Yemi Mayadenu invitation and the administrator account, preserving password hashes and password-change flags. Operational tables and report materialized views were cleared/refreshed. Audit immutability remains active for future events. A local protected database backup was taken before the reset. Avoid rerunning older reset scripts that preserve only one account.
