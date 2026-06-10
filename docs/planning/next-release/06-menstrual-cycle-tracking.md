# Research & Plan: Menstrual Cycle Tracking

Covers ticket **#18** — "Research on Flo app", a comprehensive suite for female users: workout-regime adjustment by cycle phase, manual logging, next-period prediction, tips, etc.

---

## 1. What Flo does well (and why it's the category leader)
Flo is the most-downloaded women's health app globally, and its core strengths are instructive:
- **Prediction quality improves with use** — the app's cycle/ovulation/period predictions get measurably more accurate the longer a user logs, which creates a strong retention loop (the longer you stay, the more useful it gets — a model worth borrowing conceptually).
- **"Secret Chats" / community features** — anonymous peer-support spaces around specific topics (trying to conceive, postpartum, etc.) — a recognizable echo of FitPath's own buddy-system instinct, but built around shared *life-stage* context rather than 1:1 accountability.
- **Breadth of life-stage coverage** — cycle tracking, pregnancy mode, postpartum, perimenopause — Flo has expanded well beyond "period tracker" into a full reproductive-health-lifecycle product.

## 2. Flo's well-documented privacy controversies — the most important research finding for FitPath
This is the single most load-bearing finding in this doc, and directly shapes how FitPath should approach this feature:
- Flo faced a **2021 FTC settlement** over sharing sensitive health data (including pregnancy-related information) with third-party analytics/marketing platforms (Facebook, Google) **without adequately disclosing this to users** — a textbook case of "the privacy policy technically mentioned data sharing, but not in a way users could reasonably understand applied to *this* data."
- This was followed by **private class-action lawsuits** repeating similar claims.
- In direct response, Flo introduced an **"Anonymous Mode"** that strips personally-identifiable information from cycle data — a feature that only exists *because* of the trust damage from the original incidents, and is now held up industry-wide as the standard a serious reproductive-health feature should meet.

**The lesson for FitPath is unambiguous and immediately actionable**: menstrual/reproductive health data is **categorically more sensitive** than general fitness/vitals data — both in how users perceive it and in actual legal exposure (this is exactly the kind of data that, in a post-*Dobbs* US context and under emerging data-protection regimes generally, can carry real personal risk for users if it leaks or is subpoenaed). If FitPath builds this feature, it should **launch with privacy protections that meet or exceed Flo's *current* (post-controversy) standard from day one** — not retrofit them after a trust crisis. Concretely: no third-party analytics on cycle-related fields, an anonymous/de-identified mode considered from the initial data-model design (not bolted on later), and explicit, specific consent language separate from FitPath's general privacy policy (which the prior roadmap's compliance doc, `docs/planning/01-pre-login-trust-and-legal.md`, should be extended to cover once this feature is scoped).

## 3. The sports-science question: should workouts actually adjust by cycle phase?
This is the area where the research found the most nuance — and where FitPath should be careful not to overpromise:
- **Current exercise-science evidence on cycle-phase-based training adjustment is genuinely mixed**, and several recent reviews/expert commentaries explicitly caution that **it may be premature to conclude that normal hormonal fluctuations across the menstrual cycle meaningfully affect exercise performance or that training should be systematically restructured around cycle phase** for the general population of active women.
- This doesn't mean the *feature* is a bad idea — it means the **framing matters enormously**. FitPath should avoid presenting cycle-based workout adjustment as if it were settled, prescriptive science ("you must train this way during your luteal phase"), and instead frame it as:
  - **User-reported, personalized signal-following** — "many users report feeling lower-energy during [phase] — would you like lighter sessions suggested during this window, based on *your own* logged energy/symptom patterns?" This shifts the feature from "the app is making a clinical claim" to "the app is helping you notice and respond to *your own* patterns" — a meaningfully lower-risk and arguably more genuinely useful framing.
  - **Optional and adjustable**, never a silent automatic override of the user's plan — the user should always see *why* a suggestion is being made and be able to dismiss it.

## 4. Recommended feature scope for FitPath (a deliberately phased, conservative approach)

### Phase 1 — Core tracking (the foundation, and arguably sufficient as a v1)
- Manual cycle/period logging (start/end dates, flow intensity, common symptoms — cramps, mood, energy level).
- **Next-period prediction** using a straightforward rolling-average algorithm based on the user's own logged history (this is standard, well-understood math — not a research risk; Flo's prediction-improves-with-use loop is exactly this mechanism at scale).
- Basic educational tips tied to cycle phase, written carefully to avoid the overpromising problem in §3 — frame as general education ("here's what's commonly reported during this phase"), not personalized clinical guidance.

### Phase 2 — Integration with the AI plan (the part that makes this *FitPath's* version, not a Flo clone)
- **Optional, user-controlled** linkage between logged cycle data and the AI plan-generation/adjustment system — e.g. surfacing a gentle, dismissible suggestion ("Want lighter sessions suggested around your typically lower-energy days, based on what you've logged so far?") rather than silently rewriting the plan.
- This connects naturally to the **auto plan-adjustment** work already designed in this folder's doc 03 (ticket #10) — cycle-phase awareness could become one *input signal* among several (alongside completion rates and measurement trends) that the proactive phase-adjustment system considers, rather than a separate bolted-on system.

### Phase 3 — Community/support layer (longest-term, most optional)
- A space for shared experience tied to this life context — but **only** if FitPath's existing buddy/community infrastructure (prior roadmap, doc 04) has matured enough to support topic-specific spaces safely and with proper moderation. Not a v1 concern.

## 5. Open questions worth resolving before scoping this for real
- **Is this in-scope for FitPath's current audience and brand positioning at all?** This is a substantial, sensitive feature investment — worth validating demand with existing users (a quick survey, or instrumenting interest via the product-analytics work in doc 04 of this folder) before committing engineering time, rather than assuming it from the ticket alone.
- **Data-residency and legal-jurisdiction questions** — where is this data stored, and what jurisdictions' health-privacy and reproductive-health-specific laws apply to FitPath's actual user base? This may need a focused legal consultation beyond the general compliance research in the prior roadmap (a question to fold into the business/legal research in this folder's doc 07).

---

## Sources
- General research synthesis on Flo app features, the 2021 FTC settlement and subsequent class-action litigation regarding third-party data sharing, and the "Anonymous Mode" introduced in response.
- General research synthesis on current exercise-science literature regarding menstrual-cycle-phase effects on training performance, including expert commentary urging caution against premature prescriptive conclusions.

*Note: this entire topic sits at the intersection of health data sensitivity, contested science, and (in some jurisdictions) genuine legal risk to end users — of everything in this 18-ticket batch, this is the one area where a brief consultation with someone with relevant legal/compliance expertise (beyond general web research) is most warranted before committing to a specific design.*
