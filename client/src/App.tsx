import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MotionConfig } from 'framer-motion';
import { lazy, Suspense, type ReactNode } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { RealtimeProvider } from './context/RealtimeContext';
import { ToastProvider } from './components/ui/Toast';
import { ThemeProvider } from './context/ThemeContext';
import { AccentProvider } from './context/AccentContext';
import { AppShell } from './components/layout/AppShell';
import { PageSkeleton } from './components/ui/Skeleton';
import { useAuthStore } from './store/authStore';
import type { UserRole } from './types/domain';

// Lazy-loaded routes for code splitting
const LoginPage = lazy(() => import('./pages/LoginPage').then((m) => ({ default: m.LoginPage })));
const LandingPage = lazy(() => import('./pages/LandingPage').then((m) => ({ default: m.LandingPage })));
const ForgotPasswordPage = lazy(() => import('./pages/auth/ForgotPasswordPage').then((m) => ({ default: m.ForgotPasswordPage })));
const VerifyOtpPage = lazy(() => import('./pages/auth/VerifyOtpPage').then((m) => ({ default: m.VerifyOtpPage })));
const ResetPasswordPage = lazy(() => import('./pages/auth/ResetPasswordPage').then((m) => ({ default: m.ResetPasswordPage })));

// Lazy-loaded Styleguide documentation routes
const StyleguideLayout = lazy(() => import('./pages/styleguide/StyleguideLayout').then((m) => ({ default: m.StyleguideLayout })));
const StyleguideOverview = lazy(() => import('./pages/styleguide/StyleguideOverview').then((m) => ({ default: m.StyleguideOverview })));
const TokensSection = lazy(() => import('./pages/styleguide/sections/TokensSection').then((m) => ({ default: m.TokensSection })));
const IndicatorsSection = lazy(() => import('./pages/styleguide/sections/IndicatorsSection').then((m) => ({ default: m.IndicatorsSection })));
const BentoSection = lazy(() => import('./pages/styleguide/sections/BentoSection').then((m) => ({ default: m.BentoSection })));
const ButtonsSection = lazy(() => import('./pages/styleguide/sections/ButtonsSection').then((m) => ({ default: m.ButtonsSection })));
const BadgesSection = lazy(() => import('./pages/styleguide/sections/BadgesSection').then((m) => ({ default: m.BadgesSection })));
const StatCardsSection = lazy(() => import('./pages/styleguide/sections/StatCardsSection').then((m) => ({ default: m.StatCardsSection })));
const TrustRingSection = lazy(() => import('./pages/styleguide/sections/TrustRingSection').then((m) => ({ default: m.TrustRingSection })));
const TablesSection = lazy(() => import('./pages/styleguide/sections/TablesSection').then((m) => ({ default: m.TablesSection })));
const OverlaysSection = lazy(() => import('./pages/styleguide/sections/OverlaysSection').then((m) => ({ default: m.OverlaysSection })));
const ChartsSection = lazy(() => import('./pages/styleguide/sections/ChartsSection').then((m) => ({ default: m.ChartsSection })));
const LoadingEmptySection = lazy(() => import('./pages/styleguide/sections/LoadingEmptySection').then((m) => ({ default: m.LoadingEmptySection })));
const MotionSection = lazy(() => import('./pages/styleguide/sections/MotionSection').then((m) => ({ default: m.MotionSection })));

const AdminDashboardPage = lazy(() => import('./pages/AdminDashboardPage').then((m) => ({ default: m.AdminDashboardPage })));
const ExamDetailPage = lazy(() => import('./pages/admin/ExamDetailPage').then((m) => ({ default: m.ExamDetailPage })));
const SimulatorPage = lazy(() => import('./pages/SimulatorPage').then((m) => ({ default: m.SimulatorPage })));
const ProctorDashboardPage = lazy(() => import('./pages/ProctorDashboardPage').then((m) => ({ default: m.ProctorDashboardPage })));
const StudentDashboardPage = lazy(() => import('./pages/StudentDashboardPage').then((m) => ({ default: m.StudentDashboardPage })));
const StudentExamPage = lazy(() => import('./pages/StudentExamPage').then((m) => ({ default: m.StudentExamPage })));
const StudentResultPage = lazy(() => import('./pages/StudentResultPage').then((m) => ({ default: m.StudentResultPage })));
const RecordingPlayerPage = lazy(() => import('./pages/RecordingPlayerPage').then((m) => ({ default: m.RecordingPlayerPage })));
const StudentAuditListPage = lazy(() => import('./pages/StudentAuditListPage').then((m) => ({ default: m.StudentAuditListPage })));
const StudentProfilePage = lazy(() => import('./pages/StudentProfilePage').then((m) => ({ default: m.StudentProfilePage })));
const ExamScorecardPage = lazy(() => import('./pages/ExamScorecardPage').then((m) => ({ default: m.ExamScorecardPage })));
const NotFoundPage = lazy(() => import('./pages/NotFoundPage').then((m) => ({ default: m.NotFoundPage })));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (failureCount, error: unknown) => {
        const err = error as { status?: number };
        if (err?.status && err.status >= 400 && err.status < 500) return false;
        return failureCount < 1;
      },
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 2000),
      staleTime: 30000,
      refetchOnWindowFocus: false,
      refetchIntervalInBackground: false,
    },
    mutations: {
      retry: 0,
    },
  },
});

function RequireRole({
  roles,
  children,
}: {
  roles: UserRole[];
  children: ReactNode;
}) {
  const user = useAuthStore((s) => s.user);
  if (!user) {
    return <Navigate to="/" replace />;
  }
  if (!roles.includes(user.role)) {
    const fallback =
      user.role === 'ADMIN' ? '/admin' : user.role === 'PROCTOR' ? '/proctor' : '/student';
    return <Navigate to={fallback} replace />;
  }
  return <>{children}</>;
}

export function App() {
  const isTest = import.meta.env.MODE === 'test';
  return (
    <ThemeProvider defaultTheme="dark" storageKey="proctoriq-theme">
      <AccentProvider defaultAccent="indigo" storageKey="proctoriq-accent">
        <MotionConfig reducedMotion={isTest ? 'always' : 'user'}>
        <QueryClientProvider client={queryClient}>
          <RealtimeProvider>
            <ToastProvider>
              <BrowserRouter>
              <Suspense fallback={<PageSkeleton />}>
                <Routes>
                  {/* Public entry page & deep-link redirects */}
                  <Route path="/" element={<LoginPage />} />
                  <Route path="/login" element={<Navigate to="/?tab=signin" replace />} />
                  <Route path="/register" element={<Navigate to="/?tab=register" replace />} />
                  <Route path="/forgot-password" element={<ForgotPasswordPage />} />
                  <Route path="/verify-otp" element={<VerifyOtpPage />} />
                  <Route path="/reset-password" element={<ResetPasswordPage />} />

                  {/* Exam session room standalone for fullscreen distraction-free kiosk */}
                  <Route
                    path="/student/session/:sessionId"
                    element={
                      <RequireRole roles={['STUDENT']}>
                        <StudentExamPage />
                      </RequireRole>
                    }
                  />

                  {/* Mission Control Shell with Collapsible Sidebar, Top bar & Notifications */}
                  <Route element={<AppShell />}>
                    {/* Authenticated Home / Landing page */}
                    <Route
                      path="/home"
                      element={
                        <RequireRole roles={['ADMIN', 'PROCTOR', 'STUDENT']}>
                          <LandingPage />
                        </RequireRole>
                      }
                    />
                    {/* Styleguide multi-page documentation hierarchy */}
                    <Route path="/styleguide" element={<StyleguideLayout />}>
                      <Route index element={<StyleguideOverview />} />
                      <Route path="tokens" element={<TokensSection />} />
                      <Route path="indicators" element={<IndicatorsSection />} />
                      <Route path="bento" element={<BentoSection />} />
                      <Route path="buttons" element={<ButtonsSection />} />
                      <Route path="badges" element={<BadgesSection />} />
                      <Route path="stat-cards" element={<StatCardsSection />} />
                      <Route path="trust-ring" element={<TrustRingSection />} />
                      <Route path="tables" element={<TablesSection />} />
                      <Route path="overlays" element={<OverlaysSection />} />
                      <Route path="charts" element={<ChartsSection />} />
                      <Route path="loading-empty" element={<LoadingEmptySection />} />
                      <Route path="loading-empty-states" element={<LoadingEmptySection />} />
                      <Route path="motion" element={<MotionSection />} />
                    </Route>

                    {/* Student routes */}
                    <Route
                      path="/student"
                      element={
                        <RequireRole roles={['STUDENT']}>
                          <StudentDashboardPage />
                        </RequireRole>
                      }
                    />
                    <Route
                      path="/student/results/:sessionId"
                      element={
                        <RequireRole roles={['STUDENT', 'PROCTOR', 'ADMIN']}>
                          <StudentResultPage />
                        </RequireRole>
                      }
                    />

                    {/* Proctor routes */}
                    <Route
                      path="/proctor"
                      element={
                        <RequireRole roles={['PROCTOR', 'ADMIN']}>
                          <ProctorDashboardPage />
                        </RequireRole>
                      }
                    />
                    <Route
                      path="/proctor/audit"
                      element={
                        <RequireRole roles={['PROCTOR', 'ADMIN']}>
                          <ProctorDashboardPage initialTab="audit" />
                        </RequireRole>
                      }
                    />

                    {/* Student Audit Routes (Proctor) */}
                    <Route
                      path="/proctor/students"
                      element={
                        <RequireRole roles={['PROCTOR', 'ADMIN']}>
                          <StudentAuditListPage />
                        </RequireRole>
                      }
                    />
                    <Route
                      path="/proctor/students/:id"
                      element={
                        <RequireRole roles={['PROCTOR', 'ADMIN']}>
                          <StudentProfilePage />
                        </RequireRole>
                      }
                    />
                    <Route
                      path="/proctor/students/:id/exams/:sessionId"
                      element={
                        <RequireRole roles={['PROCTOR', 'ADMIN']}>
                          <ExamScorecardPage />
                        </RequireRole>
                      }
                    />

                    {/* Recording Review Player Route (Proctor & Admin only) */}
                    <Route
                      path="/recordings/:recordingId"
                      element={
                        <RequireRole roles={['PROCTOR', 'ADMIN']}>
                          <RecordingPlayerPage />
                        </RequireRole>
                      }
                    />

                    {/* Admin routes */}
                    <Route
                      path="/admin"
                      element={
                        <RequireRole roles={['ADMIN']}>
                          <AdminDashboardPage />
                        </RequireRole>
                      }
                    />
                    <Route
                      path="/admin/exams"
                      element={
                        <RequireRole roles={['ADMIN']}>
                          <AdminDashboardPage initialTab="exams" />
                        </RequireRole>
                      }
                    />
                    <Route
                      path="/admin/exams/:id"
                      element={
                        <RequireRole roles={['ADMIN']}>
                          <ExamDetailPage />
                        </RequireRole>
                      }
                    />
                    <Route
                      path="/admin/analytics"
                      element={
                        <RequireRole roles={['ADMIN']}>
                          <AdminDashboardPage initialTab="analytics" />
                        </RequireRole>
                      }
                    />
                    <Route
                      path="/admin/simulator"
                      element={
                        <RequireRole roles={['ADMIN']}>
                          <SimulatorPage />
                        </RequireRole>
                      }
                    />

                    {/* Student Audit Routes (Admin) */}
                    <Route
                      path="/admin/students"
                      element={
                        <RequireRole roles={['ADMIN']}>
                          <StudentAuditListPage />
                        </RequireRole>
                      }
                    />
                    <Route
                      path="/admin/students/:id"
                      element={
                        <RequireRole roles={['ADMIN']}>
                          <StudentProfilePage />
                        </RequireRole>
                      }
                    />
                    <Route
                      path="/admin/students/:id/exams/:sessionId"
                      element={
                        <RequireRole roles={['ADMIN']}>
                          <ExamScorecardPage />
                        </RequireRole>
                      }
                    />
                  </Route>

                  <Route path="*" element={<NotFoundPage />} />
                </Routes>
              </Suspense>
            </BrowserRouter>
          </ToastProvider>
        </RealtimeProvider>
      </QueryClientProvider>
    </MotionConfig>
      </AccentProvider>
  </ThemeProvider>
  );
}

export default App;
