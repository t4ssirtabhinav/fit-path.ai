# Plan: Workout/Exercise Library Backed by AI-Generated Video Content

Covers ticket **#17** — "exercise tips - video generation using nano banana, google veo like a dummy skeleton explaining the workout, rate and cost limiting."

---

## 1. Reframing the ticket: two separable problems
This ticket bundles two genuinely different things that deserve separate evaluation:
1. **Having an exercise library at all** (text/image instructions, categorized by muscle group/equipment/difficulty) — a well-understood, low-risk content problem with mature off-the-shelf solutions.
2. **Generating original explainer videos with AI** (the "nano banana / Veo / dummy skeleton" idea) — a genuinely cutting-edge, expensive, and currently-immature approach that should be evaluated *against* the much cheaper alternative of using existing exercise-video datasets/APIs.

**Recommendation: solve #1 first with existing libraries, and treat #2 as an experimental enhancement layered on top later** — not a release-blocking dependency. This sequencing materially de-risks the ticket: FitPath ships a useful, complete exercise library quickly using mature tools, and the AI-video angle becomes a "nice differentiator to add later" rather than a "the whole feature is blocked on unproven AI tooling" situation.

---

## 2. The mature path: existing exercise-content sources
| Source | What it offers | Caveats |
|---|---|---|
| **ExerciseDB** | A large, ready-to-use exercise database (instructions, target muscles, equipment, GIFs/images) via a simple API | Rate-limited on free tiers — exactly the kind of "rate limiting" the ticket itself anticipates; budget for either a paid tier or caching responses into FitPath's own database rather than calling it live |
| **Wger** | **Open-source, self-hostable** exercise database and workout-manager backend | Self-hosting means full control and no rate limits, at the cost of running and maintaining another service — a reasonable tradeoff if the team is comfortable with light DevOps |
| **WorkoutX / YMove** (and similar smaller libraries) | Alternative ready-made datasets, varying in size/licensing terms | Check licensing carefully — some exercise-content datasets restrict commercial redistribution; this needs a quick legal/licensing check before adoption (ties to the business/legal doc in this folder, which covers IP/licensing risk for a newcomer) |

**Recommended approach**: pull from ExerciseDB or Wger **once**, normalize into FitPath's own `exercises` table (with images/short clips stored in Supabase Storage), and serve from there. This sidesteps live rate-limiting entirely, gives full control over presentation/branding, and means the content survives even if the upstream API changes terms or shuts down — a real risk with smaller third-party content APIs.

---

## 3. The AI-video idea: what "nano banana" and "Veo" actually are, and whether they fit
### What these tools are (as of the most recent research)
- **"Nano Banana"** is the popular nickname for **Gemini's native image-generation model** (the latest generation being referred to as Gemini 3.1 Flash Image in some contexts) — it generates and edits **still images**, not video.
- **Google Veo** is Google's dedicated **text-to-video / image-to-video generation model**, the actual tool that would be needed for "explainer videos."
- There are also reports of a unified **"Gemini Omni"** announced around Google I/O 2026, positioned as eventually subsuming/replacing standalone Veo — worth checking the current state of Google's generative-media product lineup before committing to a specific model name, as this space is moving and consolidating quickly.

### The "dummy skeleton explaining the workout" idea, evaluated honestly
This is a creative and genuinely appealing concept (a neutral, non-intimidating animated figure demonstrating form — removes the body-image anxiety that real-human workout videos can trigger for some users). But it runs into real practical friction with current-generation video-gen tools:
- **Anatomical consistency across a full movement is the hard part.** Today's video-generation models are good at short, visually impressive clips, but maintaining *consistent, anatomically-correct joint articulation* through a complete exercise repetition (e.g. a correct squat from top to bottom and back) is a much harder, more precise task than generating an evocative establishing shot — and a wrong-looking demonstration in a *fitness instruction* context isn't just an aesthetic miss, it's actively counterproductive (a user could learn bad form from a visually-plausible-but-anatomically-wrong AI demo).
- **Cost compounds at scale.** Video generation is priced per-second-of-output and is meaningfully more expensive than text or image generation — generating a unique explainer clip for every exercise (FitPath's plans likely reference dozens to hundreds of distinct exercises) and regenerating as the library grows is a real, recurring cost line, not a one-time expense. *(Exact current per-second Veo pricing should be checked directly against Google's published rates before budgeting — this space's pricing has moved significantly and will likely keep moving.)*
- **Rate limiting (which the ticket itself names as a concern) is a strong early signal** that the user already senses this is an expensive, constrained resource — a sign to validate cost/quality with a small pilot before building a whole content pipeline around it.

### Recommended path for the AI-video angle
1. **Pilot, don't commit.** Generate a small handful (5-10) of test clips for FitPath's most common exercises using current Veo/Gemini-Omni tooling, and have a few real users (and ideally someone with fitness-coaching judgment) assess: is the demonstrated form actually correct? Is it clear? Does it feel trustworthy, or uncanny?
2. **If the pilot looks good**: treat AI-generated clips as a **supplement to, not a replacement for**, the licensed/sourced library from §2 — e.g. AI clips for exercises the licensed library handles poorly, or for FitPath-specific combination movements that don't exist in standard datasets.
3. **If the pilot looks shaky** (likely, given the anatomical-consistency concern above): **fall back to the mature path entirely** — existing libraries already include real demonstration media, and the "dummy skeleton" framing could instead be approximated cheaply with **pre-built animated-skeleton assets or a lightweight 3D rig** (a one-time licensed asset or a simple in-house animation), sidestepping per-generation AI cost and per-rep anatomical-accuracy risk altogether while still delivering the "non-intimidating neutral demonstrator" feeling the ticket is really after.
4. **Build in cost/rate governance from day one if AI generation is used at all** — a generation queue with hard monthly budget caps, cached/reused outputs (never regenerate the same exercise twice), and a clear fallback to static content if limits are hit. This directly answers the ticket's own "rate and cost limiting" concern.

---

## 4. Suggested v1 scope
- A categorized exercise library (muscle group, equipment, difficulty) sourced from ExerciseDB or Wger, normalized into FitPath's schema, with short demonstration clips/images served from Supabase Storage.
- Deep-linked from the AI-generated plans — when a plan references "Romanian deadlifts," the user can tap through to the library entry for form guidance. This is the feature's actual value driver: *contextual* access to instruction at the moment of need, not a standalone library users browse cold.
- "Periodic exercise tips" (the ticket's other framing) — short rotating tips surfaced on the dashboard or as part of the "yesterday at a glance" / weekly summary cards (doc 03 of this folder) — a low-cost way to deliver the "tip library" feeling without needing video at all.
- AI-video generation deferred to a post-pilot decision, per §3.

---

## Sources
- General research synthesis on ExerciseDB, Wger, and exercise-content API/dataset licensing landscape.
- General research synthesis on Google Veo / Gemini "Nano Banana" (Gemini 3.1 Flash Image) / "Gemini Omni" positioning, capabilities, and the current state of AI video-generation cost and anatomical-consistency limitations as of mid-2026.

*Note: this is the single fastest-moving area covered in this entire research batch — Google's generative-media product names, capabilities, and per-second pricing have shifted multiple times in the last year and will likely shift again before this ticket is built. Re-verify model names, capabilities, and current pricing directly from Google's official AI/Cloud documentation immediately before running any pilot.*
