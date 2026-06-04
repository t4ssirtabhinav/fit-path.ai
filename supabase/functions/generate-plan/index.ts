import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");

function buildPrompt(hp: Record<string, unknown>): string {
  const goals = (hp.fitness_goals as string[]).join(", ");
  const concerns = (hp.health_concerns as string[]).join(", ");
  const injuries = (hp.injuries as string[]).join(", ") || "none";
  const foodPrefs = (hp.food_preferences as string[]).join(", ") || "general Indian";

  return `You are an expert fitness coach, dietician, and nutritionist specialising in Indian context.

Create a detailed Phase 1 (Month 1-3) personalised fitness and nutrition plan for:
- Name: ${hp.display_name ?? "User"}
- Age: ${hp.age}, Gender: ${hp.gender}
- Weight: ${hp.weight_kg}kg, Height: ${hp.height_cm}cm
- Body type: ${hp.body_type}
- Activity level: ${hp.activity_level}
- Diet type: ${hp.diet_type}
- Goals: ${goals}
- Health concerns: ${concerns}
- Injuries/limitations: ${injuries}
- Sleep currently: ${hp.sleep_hours_current} hours
- Gym days per week: ${hp.commitment_days_per_week}
- Preferred workout time: ${hp.preferred_workout_time}
- Food preferences: ${foodPrefs}
- Food dislikes: ${(hp.food_dislikes as string[]).join(", ") || "none"}
- Timeline goal: ${hp.goal_timeline_months} months

IMPORTANT CONTEXT:
- User is India-based. All food suggestions must use Indian ingredients (dal, roti, chaas, paneer, makhana, etc.)
- Supplement brands should be India-available (AS-IT-IS, Nakpro, MuscleBlaze, Nutrabay, WOW, The Whole Truth)
- Diet must account for their diet type strictly
- For sedentary users returning to gym, start gradually at RPE 5-7, focus on form and consistency
- Include progressive overload principles
- Address specific health concerns with targeted nutrition

Return ONLY a valid JSON object with this exact structure (no markdown, no explanation, just JSON):
{
  "phase": 1,
  "phase_name": "Foundation",
  "phase_description": "string (2-3 sentences describing phase focus)",
  "duration_months": 3,
  "personalized_notes": "string (3-4 sentences of personalized advice based on their specific profile)",
  "calorie_target": number,
  "protein_target_g": number,
  "weekly_schedule": {
    "monday": { "is_rest_day": false, "workout": { "name": "string", "duration_minutes": number, "exercises": [{ "name": "string", "sets": number, "reps": "string", "rest_seconds": number, "notes": "string optional" }], "notes": "string optional" } },
    "tuesday": { "is_rest_day": true },
    "wednesday": { "is_rest_day": false, "workout": { ... same structure } },
    "thursday": { "is_rest_day": true },
    "friday": { "is_rest_day": false, "workout": { ... same structure } },
    "saturday": { "is_rest_day": false, "workout": { "name": "string", "duration_minutes": number, "exercises": [...], "notes": "string optional" } },
    "sunday": { "is_rest_day": true }
  },
  "daily_meals": {
    "breakfast": { "title": "string", "items": ["string"], "protein_g": number, "calories": number, "notes": "string optional" },
    "mid_morning_snack": { "title": "string", "items": ["string"], "protein_g": number, "calories": number },
    "lunch": { "title": "string", "items": ["string"], "protein_g": number, "calories": number, "notes": "string optional" },
    "evening_snack": { "title": "string", "items": ["string"], "protein_g": number, "calories": number },
    "dinner": { "title": "string", "items": ["string"], "protein_g": number, "calories": number, "notes": "string optional" },
    "pre_sleep": { "title": "string", "items": ["string"], "protein_g": number, "calories": number }
  },
  "supplements": [
    { "name": "string", "dosage": "string", "timing": "string", "reason": "string", "phase_start": 1, "indian_brand": "string optional", "approx_cost_inr": "string optional" }
  ],
  "daily_habits": [
    { "title": "string", "description": "string", "timing": "string", "category": "string" }
  ],
  "sleep_protocol": {
    "target_bedtime": "10:30 PM",
    "target_wake_time": "6:30 AM",
    "sleep_hours_target": number,
    "tips": ["string"]
  }
}

Be specific, practical, and India-context appropriate. Weekly schedule should match the commitment_days_per_week (${hp.commitment_days_per_week} gym days). Include at least 5 supplements (phase in gradually), 6-8 daily habits, 5-6 sleep tips.`;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
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
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check regeneration limit (once per 30 days)
    const { data: existingPlan } = await supabase
      .from("plans")
      .select("last_regenerated_at, generated_at")
      .eq("user_id", user.id)
      .eq("is_active", true)
      .maybeSingle();

    const body = await req.json().catch(() => ({}));
    const isRegenerate = body.regenerate === true;

    if (isRegenerate && existingPlan?.last_regenerated_at) {
      const lastRegen = new Date(existingPlan.last_regenerated_at);
      const daysSince = (Date.now() - lastRegen.getTime()) / (1000 * 60 * 60 * 24);
      if (daysSince < 30) {
        return new Response(JSON.stringify({ error: `You can regenerate your plan again in ${Math.ceil(30 - daysSince)} days.` }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
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
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
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

    let planData: Record<string, unknown>;

    if (GEMINI_API_KEY) {
      try {
        const geminiRes = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              contents: [{ parts: [{ text: prompt }] }],
              generationConfig: { temperature: 0.7, maxOutputTokens: 4096 },
            }),
          }
        );
        const geminiData = await geminiRes.json();
        const rawText: string = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";

        // Strip markdown code fences if present, then extract JSON
        const stripped = rawText.replace(/```(?:json)?\s*/gi, "").replace(/```\s*$/gi, "");
        const jsonMatch = stripped.match(/\{[\s\S]*\}/);
        if (!jsonMatch) throw new Error("No JSON object found in AI response");
        planData = JSON.parse(jsonMatch[0]);
      } catch (aiErr) {
        console.warn("Gemini failed, using fallback plan:", aiErr);
        planData = generateFallbackPlan(hpWithName);
      }
    } else {
      // No AI key configured — use fallback plan
      planData = generateFallbackPlan(hpWithName);
    }

    // Deactivate ALL existing plans first (prevents duplicate active plans)
    await supabase
      .from("plans")
      .update({ is_active: false })
      .eq("user_id", user.id)
      .eq("is_active", true);

    const validUntil = new Date();
    validUntil.setMonth(validUntil.getMonth() + 3);
    const today = new Date().toISOString().split("T")[0];

    // Delete today's tasks before inserting fresh ones
    await supabase.from("daily_tasks").delete().eq("user_id", user.id).eq("task_date", today);

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
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: unknown) {
    console.error("generate-plan error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Internal server error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

async function seedTodaysTasks(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  planId: string,
  planData: Record<string, unknown>
) {
  const today = new Date().toISOString().split("T")[0];
  const dayName = new Date().toLocaleDateString("en-US", { weekday: "long" }).toLowerCase();

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

function generateFallbackPlan(hp: Record<string, unknown>): Record<string, unknown> {
  const isVeg = String(hp.diet_type).startsWith("veg");
  const daysPerWeek = Number(hp.commitment_days_per_week) || 3;
  const weight = Number(hp.weight_kg) || 70;
  const proteinTarget = Math.round(weight * 1.4);
  const calorieTarget = Math.round(weight * 30);

  const workoutDays = daysPerWeek >= 4
    ? ["monday", "tuesday", "thursday", "friday"]
    : ["monday", "wednesday", "friday"];

  const schedule: Record<string, unknown> = {};
  const days = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];
  const workoutNames = ["Push Day (Chest, Shoulders, Triceps)", "Pull Day (Back, Biceps)", "Leg Day (Quads, Hamstrings, Glutes)", "Full Body Strength"];

  let wIdx = 0;
  for (const day of days) {
    if (workoutDays.includes(day)) {
      schedule[day] = {
        is_rest_day: false,
        workout: {
          name: workoutNames[wIdx % workoutNames.length],
          duration_minutes: 45,
          exercises: [
            { name: "Warm-up (treadmill / brisk walk)", sets: 1, reps: "10 min", rest_seconds: 0 },
            { name: "Compound movement A", sets: 3, reps: "10-12", rest_seconds: 90 },
            { name: "Compound movement B", sets: 3, reps: "10-12", rest_seconds: 90 },
            { name: "Isolation exercise", sets: 3, reps: "12-15", rest_seconds: 60 },
            { name: "Core: Plank", sets: 3, reps: "30-45 sec hold", rest_seconds: 45 },
          ],
          notes: "Focus on form over weight. RPE should be 5-7. Rest 60-90 seconds between sets.",
        },
      };
      wIdx++;
    } else {
      schedule[day] = { is_rest_day: true };
    }
  }

  return {
    phase: 1,
    phase_name: "Foundation",
    phase_description: "The first 3 months focus entirely on building sustainable habits, correcting movement patterns, and establishing a nutritional baseline. Progress > perfection.",
    duration_months: 3,
    personalized_notes: `As someone returning from a sedentary period, your body needs time to readapt. Start lighter than you think you need to — your tendons and ligaments adapt slower than your muscles. The first month is about consistency, not intensity. Target ${proteinTarget}g protein daily and ${calorieTarget} calories.`,
    calorie_target: calorieTarget,
    protein_target_g: proteinTarget,
    weekly_schedule: schedule,
    daily_meals: {
      breakfast: {
        title: "Protein-rich Indian breakfast",
        items: [
          isVeg ? "Moong dal chilla (2 medium) with mint chutney" : "2 eggs (boiled or scrambled) + 1 moong dal chilla",
          "1 cup black coffee or green tea (no sugar)",
          "5 soaked almonds + 2 walnuts"
        ],
        protein_g: isVeg ? 18 : 24,
        calories: isVeg ? 320 : 380,
        notes: "Eat within 60 min of waking. Skip the paratha for now.",
      },
      mid_morning_snack: {
        title: "Protein snack",
        items: ["Roasted chana 30g", "1 seasonal fruit (guava, apple, or papaya)"],
        protein_g: 8,
        calories: 180,
      },
      lunch: {
        title: "Balanced Indian lunch",
        items: [
          "2 phulkas (wheat)",
          "1 bowl dal (any)",
          "1 bowl sabzi (seasonal vegetable)",
          "1 small bowl curd/chaas",
          isVeg ? "30g paneer in sabzi" : "1 egg bhurji as side"
        ],
        protein_g: isVeg ? 22 : 28,
        calories: isVeg ? 520 : 570,
        notes: "Curd is non-negotiable — probiotics improve nutrient absorption.",
      },
      evening_snack: {
        title: "Pre-workout / evening fuel",
        items: ["Makhana 20g (dry roasted)", "1 banana", "Black coffee (if pre-workout)"],
        protein_g: 4,
        calories: 200,
      },
      dinner: {
        title: "Light protein dinner",
        items: [
          "1 phulka",
          "1 bowl sabzi",
          "1 bowl rajma / chana / dal",
          isVeg ? "50g paneer grilled/tikka style" : "Small chicken tikka (grilled only)"
        ],
        protein_g: isVeg ? 24 : 32,
        calories: isVeg ? 450 : 490,
        notes: "Keep dinner light. Finish eating by 8pm.",
      },
      pre_sleep: {
        title: "Sleep support drink",
        items: ["1 glass warm turmeric milk (with curd base if lactose issue) or just warm water", "Magnesium glycinate supplement"],
        protein_g: 4,
        calories: 80,
      },
    },
    supplements: [
      { name: "Whey Protein / Pea Protein", dosage: "1 scoop (25-30g)", timing: "Post-workout or with breakfast", reason: "Hit daily protein target", phase_start: 1, indian_brand: "AS-IT-IS Whey Isolate or Nutrabay Pea Protein", approx_cost_inr: "₹55-65/serving" },
      { name: "Vitamin D3 + K2", dosage: "2000 IU D3 + 45mcg K2", timing: "With largest meal", reason: "Most Indians are D3 deficient. Critical for immunity, bone density, and mood", phase_start: 1, indian_brand: "HealthVit or Himalayan Organics", approx_cost_inr: "₹400-600/month" },
      { name: "Vitamin B12 (Methylcobalamin)", dosage: "500-1000 mcg", timing: "Morning with breakfast", reason: "Vegetarians commonly deficient. Required for energy, nerve function, and mood", phase_start: 1, indian_brand: "Neurobion or Himalayan Organics B12", approx_cost_inr: "₹200-400/month" },
      { name: "Magnesium Glycinate", dosage: "300-400 mg", timing: "30 min before sleep", reason: "Improves sleep quality, reduces muscle cramps, and supports stress management", phase_start: 1, indian_brand: "Now Foods Magnesium Glycinate (available on Amazon India)", approx_cost_inr: "₹700-1000/month" },
      { name: "Omega-3 Fish Oil / Algae Oil", dosage: "1g EPA + DHA", timing: "With any meal", reason: "Anti-inflammatory, supports joint health, brain function, and fat loss", phase_start: 2, indian_brand: "WOW Omega-3 or Carbamide Forte", approx_cost_inr: "₹500-800/month" },
      { name: "Ashwagandha KSM-66", dosage: "300 mg", timing: "With dinner", reason: "Reduces cortisol, improves sleep quality, supports testosterone and recovery", phase_start: 2, indian_brand: "Himalaya Ashvagandha or Nutrabay KSM-66", approx_cost_inr: "₹400-700/month" },
    ],
    daily_habits: [
      { title: "Morning sunlight", description: "Get 10-15 min of direct sunlight within 30 min of waking. No sunglasses. Critical for circadian rhythm and Vitamin D.", timing: "Within 30 min of waking", category: "sleep" },
      { title: "Lemon water (empty stomach)", description: "1 glass of warm water + juice of half a lemon. Kickstarts digestion and alkalizes the body.", timing: "First thing in the morning", category: "nutrition" },
      { title: "10,000 steps goal", description: "Use a basic step counter. Walk during calls. Take stairs. Every 1000 steps counts.", timing: "Throughout the day", category: "movement" },
      { title: "No screens 60 min before bed", description: "Phone and laptop off or in another room. Read a physical book or stretch instead. This single habit will transform your sleep.", timing: "60 min before target bedtime", category: "sleep" },
      { title: "Protein at every meal", description: "Before eating anything, ask: where is my protein in this meal? Add a source if missing. Dal, curd, eggs, paneer, or a handful of chana.", timing: "At every meal", category: "nutrition" },
      { title: "2.5-3L water daily", description: "Set hourly reminders. Dehydration is the most underrated cause of fatigue and poor workouts.", timing: "Throughout the day", category: "hydration" },
      { title: "Gratitude + plan review (2 min)", description: "Write 1 thing you're grateful for and review tomorrow's plan. Takes 2 min. Compounds over months.", timing: "Before sleep", category: "mindset" },
      { title: "Post-workout protein within 30 min", description: "Protein shake or eggs or paneer within 30 min of finishing your workout. This is the muscle repair window.", timing: "Immediately post-workout", category: "nutrition" },
    ],
    sleep_protocol: {
      target_bedtime: "10:30 PM",
      target_wake_time: "6:30 AM",
      sleep_hours_target: 8,
      tips: [
        "Fix your wake time FIRST — same time every day including weekends. Your body clock sets from wake time, not bedtime.",
        "Magnesium glycinate 30 min before bed — reduces time to fall asleep and improves deep sleep quality.",
        "Keep your bedroom cool (18-22°C) and completely dark. A sleep mask costs ₹150 and doubles sleep quality.",
        "No caffeine after 2pm — caffeine has a 6-hour half-life, so a 3pm coffee still has 50% caffeine in your system at 9pm.",
        "If you wake at 3-4am regularly, it often signals low blood sugar. A small casein-rich pre-sleep snack (curd or paneer) can fix this.",
        "Morning sunlight is MORE important than blackout curtains — it sets your cortisol rhythm for the entire day.",
      ],
    },
  };
}
