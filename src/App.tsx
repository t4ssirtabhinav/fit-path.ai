import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ErrorBoundary } from './components/ErrorBoundary';
import { AppLayout } from './components/layout/AppLayout';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { ForgotPasswordPage } from './pages/ForgotPasswordPage';
import { ResetPasswordPage } from './pages/ResetPasswordPage';
import { AboutPage } from './pages/AboutPage';
import { ContactPage } from './pages/ContactPage';
import { PrivacyPolicyPage } from './pages/PrivacyPolicyPage';
import { TermsPage } from './pages/TermsPage';
import { OnboardingPage } from './pages/OnboardingPage';
import { GeneratePlanPage } from './pages/GeneratePlanPage';
import { DashboardPage } from './pages/DashboardPage';
import { PlanPage } from './pages/PlanPage';
import { ProgressPage } from './pages/ProgressPage';
import { BuddyPage } from './pages/BuddyPage';
import { ProfilePage } from './pages/ProfilePage';
import { JoinBuddyPage } from './pages/JoinBuddyPage';

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function RequireOnboarding({ children }: { children: React.ReactNode }) {
  const { profile, loading } = useAuth();
  if (loading) return null;
  if (profile && !profile.onboarding_complete) return <Navigate to="/onboarding" replace />;
  return <>{children}</>;
}

function AppRoutes() {
  const { user, profile } = useAuth();

  return (
    <Routes>
      {/* Public */}
      <Route path="/login" element={user ? <Navigate to="/dashboard" replace /> : <LoginPage />} />
      <Route path="/register" element={user ? <Navigate to="/dashboard" replace /> : <RegisterPage />} />
      <Route path="/forgot-password" element={user ? <Navigate to="/dashboard" replace /> : <ForgotPasswordPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />
      <Route path="/join/:code" element={<JoinBuddyPage />} />

      {/* Legal & info — accessible whether logged in or not */}
      <Route path="/about" element={<AboutPage />} />
      <Route path="/contact" element={<ContactPage />} />
      <Route path="/privacy-policy" element={<PrivacyPolicyPage />} />
      <Route path="/terms" element={<TermsPage />} />

      {/* Onboarding — always accessible when authenticated (plan generation sets onboarding_complete) */}
      <Route path="/onboarding" element={
        <RequireAuth>
          <OnboardingPage />
        </RequireAuth>
      } />

      {/* Generate plan */}
      <Route path="/generate-plan" element={
        <RequireAuth>
          <GeneratePlanPage />
        </RequireAuth>
      } />

      {/* Protected app routes */}
      <Route path="/dashboard" element={
        <RequireAuth>
          <RequireOnboarding>
            <AppLayout><DashboardPage /></AppLayout>
          </RequireOnboarding>
        </RequireAuth>
      } />
      <Route path="/plan" element={
        <RequireAuth>
          <RequireOnboarding>
            <AppLayout><PlanPage /></AppLayout>
          </RequireOnboarding>
        </RequireAuth>
      } />
      <Route path="/progress" element={
        <RequireAuth>
          <RequireOnboarding>
            <AppLayout><ProgressPage /></AppLayout>
          </RequireOnboarding>
        </RequireAuth>
      } />
      <Route path="/buddy" element={
        <RequireAuth>
          <RequireOnboarding>
            <AppLayout><BuddyPage /></AppLayout>
          </RequireOnboarding>
        </RequireAuth>
      } />
      <Route path="/profile" element={
        <RequireAuth>
          <AppLayout><ProfilePage /></AppLayout>
        </RequireAuth>
      } />

      {/* Root redirect — track users go straight to dashboard after onboarding_complete */}
      <Route path="/" element={
        user
          ? profile?.onboarding_complete
            ? <Navigate to="/dashboard" replace />
            : <Navigate to="/onboarding" replace />
          : <Navigate to="/login" replace />
      } />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <ErrorBoundary>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </ErrorBoundary>
    </BrowserRouter>
  );
}
