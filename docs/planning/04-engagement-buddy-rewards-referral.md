# Plan: Buddy Feature Evolution, Loyalty/Rewards & Referral System

Covers tickets **#14 (buddy feature analysis), #15 (loyalty & rewards), #16 (referral system)**.

These three are deeply intertwined — referrals need a reward to be worth doing, rewards need meaningful actions (many of which are buddy-related) to reward, and the buddy system is the app's clearest social/competitive hook. Recommend designing them as **one connected engagement system**, even if shipped in stages.

---

## 1. Buddy Feature — Current Gaps & Evolution (Ticket #14)

### What already exists (it's more mature than "needs analysis" might suggest)
Two-way invite system with codes/links, pending/active/declined status, head-to-head comparison (streak, completion %, "you lead/tied/behind"), shame messaging, partial task visibility via RLS, and a milestones concept (currently hardcoded in the UI rather than persisted/earned).

### How comparable apps approach this space (without copying anything proprietary — these are widely-used, generic patterns)
- **Strava**: segments/leaderboards scoped to specific activities or routes, kudos (lightweight social reactions), challenges with badges
- **Apple Fitness / Fitness+**: "Share Activity" with close contacts, competitions with daily scoring and friendly notifications when a friend is close to beating you
- **Duolingo**: leagues (small cohort-based weekly leaderboards that promote/demote — crucially, *not* one global leaderboard, which would feel hopeless to most users), streak protection mechanics, friend-vs-friend XP races
- **Habitica**: full RPG-style party/guild system where habits become "quests" — a heavier-weight model, useful as inspiration for "groups" rather than as a direct template

**The common thread**: the most effective patterns pair *small, bounded social groups* (not global rankings, which demotivate everyone outside the top tier) with *time-boxed competition* (resets create fresh chances to "win," preventing one early leader from permanently discouraging everyone else).

### Concrete extension ideas (roughly ordered by leverage vs. effort)

1. **Persist milestones as actually-earned achievements.** Currently hardcoded UI — move to a real `user_milestones` (or reuse the existing `milestones` table per the audit, which exists but isn't populated) record created when criteria are met, with a timestamp. This is foundational for #15 (rewards) and turns "milestones" from decoration into something genuinely motivating (and shareable).
2. **Buddy "kudos"/reactions** — a lightweight way to acknowledge a buddy's good day (e.g. tapping a 👏 on their tile when they complete their checklist) without needing a full chat/comments system. Low engineering cost, meaningfully increases the social-glue feeling.
3. **Small-group "pods" / leaderboards** (the ticket's explicit question — *"Groups in buddies and leaderboards?"*): rather than one global leaderboard (which, per the research above, tends to demotivate), introduce **groups of ~4-8 people** (could be auto-formed from mutual buddy connections, or user-created/joinable via an invite-code mechanism extending the existing one) with a **weekly, resetting leaderboard** ranked by the existing scoring concepts (streak, completion %). Weekly resets mean everyone gets a fresh shot regularly — a far healthier dynamic than a permanent ranking.
4. **Time-boxed buddy challenges** — e.g. "7-day step challenge" or "no-miss week" between a pair or a pod, with a defined start/end and a clear winner-determination rule, tying naturally into the rewards system below.
5. **Buddy activity feed (lightweight)** — e.g. "Alex hit a 14-day streak 🔥" surfaced as small notification-style entries, giving the relationship more texture than just the head-to-head card. Needs careful scoping to avoid becoming a privacy/noise problem — opt-in visibility per achievement type is a reasonable default.

### What to deliberately *not* build (at least initially)
- Open/global leaderboards (demotivating at scale, and a moderation burden)
- Public profiles/follower systems beyond the existing mutual-buddy model (significant privacy-surface increase for unclear payoff at this stage)
- Real-time chat (a substantial feature in its own right, with moderation implications — a separate roadmap item if ever pursued)

---

## 2. Loyalty & Rewards System (Ticket #15)

### Research: what the gamification/rewards space generally agrees on
- **Points alone don't sustain motivation** — they need to connect to something the user values (status, unlocks, social recognition, or simply *visible proof of progress*). Points-as-decoration fatigue quickly.
- **Streaks are the single most proven mechanic** in habit apps (Duolingo's streak system is widely cited as their strongest retention lever) — and FitPath already has this. Build *on* it rather than introducing a competing currency that dilutes its importance.
- **Variable/surprise rewards** (occasional unexpected recognition — "bonus" badges for things the user didn't know were tracked) outperform purely predictable ones, but should be used sparingly so they don't feel manipulative.
- **Loss aversion / "shame" mechanics** (which the app already leans into via "Shame Mode") are powerful but need to be balanced carefully — research on this is genuinely mixed: it works well for some users and actively drives others away. The ticket explicitly asks for a "shame factor" to discourage hollow point-chasing — the way to do this *without* it backfiring broadly is to make it **opt-in or buddy-relative** (as it already is — comparing to a specific person you chose, not a faceless system) rather than a blanket app-wide pressure tactic.

### Recommended model: a unified "Consistency Score" + tiered recognition (not a spendable currency)
Rather than inventing a points-as-currency system (which implies a "store" and ongoing economy-balancing work), recommend a **recognition-based** model:

1. **A single visible "Consistency Score"** (ties directly into ticket #12's reporting ask) — a rolling composite of: task completion rate, logging consistency (did they record their data), and streak length. This becomes the one number users care about improving — simpler than juggling multiple currencies.
2. **Earned badges/achievements** (building on the persisted-milestones idea from #14) tied to *meaningful* actions, not trivial ones — e.g. "30-Day Streak," "Logged vitals 7 days running," "Completed your first plan phase," "Helped a buddy hit their goal" (a reciprocal badge — rewards *supporting* others, not just competing with them, which research suggests produces healthier long-term engagement than pure competition).
3. **Visible progress, not redeemable currency**: badges and tiers (e.g. Bronze/Silver/Gold consistency tiers recalculated monthly) that show up on the user's profile and to their buddies — status and self-evidence of progress are often more durable motivators than points that can be "spent" (which immediately raises the question of spent-on-what, an economy you'd then have to design, balance, and maintain).
4. **Anti-gaming design** (directly addressing the ticket's "psychologically restricting them so they don't just log to win" concern): weight the score toward *task completion and outcomes* (e.g. logged measurements showing real trends) rather than raw logging frequency — so spamming low-effort log entries doesn't move the needle, only genuine engagement with the plan does. Combined with the immutability and outlier-detection rules from doc 03, this closes most of the obvious gaming vectors structurally, rather than relying on users' goodwill.

### Suggested phased rollout
- **Phase 1**: persist milestones (shared groundwork with #14), introduce the Consistency Score, surface both on Progress/Profile.
- **Phase 2**: add buddy-relative recognition (reciprocal "supporter" badges, pod leaderboards from #14).
- **Phase 3 (only if there's a clear signal it's wanted)**: explore a lightweight unlock system (e.g. cosmetic profile flair, new chart styles) as a "spend" outlet for advanced users — but treat this as optional polish, not core to the system's success.

---

## 3. Referral System (Ticket #16)

### Recommended approach: extend the existing invite-code infrastructure
The buddy system already has exactly the mechanics a referral system needs — unique 8-character codes, shareable links (`/join/{code}`), and a redemption flow (`JoinBuddyPage`). Rather than building a parallel referral system, **layer referral semantics onto the existing invite mechanism**:

1. When a *new, never-before-registered* user signs up via someone's invite link/code (vs. an existing user simply connecting as a buddy), record a `referrals` entry: `{referrer_id, referee_id, status, created_at}`.
2. Define a clear **completion criterion** before any reward is granted — e.g. "the referee verifies their email AND completes onboarding" (this naturally guards against fake-account abuse, and conveniently reuses the verification-gating work from doc 02). Reward only on completion, never on signup alone.
3. **Reward both sides** (a well-established pattern — e.g. Dropbox, Robinhood, Revolut all reward referrer *and* referee) — this roughly doubles the conversion incentive and feels fairer than a one-sided reward. Tie the reward into whatever recognition system #15 establishes (e.g. a "Connector" badge plus Consistency Score bonus for both parties) rather than inventing a separate referral-specific currency.

### Abuse prevention (essential — referral systems are a classic abuse target)
- Cap rewarded referrals per user over a time window (e.g. no more than N rewarded referrals per month) to blunt spam/farming.
- Tie rewards to genuine activity completion (per the criterion above) — not signup — which structurally prevents the most common abuse pattern (mass-creating throwaway accounts).
- Consider basic anti-fraud signals if abuse becomes real: same-device/IP detection for referrer+referee pairs, email-domain heuristics, etc. — but don't over-engineer this upfront; start simple and add friction only if abuse is observed.

### UX
- Surface "Invite a friend" prominently on the Profile and/or Buddy pages (it's a natural extension of the existing "share invite link" UI), with a simple status view: "3 invited, 1 joined, 1 reward earned."
- Frame the messaging around the *mutual benefit* ("you both get [X]") rather than purely transactional language — this consistently performs better in referral programs generally.
