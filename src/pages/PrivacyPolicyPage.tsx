import { Info } from 'lucide-react';
import { LegalPageLayout } from '../components/layout/LegalPageLayout';

export function PrivacyPolicyPage() {
  return (
    <LegalPageLayout title="Privacy Policy">
      <div className="bg-blue-500/5 border border-blue-500/15 rounded-xl p-4 mb-2">
        <div className="flex items-start gap-3">
          <Info className="w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-blue-300/80 leading-relaxed">
            This is a draft policy provided for transparency during our beta. It has not yet been reviewed
            by a lawyer and may change as we finalize our launch. Last updated: June 2026.
          </p>
        </div>
      </div>

      <h2 className="text-base font-semibold text-white pt-2">What we collect</h2>
      <p>
        To build and personalize your plan, we collect account information (name, email), health profile
        details you provide during onboarding (age, weight, height, activity level, goals, health
        concerns, injuries, allergies, dietary preferences), and the activity you log over time (workout
        sets/reps/weight, meal notes, body measurements, mood, sleep, and habit completion).
      </p>

      <h2 className="text-base font-semibold text-white pt-2">How we use it</h2>
      <p>
        Your health profile is sent to Google's Gemini API to generate your personalized plan. Gemini acts
        as a sub-processor and does not use your data to train its models under Google's API terms. We use
        your logged activity to show your progress, streaks, and history within the app, and Sentry (an
        error-monitoring service) may receive technical error data to help us fix bugs — this does not
        include your health profile content.
      </p>

      <h2 className="text-base font-semibold text-white pt-2">Who we share it with</h2>
      <p>
        We do not sell your data or share it with advertisers. Data is processed by our infrastructure
        provider (Supabase) and, for plan generation, Google Gemini, as described above. We may disclose
        information if required by law.
      </p>

      <h2 className="text-base font-semibold text-white pt-2">How long we keep it</h2>
      <p>
        We retain your data for as long as your account is active. If you delete your account, your
        profile, health data, and logs are permanently removed from our systems.
      </p>

      <h2 className="text-base font-semibold text-white pt-2">Your rights</h2>
      <p>
        You can export a copy of all your data, or permanently delete your account and all associated
        data, at any time from your Profile page. If you have questions about your data, contact us — see
        the Contact page.
      </p>

      <h2 className="text-base font-semibold text-white pt-2">Changes to this policy</h2>
      <p>
        We may update this policy as FitPath evolves. We'll update the "last updated" date above when we
        do, and for material changes we'll let you know in-app.
      </p>
    </LegalPageLayout>
  );
}
