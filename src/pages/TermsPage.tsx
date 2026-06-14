import { Info } from 'lucide-react';
import { LegalPageLayout } from '../components/layout/LegalPageLayout';

export function TermsPage() {
  return (
    <LegalPageLayout title="Terms & Conditions">
      <div className="bg-blue-500/5 border border-blue-500/15 rounded-xl p-4 mb-2">
        <div className="flex items-start gap-3">
          <Info className="w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-blue-300/80 leading-relaxed">
            This is a draft provided for transparency during our beta. It has not yet been reviewed by a
            lawyer and may change as we finalize our launch. Last updated: June 2026.
          </p>
        </div>
      </div>

      <h2 className="text-base font-semibold text-white pt-2">Using FitPath</h2>
      <p>
        By creating an account, you agree to use FitPath for personal, non-commercial purposes, to provide
        accurate information about yourself, and to keep your account credentials secure. You must be at
        least 18 years old (or the age of majority in your jurisdiction) to use FitPath.
      </p>

      <h2 className="text-base font-semibold text-white pt-2">Not medical advice</h2>
      <p>
        FitPath provides general fitness and nutrition guidance only, including content generated with the
        help of AI. This is <strong className="text-gray-300">not medical advice</strong>, and FitPath is
        not a substitute for consultation with a qualified healthcare professional. Always consult a doctor
        before starting any new diet, supplement, or exercise programme, especially if you have an existing
        health condition, injury, or are pregnant.
      </p>

      <h2 className="text-base font-semibold text-white pt-2">AI-generated content</h2>
      <p>
        Plans, suggestions, and guidance may be generated using AI based on the information you provide. AI
        output can be inaccurate or unsuitable for your specific circumstances — use your judgment, and
        stop any activity that causes pain or discomfort.
      </p>

      <h2 className="text-base font-semibold text-white pt-2">Limitation of liability</h2>
      <p>
        FitPath is provided "as is" without warranties of any kind. To the maximum extent permitted by law,
        FitPath and its team are not liable for any injury, loss, or damage arising from your use of the
        app or reliance on its content.
      </p>

      <h2 className="text-base font-semibold text-white pt-2">Your account</h2>
      <p>
        You may stop using FitPath and delete your account at any time from your Profile page. We may
        suspend or terminate accounts that violate these terms or misuse the service.
      </p>

      <h2 className="text-base font-semibold text-white pt-2">Changes to these terms</h2>
      <p>
        We may update these terms as FitPath evolves. We'll update the "last updated" date above when we
        do, and for material changes we'll let you know in-app.
      </p>

      <h2 className="text-base font-semibold text-white pt-2">Contact</h2>
      <p>
        Questions about these terms? See the Contact page.
      </p>
    </LegalPageLayout>
  );
}
