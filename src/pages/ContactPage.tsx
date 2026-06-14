import { Mail, AlertTriangle } from 'lucide-react';
import { LegalPageLayout } from '../components/layout/LegalPageLayout';

export function ContactPage() {
  return (
    <LegalPageLayout title="Contact Us">
      <p>
        Questions, feedback, or issues with your account? We'd love to hear from you.
      </p>

      <a
        href="mailto:support@fitpath.ai"
        className="inline-flex items-center gap-2 text-emerald-400 hover:text-emerald-300 font-medium transition-colors"
      >
        <Mail className="w-4 h-4" />
        support@fitpath.ai
      </a>

      <p>
        We aim to respond to support emails within 1-2 business days.
      </p>

      <div className="bg-amber-500/5 border border-amber-500/15 rounded-xl p-4 mt-4">
        <div className="flex items-start gap-3">
          <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-amber-300/80 leading-relaxed">
            FitPath is not a medical service and this contact channel is not monitored for emergencies.
            If you are experiencing a medical emergency, contact your local emergency services
            immediately.
          </p>
        </div>
      </div>
    </LegalPageLayout>
  );
}
