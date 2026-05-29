# Staging database bootstrap (new Supabase project)

For an **empty** Supabase database, do **not** run dozens of old SQL files by hand. Use one bootstrap command that matches how local dev works.

## 1. Get the correct connection string

In Supabase: **Project Settings → Database → Connection string**

- **Session pooler** (port **5432**) is fine for the default bootstrap (`npm run db:bootstrap-staging`).
- **Direct connection** (`db.<ref>.supabase.co`) is only needed if you use `--use-push`.
- Transaction pooler (port **6543**) is not recommended for DDL.
- User format is usually `postgres.<project-ref>`, not plain `postgres`.

**Do not put staging in `DATABASE_URL`** if that file is your production/local config.

Use a one-off env var (do not commit):

```env
STAGING_DATABASE_URL=postgresql://postgres.<staging-ref>:<PASSWORD>@aws-0-eu-west-1.pooler.supabase.com:5432/postgres
```

Production in this repo uses `htdehmkqfrwjewzjingm` — staging uses a **different** project ref (e.g. `esdsufyxydzrertmgyie`). The bootstrap script **refuses** the prod ref.

If you see `password authentication failed`, the password or URI is wrong — reset the DB password in Supabase and copy the new URI.

## 2. Bootstrap schema

```bash
STAGING_DATABASE_URL="postgresql://postgres.<staging-ref>:...@...:5432/postgres" npm run db:bootstrap-staging
```

**Default on Supabase pooler URLs:** applies forward SQL migrations (does **not** use `drizzle-kit push`, which often hangs forever at `Pulling schema from database…`).

This:

1. **Forward SQL files** — all `src/lib/db/migrations/*.sql` except `*rollback*` (5–15 minutes on a fresh DB; you will see progress per file).
2. **Post SQL** — RLS lockdown, indexes, materialized views, MFA columns.

### Optional: drizzle-kit push

Only if you set **Direct connection** in `.env`:

```env
DATABASE_DIRECT_URL=postgresql://postgres.<ref>:<pass>@db.<ref>.supabase.co:5432/postgres
```

```bash
npm run db:bootstrap-staging -- --use-push
```

If it hangs, press **Ctrl+C** and run the default command again (without `--use-push`).

### Resume after a failure

If bootstrap stops partway (e.g. at `0008_add_seed_registry.sql`):

```bash
npm run db:bootstrap-staging -- --from 0008
```

## 3. Optional seed data

```bash
npm run db:seed
```

## 4. Verify

```bash
DATABASE_URL="..." npx tsx scripts/verify-staging-schema.ts
```

## What we intentionally skip

- `*rollback*` migrations — reverse changes; not for empty DB.

## If bootstrap is stuck

`drizzle-kit push` on Supabase often stops at **Pulling schema from database…** (even on session pooler). Press **Ctrl+C**, then run the default command again — it now uses SQL migrations automatically for pooler URLs.

## Staging app env

Align Vercel/staging env with this project:

- `DATABASE_URL` — same as above
- `NEXTAUTH_URL`, `AUTH_SECRET`, Redis, Termii, etc. (separate from DB)

Rotate any credentials that were pasted in chat.
