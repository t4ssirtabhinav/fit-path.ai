# Branching & Environment Strategy — Refresher for a Solo Developer

## Current state (as of June 2026)

- **Git**: single `main` branch on GitHub (`t4ssirtabhinav/fit-path.ai`). All commits go directly to `main`. No CI workflows configured (`.github/workflows` doesn't exist).
- **Database**: one Supabase project (`fdkbyhtzeyeoziduwvky`) — this **is** production. `list_branches` shows only the default `main` branch (`persistent: false`), i.e. no active preview/dev branches exist today.
- **Schema changes**: tracked as migration files in `supabase/migrations/`, but (per the recent `config.toml` add-then-revert) Supabase's GitHub-integration branching isn't cleanly working yet — the `config.toml` addition caused a "Postgres config not found" preview-branch error and was reverted.
- **Edge functions**: deployed directly (currently `generate-plan` at version 28) — presumably via `supabase functions deploy` or the MCP `deploy_edge_function` tool, straight to the prod project.
- **Frontend**: built with Vite/React, hosted via **Bolt** (Bolt's hosting, which deploys the built app — typically backed by Netlify under the hood). Day-to-day editing now happens via Claude Code/direct git, not Bolt's own editor.

**The core risk today**: every schema change, edge function deploy, and frontend push lands on production immediately, with no isolated place to catch a bad migration, a buggy edge function, or a broken build before real users hit it.

---

## Goal: the *minimum* environment separation that meaningfully reduces risk

For a solo developer, a full multi-environment pipeline (dev → staging → prod, each with its own persistent DB, secrets, and deploy pipeline) is usually **over-engineering** — it adds ongoing cost and "which environment am I even looking at" overhead that isn't worth it pre-scale. The goal here is the **smallest set of changes that stops accidental prod breakage**, not a textbook enterprise setup.

Recommended model: **two persistent environments (Local + Production) plus on-demand, ephemeral preview environments for risky changes.**

| Environment | Purpose | Lifetime | Cost |
|---|---|---|---|
| **Local** | Day-to-day UI/logic development | Always available | $0 (your machine) |
| **Ephemeral preview branch** (Supabase) | Test schema migrations / risky edge function changes against a real Postgres before they touch prod | Minutes to a few hours, then deleted | ~$0.0134/hour (~$0.32/day) — a few cents per use if deleted promptly |
| **Production** | Live app, live data | Always | Existing Supabase Pro + Bolt hosting cost |

This avoids paying for a second persistent database while still giving you a safe place to test the changes that actually carry risk (schema migrations, RLS policy changes, edge function rewrites that touch data).

---

## 1. Git workflow: lightweight trunk-based development

You don't need GitFlow's `develop`/`release`/`hotfix` branches as a solo dev — that's overhead designed for coordinating multiple people. Instead:

1. **`main` = production**, always deployable.
2. For any non-trivial change, create a **short-lived feature branch** (`feature/perplexity-fallback`, `fix/streak-bug`, etc.).
3. Open a **PR into `main`**, even though you're the only reviewer. This isn't bureaucracy — it's the trigger point for:
   - An automated CI check (see §4) that catches typecheck/lint/build errors *before* they reach `main`.
   - A deliberate "review my own diff" pause — the single highest-value habit change here, since it's the moment you notice "wait, I left a `console.log`" or "this migration drops a column I still use."
4. Merge to `main` → this is your deploy trigger (frontend + edge functions + migrations, see below).
5. Delete the feature branch after merging.

For genuinely tiny changes (a copy tweak, a one-line CSS fix), pushing straight to `main` is fine — don't over-apply process. Reserve the PR step for anything touching the database schema, edge functions, auth, or payment/health-data logic.

---

## 2. Database: stop editing production schema directly

This is the **highest-impact, lowest-cost change** you can make, independent of any branching tooling:

### Rule: all schema changes are migration files, applied via CLI/MCP — never the SQL Editor on prod
- Every schema change becomes a file in `supabase/migrations/` (you're already doing this — good).
- Apply it to prod via `supabase db push` (Supabase CLI) or the `apply_migration` MCP tool — **never** paste ad-hoc SQL into the Supabase Studio SQL Editor against the prod project. The SQL Editor is fine for *read-only* debugging queries, never for schema changes or data mutations you want tracked.
- This alone gives you a complete, ordered history of every schema change and makes rollback (write a new migration that reverses it) straightforward.

### For low-risk, additive changes — apply directly to prod
Adding a new nullable column, a new table, a new index, a new RLS policy that only *adds* access — these are safe to write as a migration and apply directly to prod. Low blast radius, easy to reverse.

### For risky changes — test on an ephemeral preview branch first
"Risky" means: column type changes, `NOT NULL` additions to existing tables, drops/renames, data backfills, RLS policy changes that *restrict* existing access, or anything paired with an edge function rewrite that depends on the new shape.

**Workflow for a risky change:**
1. Create a Supabase preview branch (via the dashboard, or `supabase branches create` once the GitHub integration is working — see §5 for the `config.toml` issue to resolve first).
2. Point your **local** `.env.local` (`VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`) at the preview branch's credentials.
3. Apply your new migration(s) to the preview branch, deploy the updated edge function(s) to it, and run through the feature end-to-end locally against it.
4. Once verified, apply the same migration(s) and edge function(s) to **production**, switch your local `.env.local` back to prod, merge the PR.
5. **Delete the preview branch immediately** — this is what keeps the cost to cents rather than the ~$9.60/month a forgotten branch accrues.

### Optional: local Supabase via CLI (`supabase start`)
If you have Docker available, `supabase start` runs a full local Postgres + Auth + Storage stack — completely free, no time limit, good for rapid iteration on migrations before even creating a cloud preview branch. Not required, but worth knowing about if the per-hour preview-branch cost ever feels limiting during heavy schema-iteration days.

---

## 3. Edge functions: versioning is your rollback mechanism

Supabase already keeps a version history per function (e.g., `generate-plan` is at version 28 — each `deploy` creates a new version, old ones remain). This means:
- **Rollback = redeploy the previous version's code.** Since your code is in git, "previous version" = `git checkout` the prior commit's `supabase/functions/generate-plan/index.ts` and redeploy it. You don't need a special rollback tool — git history *is* your edge-function version history, as long as you deploy from what's committed (not from uncommitted local edits).
- **For risky edge function changes** (new external API calls, changed response shapes, new env vars/secrets): deploy to the preview branch from §2 first if the change is paired with a schema change, or just test thoroughly against prod data via the local frontend before deploying to prod if it's a standalone change — edge functions are cheap/fast to redeploy, so the cost of a quick prod deploy-and-revert is low, but a 502 mid-deploy on `generate-plan` is user-visible, so prefer testing locally against the prod Supabase project (calling the function via `supabase functions serve` locally, which runs the function code locally against your real DB) before deploying.

---

## 4. CI: a free safety net you don't have yet

Add a single GitHub Actions workflow (`.github/workflows/ci.yml`) that runs on every PR into `main`:
```yaml
name: CI
on:
  pull_request:
    branches: [main]
jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: npm ci
      - run: npm run lint
      - run: npm run typecheck
      - run: npm run build
```
This costs **$0** (GitHub Actions free tier covers this easily for a solo project) and catches the most common "oops" — a TypeScript error, an ESLint failure, or a build break — *before* it merges to `main` and (depending on Bolt's deploy trigger) potentially before it ships to production. This is the single highest-leverage, lowest-overhead addition in this entire document — set it up first, before anything else here.

---

## 5. Frontend hosting (Bolt): things to verify

Since Bolt hosting's exact deploy trigger isn't visible from the repo, verify the following (5-minute check in Bolt's project settings):
1. **Does Bolt auto-deploy on push to `main`?** If yes, that's your production deploy trigger — good, no extra step needed, but it also means a CI check on `main` itself (in addition to PRs) is worth having so a bad merge doesn't immediately go live.
2. **Does Bolt create preview deploys for non-`main` branches/PRs?** If yes, you get a free per-PR preview URL for frontend-only changes — useful, but remember it'll be hitting **production Supabase** unless you've configured it to use a preview branch's environment variables (most preview-deploy systems let you override env vars per branch — check if Bolt/Netlify supports this).
3. If Bolt's hosting is backed by Netlify (common for Bolt projects), you may have access to Netlify's branch-deploy and deploy-preview features directly, including environment-variable overrides per context (`production` vs `branch-deploy` vs `deploy-preview` in `netlify.toml` or the Netlify dashboard) — worth checking the Netlify dashboard directly if you have access, since this could give you frontend preview environments "for free" (no extra hosting cost beyond what Bolt already provides).

---

## 6. Resolving the `config.toml` issue (prerequisite for cloud preview branches)

The reverted `supabase/config.toml` addition is the blocker for using Supabase's GitHub-integration branching cleanly. To use cloud preview branches (§2), you'll need a working `config.toml`. Common causes of the "Postgres config not found" preview-branch error:
- A missing or mismatched `[db] major_version` field — preview branches need to know which Postgres major version to provision, and this must match your production project's version.
- The `project_id` in `config.toml` must match the linked project ref (`fdkbyhtzeyeoziduwvky`).

**Recommendation**: before relying on cloud preview branches as part of this workflow, run `supabase link --project-ref fdkbyhtzeyeoziduwvky` locally (which generates a correct `config.toml` for your linked project) rather than hand-writing one — this is the most common fix for the "config not found" class of error, since a hand-written/AI-generated `config.toml` can easily miss a field the CLI would have populated automatically.

---

## 7. Secrets across environments

- **Production secrets** (`GEMINI_API_KEY`, and soon `PERPLEXITY_API_KEY` per the companion doc) live in the prod project's Edge Function secrets — set via `supabase secrets set` or the dashboard.
- **Preview branches** can have their own secrets set independently — when testing an edge function change on a preview branch that needs a secret, remember to set it there too (it does **not** automatically inherit from prod). This is an easy thing to forget and get a confusing "works on prod, 503s on preview branch" result.
- **Local development**: keep a `.env.local` (already gitignored) with either prod or preview-branch credentials depending on what you're working on. Never commit real keys — `.env` is already in `.gitignore`, good.

---

## 8. Putting it together: a typical feature workflow

**Small UI/copy change (no schema/edge-function impact):**
1. Edit locally, test against prod Supabase (read operations are harmless).
2. Commit + push to `main` directly (or a quick PR if you want the CI check).

**Feature with a new column + edge function update (e.g., a future "progress photos" feature):**
1. `git checkout -b feature/progress-photos`
2. Write the migration file locally.
3. Create a Supabase preview branch; apply the migration there.
4. Point `.env.local` at the preview branch; run `npm run dev` and `supabase functions serve` locally against it; build and test the feature fully.
5. Open a PR → CI runs (lint/typecheck/build).
6. Once happy: apply the migration to prod, deploy the edge function to prod.
7. Merge PR → `main` deploys (Bolt).
8. Switch `.env.local` back to prod defaults; **delete the preview branch**.

**Emergency hotfix (prod is broken right now):**
1. Fix directly on a `hotfix/...` branch off `main`.
2. Skip the preview-branch step if the fix is small and the risk of *not* fixing immediately outweighs the risk of the fix itself (e.g., reverting a bad edge function deploy to its previous git-committed version — see §3).
3. Merge to `main` immediately; retroactively open a PR for the record if useful.

---

## 9. Overhead summary — what this actually costs you

| Item | One-time setup | Ongoing cost | Ongoing time per feature |
|---|---|---|---|
| CI workflow (§4) | ~30 min | $0 | $0 — runs automatically |
| Migration-file discipline (§2) | $0 (habit change) | $0 | Marginal — you're already writing migration files |
| `supabase link` to fix `config.toml` (§6) | ~15 min | $0 | One-time |
| Ephemeral preview branches (§2, §5) | $0 | ~$0.32/day **only while a branch is open** — a few cents per risky change if deleted promptly | +10-15 min per *risky* change (create branch, point env, test, delete) |
| PR-based review habit (§1) | $0 | $0 | A few minutes of self-review per non-trivial change |

**Bottom line**: for the majority of changes (UI tweaks, additive low-risk schema changes), overhead is essentially **zero** beyond the CI check. The extra ~10-15 minutes and ~$0.01-0.05 per use only kicks in for genuinely risky changes — exactly where that overhead is worth paying.

---

## 10. One-time setup checklist

- [ ] Add `.github/workflows/ci.yml` (lint + typecheck + build on PRs to `main`)
- [ ] Run `supabase link --project-ref fdkbyhtzeyeoziduwvky` to get a correct `config.toml`
- [ ] Verify Bolt's deploy trigger and check whether it/Netlify supports per-branch environment variable overrides
- [ ] Adopt the "migrations only, never SQL Editor on prod" rule going forward
- [ ] Next time a schema change is risky, do a dry run of the preview-branch workflow (§2) end-to-end once, so it's familiar before you need it under time pressure
