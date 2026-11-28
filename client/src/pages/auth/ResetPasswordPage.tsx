import { useState, useEffect, type FormEvent } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Lock, Eye, EyeOff, CheckCircle2, AlertCircle, ArrowRight, RefreshCw } from 'lucide-react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { AuthLayout } from '../../components/layout/AuthLayout';
import { AuthProgressSteps } from '../../components/auth/AuthProgressSteps';
import { FloatingInput } from '../../components/ui/FloatingInput';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { api, ApiClientError } from '../../lib/api';

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

export function ResetPasswordPage() {
  useDocumentTitle('Create New Password | ProctorIQ');
  const navigate = useNavigate();
  const location = useLocation();

  const [resetToken, setResetToken] = useState<string>('');
  const [tokenExpired, setTokenExpired] = useState<boolean>(false);

  useEffect(() => {
    const stateToken = (location.state as { resetToken?: string } | null)?.resetToken;
    const storedToken = sessionStorage.getItem('proctoriq_reset_token');
    const resolved = stateToken || storedToken;

    if (!resolved) {
      navigate('/forgot-password', { replace: true });
    } else {
      setResetToken(resolved);
    }
  }, [location.state, navigate]);

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const [generalError, setGeneralError] = useState<string | null>(null);

  const [loading, setLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const strength = getPasswordStrength(password);

  const rules = [
    { label: 'At least 8 characters long', met: password.length >= 8 },
    { label: 'Contains upper & lowercase letters', met: /[A-Z]/.test(password) && /[a-z]/.test(password) },
    { label: 'Contains at least one number (0-9)', met: /\d/.test(password) },
    { label: 'Contains a special symbol (!@#$%...)', met: /[^A-Za-z0-9]/.test(password) },
    { label: 'Passwords match', met: Boolean(password && confirmPassword && password === confirmPassword) },
  ];

  const validate = (): boolean => {
    let valid = true;

    if (!password) {
      setPasswordError('Please enter a new password.');
      valid = false;
    } else if (password.length < 8) {
      setPasswordError('Password must be at least 8 characters long.');
      valid = false;
    } else {
      setPasswordError(null);
    }

    if (!confirmPassword) {
      setConfirmError('Please confirm your new password.');
      valid = false;
    } else if (password !== confirmPassword) {
      setConfirmError('Passwords do not match.');
      valid = false;
    } else {
      setConfirmError(null);
    }

    return valid;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setGeneralError(null);

    if (!validate()) return;

    setLoading(true);

    try {
      await api.post('/auth/reset-password', {
        resetToken,
        password,
        confirmPassword,
      });

      // Clear cached credentials from sessionStorage on success
      sessionStorage.removeItem('proctoriq_reset_email');
      sessionStorage.removeItem('proctoriq_reset_token');
      setIsSuccess(true);
    } catch (err: unknown) {
      if (err instanceof ApiClientError) {
        if (err.code === 'INVALID_OR_EXPIRED_TOKEN' || err.status === 400 || err.status === 401) {
          setTokenExpired(true);
          return;
        }
        setGeneralError(err.message || 'Failed to update password.');
      } else {
        setGeneralError('An unexpected error occurred. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout>
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="rounded-3xl border border-border bg-surface/85 backdrop-blur-2xl p-5 sm:p-6 shadow-layered-lg shadow-black/20 space-y-4 relative overflow-hidden"
      >
        {/* Top ambient highlight line */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-accent-from via-accent-via to-accent-to" />

        {/* 3-Step Progress Indicator */}
        <AuthProgressSteps currentStep={3} />

        {/* Success View */}
        {isSuccess ? (
          <div className="text-center space-y-4 py-3">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-500 shadow-md mx-auto">
              <CheckCircle2 className="w-8 h-8 stroke-[2.5]" />
            </div>

            <div className="space-y-1.5">
              <h2 className="text-xl font-bold tracking-tight text-foreground">
                Your password has been updated
              </h2>
              <p className="text-xs text-muted-foreground leading-relaxed max-w-sm mx-auto">
                Your credentials have been securely updated. You can now sign in to your ProctorIQ account.
              </p>
            </div>

            <div className="pt-2">
              <Link
                to="/?tab=signin"
                className="w-full py-2.5 px-4 rounded-xl font-semibold text-xs text-accent-foreground bg-gradient-to-r from-accent-from via-accent-via to-accent-to hover:opacity-95 shadow-md shadow-accent/20 hover:shadow-lg hover:shadow-accent/30 active:scale-[0.99] transition-all inline-flex items-center justify-center gap-2 cursor-pointer focus:outline-none focus:ring-2 focus:ring-brand/40"
              >
                <span>Sign in</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>
        ) : tokenExpired ? (
          /* Expired Token View */
          <div className="text-center space-y-4 py-3">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-500 shadow-sm mx-auto">
              <AlertCircle className="w-6 h-6" />
            </div>

            <div className="space-y-1.5">
              <h2 className="text-lg font-bold tracking-tight text-foreground">
                Your session expired. Start again
              </h2>
              <p className="text-xs text-muted-foreground leading-relaxed max-w-sm mx-auto">
                For your security, verification sessions expire after 10 minutes. Please request a new code.
              </p>
            </div>

            <div className="pt-2">
              <button
                type="button"
                onClick={() => {
                  sessionStorage.removeItem('proctoriq_reset_email');
                  sessionStorage.removeItem('proctoriq_reset_token');
                  navigate('/forgot-password');
                }}
                className="w-full py-2.5 px-4 rounded-xl font-semibold text-xs text-accent-foreground bg-gradient-to-r from-accent-from via-accent-via to-accent-to hover:opacity-95 shadow-md shadow-accent/20 hover:shadow-lg hover:shadow-accent/30 active:scale-[0.99] transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Request new code</span>
              </button>
            </div>
          </div>
        ) : (
          /* Normal Form View */
          <>
            <div className="text-center space-y-1.5 pt-1">
              <div className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-brand/10 border border-brand/20 text-brand mx-auto shadow-sm">
                <Lock className="w-5 h-5" />
              </div>
              <h2 className="text-lg sm:text-xl font-bold tracking-tight text-foreground">
                Create a new password
              </h2>
              <p className="text-xs text-muted-foreground leading-relaxed max-w-sm mx-auto">
                Choose a strong, unique password to secure your candidate or operator account.
              </p>
            </div>

            {/* Error Banner */}
            <AnimatePresence>
              {generalError && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="flex items-start gap-2.5 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-600 dark:text-rose-200"
                  role="alert"
                  aria-live="polite"
                >
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-500" />
                  <span className="leading-relaxed">{generalError}</span>
                </motion.div>
              )}
            </AnimatePresence>

            <form onSubmit={handleSubmit} className="space-y-3" noValidate>
              {/* New Password */}
              <div className="space-y-1">
                <FloatingInput
                  id="reset-password"
                  type={showPassword ? 'text' : 'password'}
                  autoFocus
                  autoComplete="new-password"
                  required
                  label="New Password"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (passwordError) setPasswordError(null);
                    if (generalError) setGeneralError(null);
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
                  <p className="text-[11px] text-rose-500 font-mono pl-1" role="alert">
                    {passwordError}
                  </p>
                )}
              </div>

              {/* Password Strength Meter */}
              {password && (
                <div className="space-y-1 pt-0.5">
                  <div className="flex items-center justify-between text-[10px] font-mono">
                    <span className="text-muted-foreground">PASSWORD STRENGTH</span>
                    <span className="font-semibold text-foreground">{strength.label}</span>
                  </div>
                  <div className="h-1.5 w-full bg-surface-elevated rounded-full overflow-hidden flex gap-1">
                    {[1, 2, 3, 4].map((step) => (
                      <div
                        key={step}
                        className={`h-full flex-1 rounded-full transition-all ${
                          strength.score >= step ? strength.color : 'bg-border/40'
                        }`}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Confirm Password */}
              <div className="space-y-1">
                <FloatingInput
                  id="reset-confirm-password"
                  type={showConfirm ? 'text' : 'password'}
                  autoComplete="new-password"
                  required
                  label="Confirm New Password"
                  value={confirmPassword}
                  onChange={(e) => {
                    setConfirmPassword(e.target.value);
                    if (confirmError) setConfirmError(null);
                    if (generalError) setGeneralError(null);
                  }}
                  icon={<Lock className="w-3.5 h-3.5" />}
                  rightElement={
                    <button
                      type="button"
                      onClick={() => setShowConfirm(!showConfirm)}
                      className="p-1 rounded-md text-muted-foreground hover:text-foreground transition-colors"
                      aria-label={showConfirm ? 'Hide password' : 'Show password'}
                    >
                      {showConfirm ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  }
                />
                {confirmError && (
                  <p className="text-[11px] text-rose-500 font-mono pl-1" role="alert">
                    {confirmError}
                  </p>
                )}
              </div>

              {/* Password Requirements Checklist */}
              <div className="p-2.5 rounded-xl bg-surface-elevated/70 border border-border text-[11px] space-y-1.5">
                <div className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground font-semibold">
                  SECURITY REQUIREMENTS
                </div>
                <div className="grid grid-cols-1 gap-1 text-[11px]">
                  {rules.map((rule, i) => (
                    <div
                      key={i}
                      className={`flex items-center gap-1.5 transition-colors ${
                        rule.met ? 'text-emerald-500 font-medium' : 'text-muted-foreground'
                      }`}
                    >
                      <div
                        className={`w-3.5 h-3.5 rounded-full flex items-center justify-center text-[9px] ${
                          rule.met ? 'bg-emerald-500/20 text-emerald-500 font-bold' : 'border border-border'
                        }`}
                      >
                        {rule.met ? '✓' : ''}
                      </div>
                      <span>{rule.label}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={loading || password.length < 8 || password !== confirmPassword}
                className="w-full py-2.5 px-4 rounded-xl font-semibold text-xs text-accent-foreground bg-gradient-to-r from-accent-from via-accent-via to-accent-to hover:opacity-95 shadow-md shadow-accent/20 hover:shadow-lg hover:shadow-accent/30 active:scale-[0.99] transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <span className="inline-flex items-center gap-2">
                    <span className="w-3.5 h-3.5 border-2 border-current/30 border-t-current rounded-full animate-spin" />
                    Updating password...
                  </span>
                ) : (
                  <span>Update password</span>
                )}
              </button>
            </form>

            <div className="pt-1 text-center">
              <Link
                to="/?tab=signin"
                className="text-xs text-muted-foreground hover:text-foreground transition-colors focus:outline-none focus:ring-2 focus:ring-brand/40 rounded px-1 py-0.5"
              >
                Cancel and return to sign in
              </Link>
            </div>
          </>
        )}
      </motion.div>
    </AuthLayout>
  );
}
