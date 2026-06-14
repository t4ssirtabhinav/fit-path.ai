import { LegalPageLayout } from '../components/layout/LegalPageLayout';

export function AboutPage() {
  return (
    <LegalPageLayout title="About FitPath">
      <p>
        FitPath is a personalized fitness and nutrition companion. Tell us about your goals, schedule,
        equipment, and any health considerations, and we build a plan around your life — not a generic
        template — covering workouts, meals, supplements, habits, and sleep.
      </p>
      <p>
        Every day, FitPath gives you a simple checklist of what to do, and a place to log what you actually
        did — sets, reps, weight, meals, mood, measurements, and more — so you can see your progress build
        up over time.
      </p>
      <h2 className="text-base font-semibold text-white pt-2">Our approach</h2>
      <p>
        We think of FitPath as a structure-and-motivation tool, not a substitute for professional medical
        or fitness advice. We use AI to help tailor plans to your specific situation, but the result is a
        starting point — adjust it as you learn what works for your body, and always check with a qualified
        healthcare provider before starting a new exercise or nutrition programme, especially if you have
        an existing health condition.
      </p>
      <h2 className="text-base font-semibold text-white pt-2">A work in progress</h2>
      <p>
        FitPath is currently in beta. We're a small team building this because we wanted something that
        adapts to real life rather than forcing everyone into the same routine. We'd love to hear what's
        working and what isn't — see the Contact page to get in touch.
      </p>
    </LegalPageLayout>
  );
}
