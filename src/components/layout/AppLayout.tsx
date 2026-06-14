import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Dumbbell, TrendingUp, Users, User, Dumbbell as Logo } from 'lucide-react';
import { cn } from '../../lib/utils';

const NAV_ITEMS = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Today' },
  { to: '/plan', icon: Dumbbell, label: 'My Plan' },
  { to: '/progress', icon: TrendingUp, label: 'Progress' },
  { to: '/buddy', icon: Users, label: 'Buddy' },
  { to: '/profile', icon: User, label: 'Profile' },
];

export function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-950 flex">
      {/* Sidebar — desktop */}
      <aside className="hidden lg:flex flex-col w-56 border-r border-gray-800 bg-gray-950 fixed inset-y-0 left-0 z-30">
        <div className="flex items-center gap-2.5 px-5 py-5 border-b border-gray-800">
          <div className="w-8 h-8 bg-emerald-500/10 rounded-xl flex items-center justify-center">
            <Logo className="w-4 h-4 text-emerald-400" />
          </div>
          <span className="font-bold text-white text-lg">FitPath</span>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-1">
          {NAV_ITEMS.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) => cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200',
                isActive
                  ? 'bg-emerald-500/10 text-emerald-400'
                  : 'text-gray-400 hover:text-white hover:bg-gray-800'
              )}
            >
              <Icon className="w-4 h-4 flex-shrink-0" />
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="px-3 py-4 border-t border-gray-800">
          <p className="text-xs text-gray-600 px-3 leading-relaxed">Not medical advice. Consult a doctor.</p>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 lg:ml-56 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-4 pt-6">
          {children}
        </div>
      </main>

      {/* Bottom nav — mobile */}
      <nav className="lg:hidden fixed bottom-0 inset-x-0 bg-gray-950 border-t border-gray-800 z-30">
        <div className="flex items-center justify-around px-2 py-2 safe-area-bottom">
          {NAV_ITEMS.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) => cn(
                'flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl transition-all duration-200 min-w-0',
                isActive ? 'text-emerald-400' : 'text-gray-500'
              )}
            >
              <Icon className="w-5 h-5" />
              <span className="text-xs font-medium">{label}</span>
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
}
