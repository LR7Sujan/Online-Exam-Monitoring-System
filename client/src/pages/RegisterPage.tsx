import { useState, useEffect, type FormEvent } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  AlertCircle,
  UserPlus,
  Eye,
  EyeOff,
  User,
  ShieldCheck,
  ArrowRight,
  Lock,
  CheckCircle,
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { AuthLayout } from '../components/layout/AuthLayout';
import { FloatingInput } from '../components/ui/FloatingInput';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { api } from '../lib/api';
import { useAuthStore } from '../store/authStore';
import type { AuthUser } from '../types/domain';

interface AuthResponse {
  token: string;
  user: AuthUser;
}

function redirectByRole(role: AuthUser['role']): string {
  if (role === 'ADMIN') return '/admin';
  if (role === 'PROCTOR') return '/proctor';
  return '/student';
}

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

export function RegisterPage() {
  useDocumentTitle('Create Account | ProctorIQ');
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const setAuth = useAuthStore((s) => s.setAuth);

  // If already logged in, redirect immediately to role dashboard
  useEffect(() => {
    if (user) {
      navigate(redirectByRole(user.role), { replace: true });
    }
  }, [user, navigate]);

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [agreedToTerms, setAgreedToTerms] = useState(false);

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Field-level error messages
  const [fullNameError, setFullNameError] = useState<string | null>(null);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [confirmPasswordError, setConfirmPasswordError] = useState<string | null>(null);
  const [termsError, setTermsError] = useState<string | null>(null);
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const strength = getPasswordStrength(password);

  const validate = () => {
    let valid = true;
    setFullNameError(null);
    setEmailError(null);
    setPasswordError(null);
    setConfirmPasswordError(null);
    setTermsError(null);
    setGeneralError(null);

    if (!fullName.trim() || fullName.trim().length < 2) {
      setFullNameError('Full name must be at least 2 characters.');
      valid = false;
    }

    if (!email.trim()) {
      setEmailError('Email address is required.');
      valid = false;
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setEmailError('Please enter a valid institutional email.');
      valid = false;
    }

    if (!password) {
      setPasswordError('Password is required.');
      valid = false;
    } else if (password.length < 8) {
      setPasswordError('Password must be at least 8 characters long.');
      valid = false;
    }

    if (!confirmPassword) {
      setConfirmPasswordError('Please confirm your password.');
      valid = false;
    } else if (password !== confirmPassword) {
      setConfirmPasswordError('Passwords do not match.');
      valid = false;
    }

    if (!agreedToTerms) {
      setTermsError('You must agree to the academic integrity terms.');
      valid = false;
    }

    return valid;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setGeneralError(null);

    if (!validate()) return;

    setLoading(true);
    try {
      const data = await api.post<AuthResponse>('/auth/register', {
        fullName: fullName.trim(),
        email: email.trim(),
        password,
      });
      setAuth(data.token, data.user);
      navigate('/student');
    } catch (err) {
      setGeneralError(err instanceof Error ? err.message : 'Registration failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout>
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="rounded-3xl border border-border bg-surface/90 backdrop-blur-xl p-6 sm:p-8 shadow-layered-md space-y-6 relative overflow-hidden"
      >
        {/* Top ambient highlight line */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-indigo-500 via-violet-500 to-fuchsia-500" />

        {/* Card Header */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-brand/30 bg-brand/10 text-brand shadow-sm">
              <UserPlus className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold tracking-tight text-foreground">
                Create Account
              </h2>
              <p className="text-xs text-muted-foreground">Candidate Self-Registration (STUDENT)</p>
            </div>
          </div>

          <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-surface-elevated border border-border text-muted-foreground font-medium">
            ZERO-TRUST
          </span>
        </div>

        {/* General Error Alert */}
        <AnimatePresence>
          {generalError && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="flex items-start gap-2.5 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-600 dark:text-rose-200"
              role="alert"
            >
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-500" />
              <span>{generalError}</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Registration Form with Floating Labels & Inline Validation */}
        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          {/* Full Name */}
          <div className="space-y-1">
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
              icon={<User className="w-4 h-4" />}
            />
            {fullNameError && (
              <p className="text-[11px] text-rose-500 font-mono pl-1">{fullNameError}</p>
            )}
          </div>

          {/* Email */}
          <div className="space-y-1">
            <FloatingInput
              id="register-email"
              type="email"
              autoComplete="email"
              required
              label="Institutional Email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (emailError) setEmailError(null);
              }}
              icon={<ShieldCheck className="w-4 h-4" />}
            />
            {emailError && (
              <p className="text-[11px] text-rose-500 font-mono pl-1">{emailError}</p>
            )}
          </div>

          {/* Password */}
          <div className="space-y-1.5">
            <FloatingInput
              id="register-password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="new-password"
              required
              minLength={8}
              label="Password (min 8 chars)"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                if (passwordError) setPasswordError(null);
              }}
              icon={<Lock className="w-4 h-4" />}
              rightElement={
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="p-1 rounded-md text-muted-foreground hover:text-foreground transition-colors"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              }
            />
            {passwordError && (
              <p className="text-[11px] text-rose-500 font-mono pl-1">{passwordError}</p>
            )}

            {/* Password Strength Meter */}
            {password.length > 0 && (
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
          <div className="space-y-1">
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
              icon={<CheckCircle className="w-4 h-4" />}
              rightElement={
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="p-1 rounded-md text-muted-foreground hover:text-foreground transition-colors"
                  aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                >
                  {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              }
            />
            {confirmPasswordError && (
              <p className="text-[11px] text-rose-500 font-mono pl-1">{confirmPasswordError}</p>
            )}
          </div>

          {/* Terms & Honor Code Checkbox */}
          <div className="space-y-1 pt-1">
            <label className="flex items-start gap-2.5 cursor-pointer text-xs text-muted-foreground hover:text-foreground select-none">
              <input
                type="checkbox"
                checked={agreedToTerms}
                onChange={(e) => {
                  setAgreedToTerms(e.target.checked);
                  if (termsError) setTermsError(null);
                }}
                className="mt-0.5 rounded border-border text-brand focus:ring-brand accent-brand cursor-pointer shrink-0"
              />
              <span className="leading-tight">
                I agree to the <strong className="text-foreground">Academic Integrity Honor Code</strong> and authorize continuous biometric verification during evaluations.
              </span>
            </label>
            {termsError && (
              <p className="text-[11px] text-rose-500 font-mono pl-1">{termsError}</p>
            )}
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full mt-2 py-3 px-4 rounded-xl font-semibold text-sm text-white bg-gradient-to-r from-indigo-500 via-violet-500 to-fuchsia-500 hover:from-indigo-600 hover:via-violet-600 hover:to-fuchsia-600 shadow-md shadow-brand/20 hover:shadow-lg hover:shadow-brand/30 active:scale-[0.99] transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <span className="inline-flex items-center gap-2">
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Provisioning...
              </span>
            ) : (
              <>
                <span>Provision Candidate Account</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        {/* Link: Already have an account? Sign in */}
        <div className="pt-3 border-t border-border/60 text-center text-xs text-muted-foreground">
          Already have an account?{' '}
          <Link to="/login" className="font-semibold text-brand hover:underline">
            Sign in here →
          </Link>
        </div>
      </motion.div>
    </AuthLayout>
  );
}
