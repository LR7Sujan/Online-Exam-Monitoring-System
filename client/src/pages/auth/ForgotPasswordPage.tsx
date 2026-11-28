import { useState, type FormEvent } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mail, ArrowLeft, AlertCircle, KeyRound } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { AuthLayout } from '../../components/layout/AuthLayout';
import { AuthProgressSteps } from '../../components/auth/AuthProgressSteps';
import { FloatingInput } from '../../components/ui/FloatingInput';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { api, ApiClientError } from '../../lib/api';

export function ForgotPasswordPage() {
  useDocumentTitle('Forgot Password | ProctorIQ');
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState<string | null>(null);
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const validate = (): boolean => {
    const trimmed = email.trim();
    if (!trimmed) {
      setEmailError('Please enter your email address.');
      return false;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmed)) {
      setEmailError('Please enter a valid email address.');
      return false;
    }
    setEmailError(null);
    return true;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setGeneralError(null);

    if (!validate()) return;

    setLoading(true);
    const normalizedEmail = email.trim().toLowerCase();

    try {
      await api.post('/auth/forgot-password', { email: normalizedEmail });

      // Always persist email in sessionStorage (never expose in URL) and advance
      sessionStorage.setItem('proctoriq_reset_email', normalizedEmail);
      navigate('/verify-otp', { state: { email: normalizedEmail } });
    } catch (err: unknown) {
      if (err instanceof ApiClientError) {
        if (err.status === 429) {
          setGeneralError('Too many attempts. Please wait a minute before requesting another code.');
          return;
        }
        if (err.code === 'SERVER_UNREACHABLE' || err.status >= 500) {
          setGeneralError('The server is temporarily unreachable. Please check your network and try again.');
          return;
        }
      }

      // Default safe fallback if network or unknown error
      const message = err instanceof Error ? err.message : '';
      if (/network|fetch|connect|econnrefused/i.test(message)) {
        setGeneralError('Unable to connect to the authentication service. Please check your connection.');
      } else {
        // Uniform flow: whether the account exists or not, navigate to verify-otp
        sessionStorage.setItem('proctoriq_reset_email', normalizedEmail);
        navigate('/verify-otp', { state: { email: normalizedEmail } });
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
        <AuthProgressSteps currentStep={1} />

        {/* Header */}
        <div className="text-center space-y-1.5 pt-1">
          <div className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-brand/10 border border-brand/20 text-brand mx-auto shadow-sm">
            <KeyRound className="w-5 h-5" />
          </div>
          <h2 className="text-lg sm:text-xl font-bold tracking-tight text-foreground">
            Forgot your password?
          </h2>
          <p className="text-xs text-muted-foreground leading-relaxed max-w-sm mx-auto">
            Enter your account email and we&apos;ll send you a 6-digit code to reset your password.
          </p>
        </div>

        {/* Error Alert Banner */}
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

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-3.5" noValidate>
          <div className="space-y-1">
            <FloatingInput
              id="forgot-email"
              type="email"
              autoFocus
              autoComplete="email"
              required
              label="Account Email Address"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (emailError) setEmailError(null);
                if (generalError) setGeneralError(null);
              }}
              icon={<Mail className="w-3.5 h-3.5" />}
            />
            {emailError && (
              <p className="text-[11px] text-rose-500 font-mono pl-1" role="alert">
                {emailError}
              </p>
            )}
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 px-4 rounded-xl font-semibold text-xs text-accent-foreground bg-gradient-to-r from-accent-from via-accent-via to-accent-to hover:opacity-95 shadow-md shadow-accent/20 hover:shadow-lg hover:shadow-accent/30 active:scale-[0.99] transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <span className="inline-flex items-center gap-2">
                <span className="w-3.5 h-3.5 border-2 border-current/30 border-t-current rounded-full animate-spin" />
                Sending code...
              </span>
            ) : (
              <span>Send code</span>
            )}
          </button>
        </form>

        {/* Back to sign in link */}
        <div className="pt-1 text-center">
          <Link
            to="/?tab=signin"
            className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors group focus:outline-none focus:ring-2 focus:ring-brand/40 focus:ring-offset-1 rounded px-1 py-0.5"
          >
            <ArrowLeft className="w-3.5 h-3.5 transition-transform group-hover:-translate-x-0.5" />
            <span>Back to sign in</span>
          </Link>
        </div>
      </motion.div>
    </AuthLayout>
  );
}
