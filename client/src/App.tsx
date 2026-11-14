import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MotionConfig } from 'framer-motion';
import { lazy, Suspense, type ReactNode } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { SocketProvider } from './context/SocketContext';
import { ToastProvider } from './components/ui/Toast';
import { ThemeProvider } from './context/ThemeContext';
import { AppShell } from './components/layout/AppShell';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { PageSkeleton } from './components/ui/Skeleton';
import { StyleguidePage } from './pages/StyleguidePage';
import { useAuthStore } from './store/authStore';
import type { UserRole } from './types/domain';

// Lazy-loaded heavy pages and dashboard routes
const LandingPage = lazy(() => import('./pages/LandingPage').then((m) => ({ default: m.LandingPage })));

const AdminDashboardPage = lazy(() => import('./pages/AdminDashboardPage').then((m) => ({ default: m.AdminDashboardPage })));
const SimulatorPage = lazy(() => import('./pages/SimulatorPage').then((m) => ({ default: m.SimulatorPage })));
const ProctorDashboardPage = lazy(() => import('./pages/ProctorDashboardPage').then((m) => ({ default: m.ProctorDashboardPage })));
const StudentDashboardPage = lazy(() => import('./pages/StudentDashboardPage').then((m) => ({ default: m.StudentDashboardPage })));
const StudentExamPage = lazy(() => import('./pages/StudentExamPage').then((m) => ({ default: m.StudentExamPage })));
const StudentResultPage = lazy(() => import('./pages/StudentResultPage').then((m) => ({ default: m.StudentResultPage })));
const NotFoundPage = lazy(() => import('./pages/NotFoundPage').then((m) => ({ default: m.NotFoundPage })));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 5000,
      refetchOnWindowFocus: false,
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
    return <Navigate to="/login" replace />;
  }
  if (!roles.includes(user.role)) {
    const fallback =
      user.role === 'ADMIN' ? '/admin' : user.role === 'PROCTOR' ? '/proctor' : '/student';
    return <Navigate to={fallback} replace />;
  }
  return <>{children}</>;
}

export function App() {
  return (
    <ThemeProvider defaultTheme="dark" storageKey="proctoriq-theme">
      <MotionConfig reducedMotion="user">
        <QueryClientProvider client={queryClient}>
          <SocketProvider>
            <ToastProvider>
              <BrowserRouter>
              <Suspense fallback={<PageSkeleton />}>
                <Routes>
                  {/* Public standalone pages without sidebar */}
                  <Route path="/" element={<LandingPage />} />
                  <Route path="/login" element={<LoginPage />} />
                  <Route path="/register" element={<RegisterPage />} />

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
                    {/* Styleguide available inside shell */}
                    <Route path="/styleguide" element={<StyleguidePage />} />

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
                  </Route>

                  <Route path="*" element={<NotFoundPage />} />
                </Routes>
              </Suspense>
            </BrowserRouter>
          </ToastProvider>
        </SocketProvider>
      </QueryClientProvider>
    </MotionConfig>
  </ThemeProvider>
  );
}

export default App;
