# Plan: Self-Service Plan Updates, Quick-Read Content & Plan-Generation Fallback

Covers tickets **#17 (self plan updates + AI validation), #18 (quick-read bytes), #19 (plan-generation fallback / weighted matching)**.

These all sit close to the AI plan-generation core (`generate-plan` edge function, `plans` table, Gemini integration) — recommend a shared technical reviewer/owner across all three since they touch the same surface area.

---

## 1. Self-Service Plan Updates with AI Validation (Ticket #17)

### The problem being solved
Today, a dissatisfied user's only lever is full regeneration — gated behind a 30-day cooldown (`PlanPage`) and producing an entirely new plan rather than an adjustment to the one they have. That's a blunt instrument for what's often a narrow complaint ("the timeline feels too aggressive" / "I can't do dairy" / "I want to swap out one supplement").

### Recommended approach: a structured "Request a change" flow, not free-form plan editing
Free-form editing of an AI-generated, safety-reviewed plan is risky — a user could remove a "rest day" that was load-bearing for injury management, or tweak calorie targets into an unsafe range, and the app would have no way to know. Instead:

1. **Offer a constrained set of adjustable dimensions** that map to what users actually tend to want changed: timeline/pace, dietary constraints (allergies, dislikes, cuisine preferences — much of which is *already captured* in `health_profiles`/`onboarding_details` and could simply be re-editable), specific supplement swaps, and workout intensity/frequency preferences.
2. **Route every requested change back through the AI** (not as a full regeneration, but as a *targeted* prompt: "here is the user's current plan, here is what they'd like changed, and here is their full health profile — produce an updated version of [the specific section] consistent with their goals and any safety constraints"). This is the "AI validation" the ticket asks for — the AI acts as a guardrail checking the requested change against the user's actual health context, not just blindly applying it.
3. **Show a diff/preview before committing** — "Here's what would change" — so the user can accept, decline, or further refine before the plan updates. This avoids the frustration of a full regeneration overwriting things they liked.
4. **Decouple from the 30-day full-regeneration cooldown** — targeted adjustments are lower-risk and lower-cost (smaller prompts, narrower scope) than full regenerations, so a separate, shorter cooldown (or a cap like "up to 3 adjustment requests per phase") is more appropriate. This also avoids one mechanism cannibalizing the other.

### Safety considerations (important given the medical-disclaimer-heavy posture of the app)
- Define a list of **non-adjustable safety elements** the AI must preserve regardless of the user's request (e.g. minimum rest days for injury-flagged users, supplement interactions, calorie floors) — bake this into the validation prompt as hard constraints, and have the AI *explain* if it declines part of a request rather than silently ignoring it.
- Log every adjustment request and its outcome (a `plan_adjustments` table: original plan snapshot, requested change, AI-produced result, accepted/declined) — this is valuable both for debugging/quality review and as an audit trail given the health-data sensitivity discussed in doc 01.

---

## 2. Quick-Read "Bytes" Content Section (Ticket #18)

### Recommended approach: a curated, tagged content library — not AI-generated-on-demand
Generating fresh educational content per-request via AI is expensive (token cost compounds across every user, every day) and carries quality/accuracy risk for health content specifically. A **pre-written, tagged content library** that gets *matched* to users is far more sustainable:

1. **Content model**: short articles/snippets ("bytes" — think 30-90 second reads), each tagged by topic (nutrition, sleep, strength training, recovery, mindset, supplements, etc.) and by relevance criteria (which `activity_modalities`, goals, or onboarding answers it's most relevant to).
2. **Matching, not generating**: at read-time, surface bytes whose tags intersect with the user's profile/plan/goals — reuse the same modality data that already personalizes onboarding and plan generation. A simple tag-intersection ranking is sufficient to start; no ML needed.
3. **Source the content economically**: an initial library can come from (a) genuinely original writing (slow but highest quality/lowest risk), (b) licensed/public-domain health-education sources with proper attribution, or (c) AI-*assisted* drafting with mandatory human review before publishing — never publish unreviewed AI health content directly to users. Treat this as a content operations question as much as an engineering one.
4. **For users without a plan/goals yet** (the ticket explicitly calls this out — "something for users who are signed up but not onboarded"): show a **general-interest starter set** (foundational, broadly-applicable topics — "Why consistency beats intensity," "The basics of a balanced plate," "Sleep's role in recovery") that doesn't require personalization data, with a gentle nudge that *"finishing your profile unlocks content tailored to you."* This usefully ties back into ticket #9's "purposeful empty states" approach.

### A lighter-weight phase 1
If a full content-authoring pipeline feels too heavy to start, an even simpler v1 is a **"Tip of the Day"** — a small rotating set of short, broadly-applicable tips shown on the dashboard (no dedicated content section yet), letting you validate engagement before investing in a full tagged library and matching system.

---

## 3. Plan-Generation Fallback & Weighted-Matching System (Ticket #19)

This is the most novel and highest-risk idea in the whole batch — worth treating as a research spike before any commitment to build.

### What's being proposed, restated plainly
1. Store a **de-identified** version of onboarding inputs + the resulting plan structure (no PII), to use as a fallback when AI generation fails or is unavailable, and potentially to serve *similar* future users a proven plan rather than generating fresh each time (saving AI cost and latency).
2. Build a **weighting/similarity system** — when a new user's profile closely matches a past profile, consider reusing (or lightly adapting) that past plan.

### Why this needs careful framing before any build commitment

**The safety risk is real and specific to this domain.** Two users who look similar on paper (age, weight, stated goals) can have meaningfully different needs — an old injury, a medication interaction, a dietary restriction not captured by the matching dimensions, a different baseline fitness level than the numbers suggest. A generic recommendation engine (think "users like you also liked...") is low-stakes when it's wrong; a fitness/health *plan* that's subtly wrong for someone's specific situation is not. This is the exact concern the ticket itself raises ("may be dangerous for another user") — and it's the right instinct.

**Recommended reframing: use the weighting system as an AI *input*, not an AI *replacement*.**
Rather than serving a past user's plan directly to a new user, use similarity-matching to **inform and accelerate** the AI generation:
- When a sufficiently similar past profile+plan exists, include it in the AI prompt as a *reference example* ("here's a plan that worked well for a similar profile — use it as a structural starting point, but tailor it specifically to this user's actual inputs"). This can reduce generation time/cost and improve consistency, *without* ever bypassing the per-user safety review the AI performs on the actual current inputs.
- This sidesteps the core danger (serving an unreviewed plan to a new person) while still capturing much of the proposed efficiency benefit.

**As a true fallback (AI unavailable/erroring)**, rather than serving a similar user's plan, consider a **rules-based starter plan** — a small set of conservative, broadly-safe template plans (e.g. "general fitness — beginner," "weight management — moderate activity," "strength-focused — intermediate") selected via simple, transparent rules from onboarding answers (BMI band, stated activity level, primary goal). These would be explicitly labeled as **temporary starter plans** ("We're generating your personalized plan — here's a general starting point in the meantime") and replaced automatically once AI generation succeeds. This gives users something useful immediately during outages without pretending a templated plan is personalized.

### The weighting system itself, if pursued (as a matching/research tool, not a serving mechanism)
- **Dimensions to weight**: demographics (age band, gender, BMI band), stated goals/modalities, activity level, timeline, and — critically — *exclude or heavily down-weight* anything safety-relevant from the matching itself (injuries, medications, health concerns) so that "similarity" never accidentally groups people who share a goal but not a safety profile. Those fields should instead act as **hard filters** ("never match across users with materially different injury/medication profiles") rather than weighted dimensions.
- **De-identification**: store the matching profile as a structured vector/JSON with no name, email, or other direct identifiers — strictly the dimensions above plus a reference to the (also de-identified) plan structure.
- **Start as an internal analytics/research tool**, not a user-facing feature — build the de-identified dataset and similarity scoring first, observe whether genuinely useful clusters emerge, and only then evaluate whether (and how) to expose any user-facing benefit (most likely as the "reference example for the AI" pattern above, given the risk profile).

### Suggested sequencing
Treat this entire ticket as **research + a narrow, safe pilot** (the AI-reference-example pattern + a rules-based outage fallback) rather than "build a recommendation engine." Revisit the more ambitious matching-and-serving idea only after the de-identified dataset exists and shows clear, safe value — and even then, keep a human/AI review step in the loop permanently.
