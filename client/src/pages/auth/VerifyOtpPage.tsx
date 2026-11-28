import { useState, useEffect, useRef, type FormEvent, type KeyboardEvent, type ClipboardEvent } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ShieldCheck, ArrowLeft, AlertCircle, RefreshCw, Mail } from 'lucide-react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { AuthLayout } from '../../components/layout/AuthLayout';
import { AuthProgressSteps } from '../../components/auth/AuthProgressSteps';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { api, ApiClientError } from '../../lib/api';

function maskEmail(rawEmail: string): string {
  const parts = rawEmail.split('@');
  if (parts.length !== 2) return rawEmail;
  const [user, domain] = parts;
  if (!user) return rawEmail;
  if (user.length <= 2) {
    return `${user[0]}*@${domain}`;
  }
  const stars = '*'.repeat(Math.min(5, user.length - 1));
  return `${user[0]}${stars}@${domain}`;
}

export function VerifyOtpPage() {
  useDocumentTitle('Verify Code | ProctorIQ');
  const navigate = useNavigate();
  const location = useLocation();

  // Retrieve email from router state or sessionStorage
  const [email, setEmail] = useState<string>('');

  useEffect(() => {
    const stateEmail = (location.state as { email?: string } | null)?.email;
    const storedEmail = sessionStorage.getItem('proctoriq_reset_email');
    const resolved = stateEmail || storedEmail;

    if (!resolved) {
      navigate('/forgot-password', { replace: true });
    } else {
      setEmail(resolved);
    }
  }, [location.state, navigate]);

  const [digits, setDigits] = useState<string[]>(['', '', '', '', '', '']);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [resendNotice, setResendNotice] = useState<string | null>(null);
  const [isShaking, setIsShaking] = useState(false);

  // Client-side attempt tracker (starts at 5)
  const [triesLeft, setTriesLeft] = useState<number>(5);

  // Countdown timers: 10 minutes expiry (600s), 60s resend cooldown
  const [expiresInSeconds, setExpiresInSeconds] = useState<number>(600);
  const [resendCooldown, setResendCooldown] = useState<number>(60);

  // Expiry countdown timer (10 mins)
  useEffect(() => {
    if (expiresInSeconds <= 0) return;
    const timer = setInterval(() => {
      setExpiresInSeconds((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [expiresInSeconds]);

  // Resend cooldown timer (60s)
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setInterval(() => {
      setResendCooldown((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);

  // Focus on first input box upon load
  useEffect(() => {
    inputRefs.current[0]?.focus();
  }, []);

  const formatCountdown = (totalSec: number): string => {
    const mins = Math.floor(totalSec / 60);
    const secs = totalSec % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleDigitChange = (index: number, value: string) => {
    if (triesLeft <= 0) return;
    setGeneralError(null);
    setResendNotice(null);

    // Extract last character typed and ensure it is a numeric digit
    const cleaned = value.replace(/\D/g, '');
    const char = cleaned.slice(-1);

    const nextDigits = [...digits];
    nextDigits[index] = char;
    setDigits(nextDigits);

    if (char && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }

    // Auto-submit when all 6 digits are provided
    if (char && index === 5) {
      const fullCode = nextDigits.join('');
      if (fullCode.length === 6) {
        submitVerification(fullCode);
      }
    }
  };

  const handleKeyDown = (index: number, e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace') {
      if (!digits[index] && index > 0) {
        const nextDigits = [...digits];
        nextDigits[index - 1] = '';
        setDigits(nextDigits);
        inputRefs.current[index - 1]?.focus();
      } else {
        const nextDigits = [...digits];
        nextDigits[index] = '';
        setDigits(nextDigits);
      }
    } else if (e.key === 'ArrowLeft' && index > 0) {
      inputRefs.current[index - 1]?.focus();
    } else if (e.key === 'ArrowRight' && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handlePaste = (e: ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    if (triesLeft <= 0) return;
    const pastedText = e.clipboardData.getData('text');
    const cleaned = pastedText.replace(/\D/g, '').slice(0, 6);
    if (!cleaned) return;

    const nextDigits = [...digits];
    for (let i = 0; i < 6; i++) {
      nextDigits[i] = cleaned[i] || '';
    }
    setDigits(nextDigits);

    // Move focus to next unfilled box or the last box
    const focusIndex = Math.min(cleaned.length, 5);
    inputRefs.current[focusIndex]?.focus();

    // Auto-submit if all 6 digits were pasted
    if (cleaned.length === 6) {
      submitVerification(cleaned);
    }
  };

  const triggerErrorShake = (errorMessage: string, nextTries: number) => {
    setGeneralError(errorMessage);
    setIsShaking(true);
    setDigits(['', '', '', '', '', '']);
    setTimeout(() => {
      setIsShaking(false);
      if (nextTries > 0) {
        inputRefs.current[0]?.focus();
      }
    }, 400);
  };

  const submitVerification = async (codeToVerify: string) => {
    if (triesLeft <= 0 || loading) return;

    if (codeToVerify.length !== 6) {
      setGeneralError('Please enter all 6 digits of your verification code.');
      return;
    }

    if (expiresInSeconds <= 0) {
      triggerErrorShake("That code isn't valid or has expired", triesLeft);
      return;
    }

    setLoading(true);
    setGeneralError(null);

    try {
      const response = await api.post<{ resetToken: string }>('/auth/verify-otp', {
        email: email.trim().toLowerCase(),
        code: codeToVerify,
      });

      // Save short-lived reset token in sessionStorage and state (never in URL)
      sessionStorage.setItem('proctoriq_reset_token', response.resetToken);
      navigate('/reset-password', { state: { resetToken: response.resetToken } });
    } catch {
      const nextTries = Math.max(0, triesLeft - 1);
      setTriesLeft(nextTries);

      if (nextTries <= 0) {
        triggerErrorShake('Too many attempts. Request a new code.', 0);
      } else {
        triggerErrorShake(
          `That code isn't valid or has expired (${nextTries} ${nextTries === 1 ? 'try' : 'tries'} left)`,
          nextTries
        );
      }
    } finally {
      setLoading(false);
    }
  };

  const handleFormSubmit = (e: FormEvent) => {
    e.preventDefault();
    submitVerification(digits.join(''));
  };

  const handleResend = async () => {
    if (resendCooldown > 0 || resending) return;

    setResending(true);
    setGeneralError(null);
    setResendNotice(null);

    try {
      await api.post('/auth/forgot-password', { email: email.trim().toLowerCase() });
      setResendNotice('A new verification code has been dispatched.');
      setResendCooldown(60);
      setExpiresInSeconds(600);
      setTriesLeft(5);
      setDigits(['', '', '', '', '', '']);
      inputRefs.current[0]?.focus();
    } catch (err: unknown) {
      if (err instanceof ApiClientError && err.status === 429) {
        setGeneralError('Please wait before requesting another code.');
      } else {
        setGeneralError('Unable to resend code. Please try again in a moment.');
      }
    } finally {
      setResending(false);
    }
  };

  const masked = email ? maskEmail(email) : '';

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
        <AuthProgressSteps currentStep={2} />

        {/* Header */}
        <div className="text-center space-y-1.5 pt-1">
          <div className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-brand/10 border border-brand/20 text-brand mx-auto shadow-sm">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <h2 className="text-lg sm:text-xl font-bold tracking-tight text-foreground">
            Enter the code
          </h2>
          <p className="text-xs text-muted-foreground leading-relaxed max-w-sm mx-auto">
            If an account exists for <span className="font-semibold text-foreground font-mono">{masked}</span>, we sent a 6-digit code. It expires in 10 minutes.
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

          {resendNotice && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-2.5 text-xs text-emerald-600 dark:text-emerald-300"
              role="status"
              aria-live="polite"
            >
              <Mail className="h-4 w-4 shrink-0 text-emerald-500" />
              <span>{resendNotice}</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Form with 6-box OTP Input */}
        <form onSubmit={handleFormSubmit} className="space-y-4" noValidate>
          {/* OTP Box Container with Framer Motion Shake on Error */}
          <motion.div
            animate={isShaking ? { x: [-8, 8, -6, 6, -3, 3, 0] } : {}}
            transition={{ duration: 0.4 }}
            className="flex items-center justify-center gap-2 sm:gap-2.5 pt-1"
          >
            {digits.map((digit, idx) => (
              <input
                key={idx}
                ref={(el) => {
                  inputRefs.current[idx] = el;
                }}
                id={`otp-box-${idx}`}
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={1}
                autoComplete={idx === 0 ? 'one-time-code' : 'off'}
                disabled={triesLeft <= 0 || loading}
                aria-label={`Digit ${idx + 1} of 6`}
                value={digit}
                onChange={(e) => handleDigitChange(idx, e.target.value)}
                onKeyDown={(e) => handleKeyDown(idx, e)}
                onPaste={handlePaste}
                className={`w-10 h-12 sm:w-11 sm:h-13 text-center text-xl sm:text-2xl font-mono font-bold rounded-xl border transition-all focus:outline-none cursor-pointer ${
                  digit
                    ? 'border-brand bg-brand/5 text-foreground ring-2 ring-brand/30'
                    : 'border-border bg-surface-elevated text-foreground focus:border-brand focus:ring-2 focus:ring-brand/30'
                } ${
                  triesLeft <= 0
                    ? 'opacity-50 cursor-not-allowed bg-muted/20 border-rose-500/40'
                    : ''
                }`}
              />
            ))}
          </motion.div>

          {/* Timers & Expiry Row */}
          <div className="flex items-center justify-between text-[11px] text-muted-foreground px-1 font-mono">
            <span>
              Expires in{' '}
              <strong className={expiresInSeconds <= 60 ? 'text-rose-500 font-semibold' : 'text-foreground'}>
                {formatCountdown(expiresInSeconds)}
              </strong>
            </span>
            <span>
              {triesLeft > 0 ? (
                <span className={triesLeft <= 2 ? 'text-rose-500' : ''}>
                  {triesLeft} {triesLeft === 1 ? 'attempt' : 'attempts'} left
                </span>
              ) : (
                <span className="text-rose-500 font-semibold">Locked</span>
              )}
            </span>
          </div>

          {/* Action Buttons */}
          <div className="space-y-2 pt-1">
            <button
              type="submit"
              disabled={loading || digits.join('').length !== 6 || triesLeft <= 0}
              className="w-full py-2.5 px-4 rounded-xl font-semibold text-xs text-accent-foreground bg-gradient-to-r from-accent-from via-accent-via to-accent-to hover:opacity-95 shadow-md shadow-accent/20 hover:shadow-lg hover:shadow-accent/30 active:scale-[0.99] transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <span className="inline-flex items-center gap-2">
                  <span className="w-3.5 h-3.5 border-2 border-current/30 border-t-current rounded-full animate-spin" />
                  Verifying code...
                </span>
              ) : (
                <span>Verify code</span>
              )}
            </button>

            {/* Resend Code Button */}
            <button
              type="button"
              onClick={handleResend}
              disabled={resendCooldown > 0 || resending}
              className="w-full py-2 px-3 rounded-xl text-xs font-medium text-muted-foreground hover:text-foreground border border-border bg-surface-elevated hover:bg-surface-elevated/80 transition-colors flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${resending ? 'animate-spin' : ''}`} />
              <span>
                {resendCooldown > 0
                  ? `Resend code in ${resendCooldown}s`
                  : 'Resend code'}
              </span>
            </button>
          </div>
        </form>

        {/* Change email & Back to sign in links */}
        <div className="pt-1 flex items-center justify-between text-xs text-muted-foreground border-t border-border pt-3">
          <button
            type="button"
            onClick={() => {
              sessionStorage.removeItem('proctoriq_reset_email');
              navigate('/forgot-password');
            }}
            className="text-muted-foreground hover:text-foreground hover:underline transition-colors focus:outline-none focus:ring-2 focus:ring-brand/40 rounded px-1"
          >
            Change email
          </button>

          <Link
            to="/?tab=signin"
            className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground hover:underline transition-colors group focus:outline-none focus:ring-2 focus:ring-brand/40 rounded px-1"
          >
            <ArrowLeft className="w-3 h-3 transition-transform group-hover:-translate-x-0.5" />
            <span>Back to sign in</span>
          </Link>
        </div>
      </motion.div>
    </AuthLayout>
  );
}
