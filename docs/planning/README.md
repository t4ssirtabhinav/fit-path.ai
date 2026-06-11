# Future Roadmap — Planning Docs (no code yet)

Six themed planning documents covering 20 requested tickets, written after auditing the current codebase (June 2026) so each plan references real files/tables rather than assumptions. Nothing here has been built — these are research + UX/architecture proposals for prioritization and discussion.

| Doc | Tickets covered | Theme |
|---|---|---|
| [01-pre-login-trust-and-legal.md](01-pre-login-trust-and-legal.md) | #1, #5, #6 | Landing/carousel UX, compliance & privacy research, footer + legal pages (About/Contact/Privacy/Terms) |
| [02-auth-security-and-sessions.md](02-auth-security-and-sessions.md) | #2, #3, #4, #8 | Email-verification gap-closing (it already exists — the real gaps are data-creation timing + rate limiting), forgot/reset password, session management |
| [03-tracking-vitals-dashboards-profile.md](03-tracking-vitals-dashboards-profile.md) | #9, #10, #11, #12, #13 | Post-signup empty-state UX, Today-page logging revamp (structured vitals, outlier detection, cadence buffers), only-tracking parity, reporting/dashboards/scoring, profile image upload |
| [04-engagement-buddy-rewards-referral.md](04-engagement-buddy-rewards-referral.md) | #14, #15, #16 | Buddy feature evolution (groups/leaderboards), loyalty & rewards (consistency score + badges, not a spendable currency), referral system built on existing invite-code infra |
| [05-content-ai-plans-personalization.md](05-content-ai-plans-personalization.md) | #17, #18, #19 | Self-service plan adjustments with AI-as-guardrail, quick-read content library, plan-generation fallback (reframed: similarity-matching as an AI *input*, not a replacement — flagged as the highest-risk idea in the batch) |
| [06-platform-error-logging-and-emails.md](06-platform-error-logging-and-emails.md) | #7, #20 | Centralized error monitoring (Sentry recommended), transactional/lifecycle email system (Resend + react-email recommended) |
| [07-beta-priority-matrix.md](07-beta-priority-matrix.md) | All 20 + 7 new (N1-N7) | Beta-readiness priority matrix: tiers, effort/complexity/dependency/impact/cost for every ticket above plus 7 newly-raised items (workout-plan flattening, exercise/meal logging, tracking-only fix, profile cleanup, mobile number, WhatsApp) |

## Cross-cutting notes worth keeping in mind when prioritizing
- **Doc 06 (error logging + emails) is largely foundational** — several other plans (security notices, reminders, referral confirmations, plan-adjustment audits) assume some logging/email capability exists. Worth sequencing relatively early despite being less visible.
- **Doc 03's vitals data model is a prerequisite for Doc 03's own reporting work (#12)** and feeds Doc 04's scoring system — that cluster has a natural internal order (logging → reporting → scoring).
- **Doc 04's three tickets (#14/#15/#16) are designed as one connected engagement system**, not three independent features — the rewards system needs buddy-derived actions to reward, and referrals need a reward worth chasing.
- **Ticket #19 (plan-generation fallback) was deliberately reframed** from "serve similar users' plans directly" to "use similarity-matching as an input to AI generation, plus a separate rules-based outage fallback" — the original framing carries real safety risk for a health-adjacent product (a wrong plan is a higher-stakes mistake than a wrong content recommendation).
- **Ticket #2 (email verification) needed a correction**: it already exists and is required at login. The real, actionable gaps are (a) profile/data creation happening *before* verification rather than after, and (b) missing rate limits on resends — both addressed in doc 02.
