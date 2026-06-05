import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { z } from "npm:zod@3";

const ALLOWED_ORIGINS = [
  "http://localhost:5173",
  "http://localhost:5174",
];

function isAllowedOrigin(origin: string): boolean {
  if (ALLOWED_ORIGINS.includes(origin)) return true;
  // Allow any bolt.new subdomain (production deploys)
  try {
    const url = new URL(origin);
    return url.hostname === "bolt.new" || url.hostname.endsWith(".bolt.new");
  } catch { return false; }
}

function corsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get("Origin") ?? "";
  const allowOrigin = isAllowedOrigin(origin) ? origin : "";
  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
    Vary: "Origin",
  };
}

function sanitizeUserInput(input: string, maxLen: number): string {
  let s = input.slice(0, maxLen);
  s = s.replace(/^(you\s+(are|must|should|will|shall|ignore|forget|disregard|act|pretend|roleplay|simulate)\b)/gmi, "[redacted]");
  s = s.replace(/(ignore\s+(previous|above|all)\s+instructions?)/gmi, "[redacted]");
  s = s.replace(/(system\s*:\s*)/gi, "[redacted]");
  return s;
}

// Zod schemas for validating AI response
const ExerciseSchema = z.object({
  name: z.string(),
  sets: z.number(),
  reps: z.string(),
  rest_seconds: z.number(),
  notes: z.string().optional(),
});

const WorkoutSchema = z.object({
  name: z.string(),
  duration_minutes: z.number(),
  exercises: z.array(ExerciseSchema).min(1),
  notes: z.string().optional(),
});

const DayScheduleSchema = z.object({
  is_rest_day: z.boolean(),
  workout: WorkoutSchema.optional(),
});

const MealSchema = z.object({
  title: z.string(),
  items: z.array(z.string()),
  protein_g: z.number(),
  calories: z.number(),
  notes: z.string().optional(),
});

const SupplementSchema = z.object({
  name: z.string(),
  dosage: z.string(),
  timing: z.string(),
  reason: z.string(),
  phase_start: z.number(),
  indian_brand: z.string().optional(),
  approx_cost_inr: z.string().optional(),
});

const HabitSchema = z.object({
  title: z.string(),
  description: z.string(),
  timing: z.string(),
  category: z.string(),
});

const SleepProtocolSchema = z.object({
  target_bedtime: z.string(),
  target_wake_time: z.string(),
  sleep_hours_target: z.number(),
  tips: z.array(z.string()),
});

const PlanDataSchema = z.object({
  phase: z.number(),
  phase_name: z.string(),
  phase_description: z.string(),
  duration_months: z.number(),
  personalized_notes: z.string(),
  calorie_target: z.number(),
  protein_target_g: z.number(),
  weekly_schedule: z.record(z.string(), DayScheduleSchema),
  daily_meals: z.object({
    breakfast: MealSchema,
    mid_morning_snack: MealSchema,
    lunch: MealSchema,
    evening_snack: MealSchema,
    dinner: MealSchema,
    pre_sleep: MealSchema.optional(),
  }),
  supplements: z.array(SupplementSchema),
  daily_habits: z.array(HabitSchema),
  sleep_protocol: SleepProtocolSchema,
});

function buildPrompt(hp: Record<string, unknown>): string {
  const goals = (hp.fitness_goals as string[]).join(", ");
  const concerns = (hp.health_concerns as string[]).join(", ");
  const injuries = (hp.injuries as string[]).join(", ") || "none";
  const foodPrefs = (hp.food_preferences as string[]).join(", ") || "general Indian";
  const rawComments = (hp.personalization_comments as string) || "";
  const personalizationComments = sanitizeUserInput(rawComments, 500);

  return `You are an expert Indian fitness coach and dietician. Create a Phase 1 (Month 1-3) personalised plan for:

Name: ${hp.display_name ?? "User"} | Age: ${hp.age} | Gender: ${hp.gender}
Weight: ${hp.weight_kg}kg | Height: ${hp.height_cm}cm | Body type: ${hp.body_type}
Activity: ${hp.activity_level} | Diet: ${hp.diet_type} | Gym days/week: ${hp.commitment_days_per_week}
Goals: ${goals}
Health concerns: ${concerns}
Injuries: ${injuries}
Food preferences: ${foodPrefs} | Dislikes: ${(hp.food_dislikes as string[]).join(", ") || "none"}
Sleep: ${hp.sleep_hours_current}h | Preferred workout time: ${hp.preferred_workout_time}
Timeline: ${hp.goal_timeline_months} months${personalizationComments ? `\nNotes: ${personalizationComments}` : ""}

Rules: Indian ingredients only (dal, roti, paneer, makhana, chaas etc). Indian supplement brands (AS-IT-IS, MuscleBlaze, Nutrabay, WOW). Strict diet type adherence. Gradual progression for sedentary users.

Return ONLY valid JSON, no markdown, matching this exact schema:
{
  "phase": 1, "phase_name": "Foundation", "phase_description": "2-3 sentences",
  "duration_months": 3, "personalized_notes": "3-4 sentences of specific advice",
  "calorie_target": number, "protein_target_g": number,
  "weekly_schedule": {
    "monday": { "is_rest_day": false, "workout": { "name": "string", "duration_minutes": number, "exercises": [{ "name": "string", "sets": number, "reps": "string", "rest_seconds": number }] } },
    "tuesday": { "is_rest_day": true },
    "wednesday": { "is_rest_day": false, "workout": { "name": "string", "duration_minutes": number, "exercises": [...] } },
    "thursday": { "is_rest_day": true },
    "friday": { "is_rest_day": false, "workout": { "name": "string", "duration_minutes": number, "exercises": [...] } },
    "saturday": { "is_rest_day": true },
    "sunday": { "is_rest_day": true }
  },
  "daily_meals": {
    "breakfast": { "title": "string", "items": ["string"], "protein_g": number, "calories": number },
    "mid_morning_snack": { "title": "string", "items": ["string"], "protein_g": number, "calories": number },
    "lunch": { "title": "string", "items": ["string"], "protein_g": number, "calories": number },
    "evening_snack": { "title": "string", "items": ["string"], "protein_g": number, "calories": number },
    "dinner": { "title": "string", "items": ["string"], "protein_g": number, "calories": number },
    "pre_sleep": { "title": "string", "items": ["string"], "protein_g": number, "calories": number }
  },
  "supplements": [{ "name": "string", "dosage": "string", "timing": "string", "reason": "string", "phase_start": 1, "indian_brand": "string", "approx_cost_inr": "string" }],
  "daily_habits": [{ "title": "string", "description": "string", "timing": "string", "category": "string" }],
  "sleep_protocol": { "target_bedtime": "string", "target_wake_time": "string", "sleep_hours_target": number, "tips": ["string"] }
}

Workout days must match commitment_days_per_week (${hp.commitment_days_per_week}). Include 3-5 supplements, 4-6 habits, 3-4 sleep tips.`;
}

Deno.serve(async (req: Request) => {
  const ch = corsHeaders(req);

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: ch });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...ch, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...ch, "Content-Type": "application/json" },
      });
    }

    // Check regeneration limit — applies regardless of isRegenerate flag
    const { data: existingPlan } = await supabase
      .from("plans")
      .select("last_regenerated_at, generated_at")
      .eq("user_id", user.id)
      .eq("is_active", true)
      .order("generated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const body = await req.json().catch(() => ({}));
    const isRegenerate = body.regenerate === true;

    // Rate limit: if an active plan exists, enforce 30-day cooldown
    if (existingPlan) {
      const lastDate = existingPlan.last_regenerated_at || existingPlan.generated_at;
      const daysSince = (Date.now() - new Date(lastDate).getTime()) / (1000 * 60 * 60 * 24);
      if (daysSince < 30) {
        return new Response(JSON.stringify({ error: `You can regenerate your plan again in ${Math.ceil(30 - daysSince)} days.` }), {
          status: 429, headers: { ...ch, "Content-Type": "application/json" },
        });
      }
    }

    // Fetch health profile
    const { data: hp, error: hpError } = await supabase
      .from("health_profiles")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();

    if (hpError || !hp) {
      return new Response(JSON.stringify({ error: "Health profile not found. Please complete all onboarding steps and try again." }), {
        status: 400, headers: { ...ch, "Content-Type": "application/json" },
      });
    }

    // Fetch display name
    const { data: profile } = await supabase
      .from("profiles")
      .select("display_name")
      .eq("id", user.id)
      .maybeSingle();

    const hpWithName = { ...hp, display_name: profile?.display_name ?? "User" };
    const prompt = buildPrompt(hpWithName);

    const geminiApiKey = Deno.env.get("GEMINI_API_KEY");
    if (!geminiApiKey) {
      return new Response(JSON.stringify({ error: "AI service is not configured. Please contact support." }), {
        status: 503, headers: { ...ch, "Content-Type": "application/json" },
      });
    }

    let planData: Record<string, unknown>;

    try {
      const geminiRes = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiApiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { temperature: 0.7, maxOutputTokens: 3000 },
          }),
          signal: AbortSignal.timeout(50000),
        }
      );
      const geminiData = await geminiRes.json();
      const rawText: string = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";

      // Strip markdown code fences if present, then extract JSON
      const stripped = rawText.replace(/```(?:json)?\s*/gi, "").replace(/```\s*$/gi, "");
      const jsonMatch = stripped.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error("No JSON object found in AI response");
      const parsed = JSON.parse(jsonMatch[0]);

      // Validate against Zod schema
      const validationResult = PlanDataSchema.safeParse(parsed);
      if (!validationResult.success) {
        const issues = validationResult.error.issues.map((i: { path: (string | number)[]; message: string }) => `${i.path.join(".")}: ${i.message}`).join("; ");
        console.error("Zod validation errors:", issues);
        throw new Error("AI returned an invalid plan. Please try again.");
      }
      planData = validationResult.data;
    } catch (aiErr) {
      console.error("Gemini AI error:", aiErr);
      const msg = aiErr instanceof Error ? aiErr.message : "AI generation failed";
      return new Response(JSON.stringify({ error: `Failed to generate plan: ${msg}. Please try again.` }), {
        status: 502, headers: { ...ch, "Content-Type": "application/json" },
      });
    }

    // Deactivate ALL existing plans first (prevents duplicate active plans)
    await supabase
      .from("plans")
      .update({ is_active: false })
      .eq("user_id", user.id)
      .eq("is_active", true);

    const validUntil = new Date();
    validUntil.setMonth(validUntil.getMonth() + 3);

    // Save new plan
    const { data: savedPlan, error: saveError } = await supabase
      .from("plans")
      .insert({
        user_id: user.id,
        phase: 1,
        is_active: true,
        plan_data: planData,
        valid_until: validUntil.toISOString(),
        last_regenerated_at: isRegenerate ? new Date().toISOString() : null,
      })
      .select()
      .single();

    if (saveError) throw saveError;

    // Seed today's daily tasks from the plan
    await seedTodaysTasks(supabase, user.id, savedPlan.id, planData);

    return new Response(JSON.stringify({ plan: savedPlan }), {
      headers: { ...ch, "Content-Type": "application/json" },
    });
  } catch (e: unknown) {
    console.error("generate-plan error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Internal server error" }), {
      status: 500, headers: { ...ch, "Content-Type": "application/json" },
    });
  }
});

async function seedTodaysTasks(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  planId: string,
  planData: Record<string, unknown>
) {
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
  const dayName = new Date().toLocaleDateString("en-US", { weekday: "long", timeZone: "Asia/Kolkata" }).toLowerCase();

  // Delete existing tasks for today
  await supabase.from("daily_tasks").delete().eq("user_id", userId).eq("task_date", today);

  const tasks: Array<{
    user_id: string;
    plan_id: string;
    task_date: string;
    category: string;
    title: string;
    description: string | null;
    order_index: number;
    is_rest_day: boolean;
  }> = [];
  let orderIdx = 0;

  const schedule = (planData.weekly_schedule as Record<string, { is_rest_day: boolean; workout?: { name: string; exercises: Array<{ name: string; sets: number; reps: string }> } }>)?.[dayName];

  if (schedule) {
    if (schedule.is_rest_day) {
      tasks.push({
        user_id: userId, plan_id: planId, task_date: today,
        category: "habit", title: "Rest & Recovery Day",
        description: "Light walk, stretching, or yoga. Let your muscles recover.",
        order_index: orderIdx++, is_rest_day: true,
      });
    } else if (schedule.workout) {
      tasks.push({
        user_id: userId, plan_id: planId, task_date: today,
        category: "workout", title: schedule.workout.name,
        description: schedule.workout.exercises.map((e: { name: string; sets: number; reps: string }) => `${e.name}: ${e.sets}x${e.reps}`).join(" • "),
        order_index: orderIdx++, is_rest_day: false,
      });
    }
  }

  const meals = planData.daily_meals as Record<string, { title: string; items: string[] }>;
  if (meals) {
    const mealOrder = ["breakfast", "mid_morning_snack", "lunch", "evening_snack", "dinner", "pre_sleep"];
    const mealLabels: Record<string, string> = {
      breakfast: "Breakfast",
      mid_morning_snack: "Mid-morning Snack",
      lunch: "Lunch",
      evening_snack: "Evening Snack",
      dinner: "Dinner",
      pre_sleep: "Pre-sleep",
    };
    for (const key of mealOrder) {
      if (meals[key]) {
        tasks.push({
          user_id: userId, plan_id: planId, task_date: today,
          category: "meal", title: `${mealLabels[key]}: ${meals[key].title}`,
          description: meals[key].items.slice(0, 3).join(", "),
          order_index: orderIdx++, is_rest_day: false,
        });
      }
    }
  }

  const supplements = planData.supplements as Array<{ name: string; dosage: string; timing: string; phase_start: number }>;
  if (supplements) {
    const phase1Supps = supplements.filter((s) => s.phase_start === 1).slice(0, 4);
    for (const s of phase1Supps) {
      tasks.push({
        user_id: userId, plan_id: planId, task_date: today,
        category: "supplement", title: s.name,
        description: `${s.dosage} — ${s.timing}`,
        order_index: orderIdx++, is_rest_day: false,
      });
    }
  }

  const habits = planData.daily_habits as Array<{ title: string; description: string; timing: string }>;
  if (habits) {
    for (const h of habits.slice(0, 5)) {
      tasks.push({
        user_id: userId, plan_id: planId, task_date: today,
        category: "habit", title: h.title,
        description: `${h.timing} — ${h.description}`,
        order_index: orderIdx++, is_rest_day: false,
      });
    }
  }

  const sleep = planData.sleep_protocol as { target_bedtime: string; target_wake_time: string };
  if (sleep) {
    tasks.push({
      user_id: userId, plan_id: planId, task_date: today,
      category: "sleep", title: `Sleep by ${sleep.target_bedtime}`,
      description: `Wake at ${sleep.target_wake_time}. Consistent sleep schedule is non-negotiable.`,
      order_index: orderIdx++, is_rest_day: false,
    });
  }

  if (tasks.length > 0) {
    await supabase.from("daily_tasks").insert(tasks);
  }
}
