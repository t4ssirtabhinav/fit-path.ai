# AI Fallback Strategy for `generate-plan` — Handling Gemini 503s

## Problem statement
`generate-plan` (currently using `gemini-3-flash-preview`) occasionally returns Gemini API errors — most visibly `503` (`UNAVAILABLE`, transient overload) but also `429`/`RESOURCE_EXHAUSTED` (quota). The edge function already surfaces these as user-friendly errors (`"Our AI service is temporarily at capacity..."` / `"AI service is temporarily unavailable..."`), but the user is left with a failed plan generation and has to retry manually.

The request: evaluate **Perplexity AI as a fallback provider** so a Gemini outage doesn't block plan generation, with the constraint that **nothing in the app should break** — same response shape, same `plans` table row, same downstream task-seeding.

---

## Step 0 — the cheapest fix, worth doing regardless of any fallback decision
**A `503 UNAVAILABLE` from Gemini is very often transient** — it resolves within seconds on a retry. Today, `generate-plan` makes **one** call and immediately surfaces an error to the user on any non-OK response. Before adding a second AI vendor (with its own cost, key management, and behavioral quirks), add **1-2 retries with short backoff specifically for `503`/`UNAVAILABLE`** (not for `429`/quota — retrying a quota error just wastes time, since it won't resolve in seconds).

```ts
async function callGeminiWithRetry(prompt: string, apiKey: string, maxAttempts = 2) {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const res = await fetch(/* ...existing call... */);
    const data = await res.json();
    const status = data?.error?.status;
    if (res.ok && !data.error) return { res, data };
    if (status === "UNAVAILABLE" && attempt < maxAttempts) {
      await new Promise(r => setTimeout(r, 1000 * attempt)); // 1s, then 2s
      continue;
    }
    return { res, data }; // give up — let existing error handling or fallback take over
  }
}
```
This alone likely resolves a meaningful share of the 503s the user is seeing, at zero added cost and zero new vendor risk. **Treat the Perplexity fallback below as the answer to "what if it's still down after retries / quota is genuinely exhausted"**, not as the first line of defense.

---

## Vetting Perplexity as the fallback provider

### What Perplexity actually is, and the one architectural mismatch to be aware of
Perplexity's **Sonar** models are *search-augmented* by default — every request triggers a live web search, and the response includes citations grounded in retrieved web content. This is Perplexity's core differentiator (and why people use it over a plain LLM API), but **`generate-plan`'s prompt doesn't need or want web search** — it's a closed-form "given this user profile, generate a structured fitness plan" task. Web-search augmentation here is pure overhead: extra latency (retrieval step), extra cost (per-request retrieval fees on top of token costs), and a small risk of the model's output being influenced by retrieved web snippets in ways that don't match the existing prompt's tone/structure (e.g., citation-style phrasing leaking into `personalized_notes`).

**This doesn't disqualify Perplexity** — it just means: (a) explicitly instruct the model not to include citations/links in the output (the existing prompt's "Return ONLY a raw JSON object" instruction already pushes in this direction, and Zod validation will reject anything that breaks the schema), and (b) budget for the per-request retrieval fee as a real cost line, not just token cost.

### Model & pricing comparison (per the latest available pricing)

| | **Gemini 3 Flash Preview** (current) | **Perplexity Sonar** | **Perplexity Sonar Pro** |
|---|---|---|---|
| Input tokens | $0.50 / 1M | $1.00 / 1M | $3.00 / 1M |
| Output tokens | $3.00 / 1M | $1.00 / 1M | $15.00 / 1M |
| Per-request retrieval fee | none | $5-12 per 1,000 requests (context-dependent) | $6-14 per 1,000 requests |
| JSON schema / structured output | Yes (`responseMimeType: application/json`) | Yes (`response_format: json_schema`) | Yes |
| Web search / citations | No | Yes (always-on, the core feature) | Yes |

([Perplexity Sonar pricing overview](https://www.cloudzero.com/blog/perplexity-api-pricing/), [Gemini API pricing](https://ai.google.dev/gemini-api/docs/pricing))

### Rough per-generation cost estimate
A typical `generate-plan` call: prompt (~1,500-2,500 tokens depending on selected modalities) + response (up to 8,192 tokens, often less in practice).

- **Gemini 3 Flash Preview** (current): ~$0.50/1M × 2K in + $3.00/1M × ~5K out ≈ **$0.016 per generation**.
- **Sonar** (base): ~$1/1M × 2K in + $1/1M × 5K out + retrieval fee (~$0.005-0.012 per request at the 1K-request rate) ≈ **$0.01-0.02 per generation** — actually competitive with Gemini on token cost, but the retrieval fee is a new line item that didn't exist before.
- **Sonar Pro**: ~$3/1M × 2K + $15/1M × 5K + retrieval fee ≈ **$0.08-0.09 per generation** — roughly **5x** Gemini's cost. Only justify this if base Sonar's output quality proves insufficient in testing.

**Recommendation**: if you proceed with Perplexity, start with **base `sonar`**, not `sonar-pro` — it's cost-comparable to Gemini per-generation (modulo the retrieval fee), and `generate-plan`'s task (structured JSON from a well-specified prompt) doesn't obviously need Sonar Pro's extra reasoning depth. Reserve `sonar-pro` as a possible *second* fallback tier only if `sonar`'s output quality (schema-compliance rate, plan coherence) proves meaningfully worse in practice.

### Perplexity Pro subscription angle
The user mentioned the **Perplexity Pro plan ($20/month)**, which includes **$5/month of Sonar API credits**. At ~$0.01-0.02 per generation with base Sonar, that's roughly **250-500 fallback generations/month covered by the included credits** — likely more than sufficient for *fallback* usage (which should be a small fraction of total generations, especially after the Step 0 retry fix reduces transient failures). Beyond the included credits, it's pay-as-you-go API billing — **the Pro subscription itself isn't required for API access** (API billing is separate/usage-based regardless), but if the $20/month Pro subscription is also useful to the founder personally (Perplexity's consumer search product), the $5/month credit is a nice incidental offset. Don't pay for Pro *purely* for the API credit if it's not otherwise wanted — at fallback-only volumes, raw pay-as-you-go API cost will likely be a couple of dollars a month at most. ([Perplexity pricing 2026](https://www.finout.io/blog/perplexity-pricing-in-2026))

---

## Implementation plan — keeping the response shape identical

### 1. New secret
Add `PERPLEXITY_API_KEY` to the Supabase Edge Function secrets (prod, and any preview branch used to test this — see the companion branching doc, §7).

### 2. Fallback trigger conditions
Fall back to Perplexity when, **after the Step 0 retries**:
- Gemini returns `429`/`RESOURCE_EXHAUSTED` (quota exhausted — retries won't help), **or**
- Gemini returns `503`/`UNAVAILABLE` after exhausting retries, **or**
- Gemini returns a non-2xx for any other reason (`5xx` family generally).

**Do not** fall back on Gemini `SAFETY` blocks or Zod-validation failures of *Gemini's* output — those are content/quality issues that Perplexity would likely also hit (same prompt, same ambiguity), and silently routing "the AI refused for safety reasons" to a second AI obscures a signal you'd want to know about (e.g., a user's profile data triggering safety filters unexpectedly).

### 3. Shared call abstraction
Refactor the Gemini call into a function `callAIProvider(provider: "gemini" | "perplexity", prompt: string, schema: ZodSchema)` that:
- Builds the provider-specific request (Gemini's `generateContent` body vs. Perplexity's OpenAI-compatible `/chat/completions` body with `response_format: { type: "json_schema", json_schema: { schema: <PlanDataSchema as JSON Schema> } }`).
- Returns a normalized `{ rawText, finishReason }` regardless of provider.
- The **existing** JSON-extraction, parsing, normalization (lowercase day names), and **Zod validation** logic stays exactly as-is and runs on the output of *either* provider — this is what guarantees "nothing breaks downstream": `seedTodaysTasks` and the `plans` table insert never know or care which provider produced `planData`, because both must pass the same `PlanDataSchema.safeParse`.

### 4. Perplexity-specific prompt addendum
Append a short instruction when calling Perplexity (not needed for Gemini): *"Do not perform web searches or include citations, links, or source references in your response — return only the raw JSON object as specified."* This mitigates the search-augmentation mismatch noted above. If Perplexity's API supports disabling search/retrieval entirely for Sonar (worth checking current docs at implementation time — this may have changed), prefer that over prompt-instruction alone.

### 5. Generating a JSON Schema from the existing Zod schema
`PlanDataSchema` is already defined with Zod — use a library like `zod-to-json-schema` (small, no new infra) to derive the JSON Schema once at module load time, rather than hand-maintaining a parallel schema definition that could drift from the Zod one.

### 6. Logging the provider used
Since the response shape to the client stays identical, add a **server-side-only** log line (`console.log("generate-plan: provider=" + provider)`) — this feeds Supabase's edge function logs (`get_logs`) so you can monitor fallback frequency without exposing it to users. If the prior roadmap's Sentry integration (`docs/planning/06-platform-error-logging-and-emails.md`) is in place by the time this ships, tag the event there instead/also — fallback frequency is exactly the kind of signal that should page-or-notify if it spikes (could indicate Gemini is down for an extended period).

---

## UX recommendation: silent fallback, no user-facing indicator
Per the "nothing should break" requirement and the fact that the Zod-validated output shape is identical regardless of provider:
- **Don't show "generated with backup AI" messaging.** It raises questions ("is this plan worse?") for a difference that, if Sonar's output quality is comparable (which should be verified in testing — see below), is invisible and irrelevant to the user.
- **Do** keep the *existing* error messages as the final fallback if **both** providers fail — at that point the existing `"AI service is temporarily unavailable..."` (502) response is correct and appropriately honest.
- **Optional, low-priority**: if you want a tiny bit of transparency without alarming users, the existing `personalized_notes` field could occasionally vary in tone between providers — if testing shows Sonar's writing style is noticeably different, consider a light prompt-level instruction to match Gemini's tone/voice for consistency, rather than exposing "which AI wrote this" to the user at all.

---

## Before relying on this in production: a short validation pass
Run a handful of real `generate-plan` prompts (varied modality combinations — gym+diet, yoga+supplements+holistic, etc.) through `sonar` directly (e.g., via `curl` or Perplexity's playground) with the JSON schema attached, and check:
1. **Schema-compliance rate** — does it reliably pass `PlanDataSchema.safeParse` on the first try, or does it need retries/repairs more often than Gemini?
2. **Content quality** — are meal suggestions still appropriately localized (the prompt's country/cuisine instructions), are workout structures sensible, does `personalized_notes` read naturally?
3. **No citation/search leakage** — confirm the "no citations" instruction (§4 above) actually works in practice; Sonar's search-grounding habit is strong and may need a firmer prompt instruction or a post-processing strip of any `[1]`-style citation markers as a defensive measure.

If `sonar` performs poorly on (1) or (2) after a reasonable prompt-tuning attempt, the fallback's value proposition weakens — at that point, an alternative worth a quick mention: **a second Gemini model as the "fallback"** (e.g., falling back from `gemini-3-flash-preview` to `gemini-2.5-flash`, the model this function used previously per the recent commit history) avoids the cross-provider prompt-compatibility question entirely, at the cost of not being protected against a Gemini-wide outage. This isn't mutually exclusive with Perplexity — a **two-tier fallback** (Gemini 3 Flash → Gemini 2.5 Flash → Perplexity Sonar) is a reasonable design if you want maximum resilience, though it does add complexity for what should be a rare code path.

---

## Summary recommendation
1. **Ship the retry-on-503 fix first** (Step 0) — cheap, likely resolves a good share of the reported issue on its own.
2. **Add Perplexity `sonar` as a true last-resort fallback** (quota exhaustion or persistent 5xx after retries) — cost-comparable to Gemini per-generation, supports JSON schema, and the existing Zod validation is the safety net that keeps the response contract identical.
3. **Keep the fallback silent to users**; log provider choice server-side for monitoring.
4. **Validate Sonar's output quality with real prompts before depending on it** — if it underperforms, a same-vendor model fallback (Gemini 2.5 Flash) is a simpler fallback-of-last-resort that sidesteps cross-provider prompt differences entirely.

---

## Sources
- [Perplexity API Pricing In 2026: Models, Costs, And Optimization Tips (CloudZero)](https://www.cloudzero.com/blog/perplexity-api-pricing/)
- [Perplexity Pricing in 2026 for Individuals, Orgs & Developers (Finout)](https://www.finout.io/blog/perplexity-pricing-in-2026)
- [Perplexity Sonar — Structured Outputs / JSON Schema docs](https://docs.perplexity.ai/docs/sonar/features)
- [Gemini Developer API pricing](https://ai.google.dev/gemini-api/docs/pricing)

*Note: AI provider pricing and feature availability (especially around disabling Sonar's web-search/retrieval step) move quickly — re-verify directly against current Perplexity API docs immediately before implementation.*
