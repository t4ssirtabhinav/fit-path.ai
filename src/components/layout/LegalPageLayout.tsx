import { Link } from 'react-router-dom';
import { ArrowLeft, Dumbbell } from 'lucide-react';
import { LegalFooter } from './LegalFooter';

export function LegalPageLayout({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-950 px-4 py-10">
      <div className="max-w-2xl mx-auto">
        <Link to="/" className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-300 transition-colors mb-8">
          <ArrowLeft className="w-4 h-4" />
          Back
        </Link>

        <div className="flex items-center gap-2.5 mb-6">
          <div className="w-9 h-9 bg-emerald-500/10 rounded-xl flex items-center justify-center">
            <Dumbbell className="w-4 h-4 text-emerald-400" />
          </div>
          <span className="font-bold text-white text-lg">FitPath</span>
        </div>

        <h1 className="text-2xl font-bold text-white mb-6">{title}</h1>

        <div className="text-sm text-gray-400 leading-relaxed space-y-4">
          {children}
        </div>

        <div className="mt-12 pt-6 border-t border-gray-800">
          <LegalFooter />
        </div>
      </div>
    </div>
  );
}
