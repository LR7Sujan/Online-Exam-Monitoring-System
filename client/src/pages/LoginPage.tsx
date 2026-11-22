import { useState, useEffect, type FormEvent } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  AlertCircle,
  KeyRound,
  Eye,
  EyeOff,
  User,
  ShieldCheck,
  ShieldAlert,
  GraduationCap,
  ArrowRight,
  ChevronDown,
  Lock,
  UserPlus,
  CheckCircle,
} from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { AuthLayout } from '../components/layout/AuthLayout';
import { FloatingInput } from '../components/ui/FloatingInput';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { api } from '../lib/api';
import { useAuthStore } from '../store/authStore';
import type { AuthUser, UserRole } from '../types/domain';

interface AuthResponse {
  token: string;
  user: AuthUser;
}

type RoleTab = 'ADMIN' | 'PROCTOR' | 'STUDENT';
type AuthTab = 'signin' | 'register';

const ROLE_DEMOS: Record<RoleTab, { label: string; email: string; role: UserRole; icon: typeof ShieldCheck; desc: string }> = {
  ADMIN: {
    label: 'Admin',
    email: 'admin@proctoriq.io',
    role: 'ADMIN',
    icon: ShieldAlert,
    desc: 'Institution & DB Command',
  },
  PROCTOR: {
    label: 'Proctor',
    email: 'proctor@proctoriq.io',
    role: 'PROCTOR',
    icon: ShieldCheck,
    desc: 'Live Telemetry & Surveillance',
  },
  STUDENT: {
    label: 'Student',
    email: 'student@proctoriq.io',
    role: 'STUDENT',
    icon: GraduationCap,
    desc: 'Candidate Exam Kiosk',
  },
};

function getPasswordStrength(pwd: string): { score: number; label: string; color: string } {
  if (!pwd) return { score: 0, label: '', color: 'bg-border' };
  if (pwd.length < 8) return { score: 1, label: 'Weak (min 8 chars)', color: 'bg-rose-500' };

  let score = 1;
  if (/[A-Z]/.test(pwd) && /[a-z]/.test(pwd)) score++;
  if (/\d/.test(pwd)) score++;
  if (/[^A-Za-z0-9]/.test(pwd)) score++;

  if (score === 2) return { score: 2, label: 'Fair', color: 'bg-amber-500' };
  if (score === 3) return { score: 3, label: 'Good', color: 'bg-blue-500' };
  return { score: 4, label: 'Strong', color: 'bg-emerald-500' };
}

export function LoginPage({ initialTab }: { initialTab?: AuthTab }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const queryTab = searchParams.get('tab') === 'register' ? 'register' : 'signin';
  const [activeTab, setActiveTab] = useState<AuthTab>(initialTab ?? queryTab);

  useDocumentTitle(activeTab === 'signin' ? 'Sign In | ProctorIQ' : 'Create Account | ProctorIQ');
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const setAuth = useAuthStore((s) => s.setAuth);

  // If already logged in, redirect to /home per Phase 14 specifications
  useEffect(() => {
    if (user) {
      navigate('/home', { replace: true });
    }
  }, [user, navigate]);

  // Synchronize query param if updated from external navigation
  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
    } else if (searchParams.get('tab') === 'register') {
      setActiveTab('register');
    } else if (searchParams.get('tab') === 'signin') {
      setActiveTab('signin');
    }
  }, [searchParams, initialTab]);

  const handleTabSwitch = (tab: AuthTab) => {
    setActiveTab(tab);
    setSearchParams(tab === 'register' ? { tab: 'register' } : {}, { replace: true });
    setGeneralError(null);
  };

  // --- SIGN IN STATE ---
  const [activeRole, setActiveRole] = useState<RoleTab>('ADMIN');
  const [email, setEmail] = useState('admin@proctoriq.io');
  const [password, setPassword] = useState('ProctorIQ#2026');
  const [rememberMe, setRememberMe] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [isDemoOpen, setIsDemoOpen] = useState(true);

  // --- REGISTER STATE ---
  const [fullName, setFullName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // --- VALIDATION & ERROR STATES ---
  const [emailError, setEmailError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [fullNameError, setFullNameError] = useState<string | null>(null);
  const [regEmailError, setRegEmailError] = useState<string | null>(null);
  const [regPasswordError, setRegPasswordError] = useState<string | null>(null);
  const [confirmPasswordError, setConfirmPasswordError] = useState<string | null>(null);
  const [termsError, setTermsError] = useState<string | null>(null);
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const strength = getPasswordStrength(regPassword);

  // Validate Sign In
  const validateSignIn = () => {
    let valid = true;
    setEmailError(null);
    setPasswordError(null);

    if (!email.trim()) {
      setEmailError('Email address is required.');
      valid = false;
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setEmailError('Please enter a valid email address.');
      valid = false;
    }

    if (!password) {
      setPasswordError('Password is required.');
      valid = false;
    }

    return valid;
  };

  // Validate Registration
  const validateRegister = () => {
    let valid = true;
    setFullNameError(null);
    setRegEmailError(null);
    setRegPasswordError(null);
    setConfirmPasswordError(null);
    setTermsError(null);

    if (!fullName.trim() || fullName.trim().length < 2) {
      setFullNameError('Full name must be at least 2 characters.');
      valid = false;
    }

    if (!regEmail.trim()) {
      setRegEmailError('Email address is required.');
      valid = false;
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(regEmail)) {
      setRegEmailError('Please enter a valid institutional email.');
      valid = false;
    }

    if (!regPassword) {
      setRegPasswordError('Password is required.');
      valid = false;
    } else if (regPassword.length < 8) {
      setRegPasswordError('Password must be at least 8 characters long.');
      valid = false;
    }

    if (!confirmPassword) {
      setConfirmPasswordError('Please confirm your password.');
      valid = false;
    } else if (regPassword !== confirmPassword) {
      setConfirmPasswordError('Passwords do not match.');
      valid = false;
    }

    if (!agreedToTerms) {
      setTermsError('You must agree to the academic integrity terms.');
      valid = false;
    }

    return valid;
  };

  const handleSignInSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setGeneralError(null);

    if (!validateSignIn()) return;

    setLoading(true);
    try {
      const data = await api.post<AuthResponse>('/auth/login', {
        email,
        password,
      });
      setAuth(data.token, data.user);
      navigate('/home');
    } catch (err) {
      setGeneralError(err instanceof Error ? err.message : 'Authentication failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleRegisterSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setGeneralError(null);

    if (!validateRegister()) return;

    setLoading(true);
    try {
      const data = await api.post<AuthResponse>('/auth/register', {
        fullName: fullName.trim(),
        email: regEmail.trim(),
        password: regPassword,
      });
      setAuth(data.token, data.user);
      navigate('/home');
    } catch (err) {
      setGeneralError(err instanceof Error ? err.message : 'Registration failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleRoleTabClick = (role: RoleTab) => {
    setActiveRole(role);
    setEmail(ROLE_DEMOS[role].email);
    setPassword('ProctorIQ#2026');
    setEmailError(null);
    setPasswordError(null);
    setGeneralError(null);
  };

  return (
    <AuthLayout>
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="rounded-3xl border border-border/80 dark:border-white/10 bg-surface/85 backdrop-blur-2xl p-5 sm:p-6 shadow-layered-lg shadow-black/20 dark:shadow-black/40 space-y-3.5 relative overflow-hidden"
      >
        {/* Top ambient highlight line */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-indigo-500 via-violet-500 to-fuchsia-500" />

        {/* Unified Segmented Switch: Sign in | Create account */}
        <div className="grid grid-cols-2 gap-1 p-1 rounded-xl bg-surface-elevated border border-border">
          <button
            type="button"
            onClick={() => handleTabSwitch('signin')}
            className={`relative py-1.5 px-3 text-xs font-semibold rounded-lg transition-colors select-none text-center cursor-pointer ${
              activeTab === 'signin'
                ? 'text-white shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {activeTab === 'signin' && (
              <motion.div
                layoutId="authSegmentedSwitchPill"
                className="absolute inset-0 rounded-lg bg-gradient-to-r from-indigo-500 via-violet-500 to-fuchsia-500"
                transition={{ type: 'spring', stiffness: 450, damping: 35 }}
              />
            )}
            <span className="relative z-10">Sign in</span>
          </button>

          <button
            type="button"
            onClick={() => handleTabSwitch('register')}
            className={`relative py-1.5 px-3 text-xs font-semibold rounded-lg transition-colors select-none text-center cursor-pointer ${
              activeTab === 'register'
                ? 'text-white shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {activeTab === 'register' && (
              <motion.div
                layoutId="authSegmentedSwitchPill"
                className="absolute inset-0 rounded-lg bg-gradient-to-r from-indigo-500 via-violet-500 to-fuchsia-500"
                transition={{ type: 'spring', stiffness: 450, damping: 35 }}
              />
            )}
            <span className="relative z-10">Create account</span>
          </button>
        </div>

        {/* Card Header */}
        <div className="flex items-start justify-between pt-0.5">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-brand/30 bg-brand/10 text-brand shadow-sm">
              {activeTab === 'signin' ? <KeyRound className="h-4 w-4" /> : <UserPlus className="h-4 w-4" />}
            </div>
            <div>
              <h2 className="text-lg font-bold tracking-tight text-foreground flex items-center gap-1.5 leading-tight">
                {activeTab === 'signin' ? 'Welcome back' : 'Create Account'}
              </h2>
              <p className="text-[11px] text-muted-foreground leading-tight">
                {activeTab === 'signin' ? (
                  <>
                    <span className="font-semibold text-foreground">ProctorIQ Access</span> — Sign in to console
                  </>
                ) : (
                  'Candidate Self-Registration (STUDENT)'
                )}
              </p>
            </div>
          </div>

          <span className="text-[9px] font-mono px-2 py-0.5 rounded-md bg-surface-elevated border border-border text-muted-foreground font-medium">
            {activeTab === 'signin' ? 'JWT SECURED' : 'ZERO-TRUST'}
          </span>
        </div>

        {/* General Error Alert */}
        <AnimatePresence>
          {generalError && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="flex items-start gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 p-2.5 text-xs text-rose-600 dark:text-rose-200"
              role="alert"
            >
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-500" />
              <span>{generalError}</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ============================================================== */}
        {/* TAB 1: SIGN IN FORM                                            */}
        {/* ============================================================== */}
        {activeTab === 'signin' && (
          <div className="space-y-3">
            {/* Role Selection Tabs */}
            <div className="space-y-1">
              <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground font-semibold">
                SELECT OPERATOR ROLE
              </div>
              <div className="grid grid-cols-3 gap-1 p-0.5 rounded-xl bg-surface-elevated border border-border">
                {(['ADMIN', 'PROCTOR', 'STUDENT'] as RoleTab[]).map((role) => {
                  const isActive = activeRole === role;
                  const demo = ROLE_DEMOS[role];
                  return (
                    <button
                      key={role}
                      type="button"
                      onClick={() => handleRoleTabClick(role)}
                      className={`relative py-1.5 px-2 text-xs font-semibold rounded-lg transition-colors select-none text-center cursor-pointer ${
                        isActive
                          ? 'text-white shadow-sm'
                          : 'text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      {isActive && (
                        <motion.div
                          layoutId="activeRoleTabPill"
                          className="absolute inset-0 rounded-lg bg-gradient-to-r from-indigo-500 via-violet-500 to-fuchsia-500"
                          transition={{ type: 'spring', stiffness: 450, damping: 35 }}
                        />
                      )}
                      <span className="relative z-10 flex items-center justify-center gap-1">
                        {demo.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Login Form */}
            <form onSubmit={handleSignInSubmit} className="space-y-2.5" noValidate>
              <div className="space-y-0.5">
                <FloatingInput
                  id="login-email"
                  type="email"
                  autoFocus
                  autoComplete="email"
                  required
                  label="Operator Identity (Email)"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (emailError) setEmailError(null);
                  }}
                  icon={<User className="w-3.5 h-3.5" />}
                />
                {emailError && (
                  <p className="text-[10px] text-rose-500 font-mono pl-1">{emailError}</p>
                )}
              </div>

              <div className="space-y-0.5">
                <FloatingInput
                  id="login-password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  required
                  label="Credential (Password)"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (passwordError) setPasswordError(null);
                  }}
                  icon={<Lock className="w-3.5 h-3.5" />}
                  rightElement={
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="p-1 rounded-md text-muted-foreground hover:text-foreground transition-colors"
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  }
                />
                {passwordError && (
                  <p className="text-[10px] text-rose-500 font-mono pl-1">{passwordError}</p>
                )}
              </div>

              {/* Remember me & Active session */}
              <div className="flex items-center justify-between text-xs pt-0.5">
                <label className="flex items-center gap-1.5 cursor-pointer select-none text-muted-foreground hover:text-foreground">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="rounded border-border text-brand focus:ring-brand accent-brand cursor-pointer"
                  />
                  <span className="text-[11px]">Remember me</span>
                </label>

                <span className="text-muted-foreground font-mono text-[10px]">
                  Active Session
                </span>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={loading}
                className="w-full mt-1 py-2.5 px-4 rounded-xl font-semibold text-xs text-white bg-gradient-to-r from-indigo-500 via-violet-500 to-fuchsia-500 hover:from-indigo-600 hover:via-violet-600 hover:to-fuchsia-600 shadow-md shadow-brand/20 hover:shadow-lg hover:shadow-brand/30 active:scale-[0.99] transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <span className="inline-flex items-center gap-2">
                    <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Authenticating...
                  </span>
                ) : (
                  <>
                    <span>Authenticate & Enter Console</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </>
                )}
              </button>
            </form>

            {/* Collapsible Demo Accounts Section */}
            <div className="pt-2 border-t border-border/70 space-y-1.5">
              <button
                type="button"
                onClick={() => setIsDemoOpen(!isDemoOpen)}
                className="w-full flex items-center justify-between text-[10px] font-mono text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-1.5 uppercase tracking-wider font-semibold">
                  <span>DEMO ACCOUNTS (ONE-CLICK FILL)</span>
                </div>
                <div className="flex items-center gap-1 text-brand">
                  <span className="text-[9px]">Seeded DB</span>
                  <ChevronDown
                    className={`w-3 h-3 transition-transform duration-200 ${
                      isDemoOpen ? 'rotate-180' : ''
                    }`}
                  />
                </div>
              </button>

              <AnimatePresence>
                {isDemoOpen && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="grid grid-cols-3 gap-1.5 overflow-hidden"
                  >
                    {(['ADMIN', 'PROCTOR', 'STUDENT'] as RoleTab[]).map((role) => {
                      const demo = ROLE_DEMOS[role];
                      const isSelected = activeRole === role;
                      return (
                        <button
                          key={role}
                          type="button"
                          onClick={() => handleRoleTabClick(role)}
                          className={`p-1.5 rounded-xl border text-left transition-all duration-200 select-none cursor-pointer ${
                            isSelected
                              ? 'border-brand/60 bg-brand/10 shadow-sm'
                              : 'border-border bg-surface-elevated/60 hover:bg-surface-elevated hover:border-border/80'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-semibold text-[11px] text-foreground">
                              {demo.label}
                            </span>
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                          </div>
                          <div className="text-[9px] text-muted-foreground truncate font-mono mt-0.5">
                            {demo.email.split('@')[0]}
                          </div>
                        </button>
                      );
                    })}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* TAB 2: CREATE ACCOUNT FORM                                     */}
        {/* ============================================================== */}
        {activeTab === 'register' && (
          <form onSubmit={handleRegisterSubmit} className="space-y-2.5" noValidate>
            {/* Full Name */}
            <div className="space-y-0.5">
              <FloatingInput
                id="register-fullname"
                type="text"
                autoFocus
                autoComplete="name"
                required
                minLength={2}
                label="Candidate Full Name"
                value={fullName}
                onChange={(e) => {
                  setFullName(e.target.value);
                  if (fullNameError) setFullNameError(null);
                }}
                icon={<User className="w-3.5 h-3.5" />}
              />
              {fullNameError && (
                <p className="text-[10px] text-rose-500 font-mono pl-1">{fullNameError}</p>
              )}
            </div>

            {/* Email */}
            <div className="space-y-0.5">
              <FloatingInput
                id="register-email"
                type="email"
                autoComplete="email"
                required
                label="Institutional Email"
                value={regEmail}
                onChange={(e) => {
                  setRegEmail(e.target.value);
                  if (regEmailError) setRegEmailError(null);
                }}
                icon={<ShieldCheck className="w-3.5 h-3.5" />}
              />
              {regEmailError && (
                <p className="text-[10px] text-rose-500 font-mono pl-1">{regEmailError}</p>
              )}
            </div>

            {/* Password */}
            <div className="space-y-1">
              <FloatingInput
                id="register-password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="new-password"
                required
                minLength={8}
                label="Password (min 8 chars)"
                value={regPassword}
                onChange={(e) => {
                  setRegPassword(e.target.value);
                  if (regPasswordError) setRegPasswordError(null);
                }}
                icon={<Lock className="w-3.5 h-3.5" />}
                rightElement={
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="p-1 rounded-md text-muted-foreground hover:text-foreground transition-colors"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                }
              />
              {regPasswordError && (
                <p className="text-[10px] text-rose-500 font-mono pl-1">{regPasswordError}</p>
              )}

              {/* Password Strength Meter */}
              {regPassword.length > 0 && (
                <div className="space-y-1 px-1">
                  <div className="flex gap-1 h-1">
                    {[1, 2, 3, 4].map((step) => (
                      <div
                        key={step}
                        className={`flex-1 rounded-full transition-all duration-300 ${
                          step <= strength.score ? strength.color : 'bg-border'
                        }`}
                      />
                    ))}
                  </div>
                  <div className="flex justify-between items-center text-[10px] font-mono text-muted-foreground">
                    <span>Strength: <strong className="text-foreground">{strength.label}</strong></span>
                    <span>min. 8 characters</span>
                  </div>
                </div>
              )}
            </div>

            {/* Confirm Password */}
            <div className="space-y-0.5">
              <FloatingInput
                id="register-confirm-password"
                type={showConfirmPassword ? 'text' : 'password'}
                autoComplete="new-password"
                required
                label="Confirm Password"
                value={confirmPassword}
                onChange={(e) => {
                  setConfirmPassword(e.target.value);
                  if (confirmPasswordError) setConfirmPasswordError(null);
                }}
                icon={<CheckCircle className="w-3.5 h-3.5" />}
                rightElement={
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="p-1 rounded-md text-muted-foreground hover:text-foreground transition-colors"
                    aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                  >
                    {showConfirmPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                }
              />
              {confirmPasswordError && (
                <p className="text-[10px] text-rose-500 font-mono pl-1">{confirmPasswordError}</p>
              )}
            </div>

            {/* Terms & Honor Code Checkbox */}
            <div className="space-y-0.5 pt-0.5">
              <label className="flex items-start gap-2 cursor-pointer text-[11px] text-muted-foreground hover:text-foreground select-none">
                <input
                  type="checkbox"
                  checked={agreedToTerms}
                  onChange={(e) => {
                    setAgreedToTerms(e.target.checked);
                    if (termsError) setTermsError(null);
                  }}
                  className="mt-0.5 rounded border-border text-brand focus:ring-brand accent-brand cursor-pointer shrink-0"
                />
                <span className="leading-snug">
                  I agree to the <strong className="text-foreground">Academic Integrity Honor Code</strong> and authorize continuous biometric verification during evaluations.
                </span>
              </label>
              {termsError && (
                <p className="text-[10px] text-rose-500 font-mono pl-1">{termsError}</p>
              )}
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full mt-1 py-2.5 px-4 rounded-xl font-semibold text-xs text-white bg-gradient-to-r from-indigo-500 via-violet-500 to-fuchsia-500 hover:from-indigo-600 hover:via-violet-600 hover:to-fuchsia-600 shadow-md shadow-brand/20 hover:shadow-lg hover:shadow-brand/30 active:scale-[0.99] transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <span className="inline-flex items-center gap-2">
                  <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Provisioning...
                </span>
              ) : (
                <>
                  <span>Provision Candidate Account</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </>
              )}
            </button>
          </form>
        )}
      </motion.div>
    </AuthLayout>
  );
}
