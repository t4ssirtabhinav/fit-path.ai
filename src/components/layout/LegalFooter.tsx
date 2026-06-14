import { Link } from 'react-router-dom';

export function LegalFooter() {
  return (
    <div className="flex items-center justify-center gap-3 text-xs text-gray-600">
      <Link to="/about" className="hover:text-gray-400 transition-colors">About</Link>
      <span className="text-gray-800">·</span>
      <Link to="/contact" className="hover:text-gray-400 transition-colors">Contact</Link>
      <span className="text-gray-800">·</span>
      <Link to="/privacy-policy" className="hover:text-gray-400 transition-colors">Privacy</Link>
      <span className="text-gray-800">·</span>
      <Link to="/terms" className="hover:text-gray-400 transition-colors">Terms</Link>
    </div>
  );
}
