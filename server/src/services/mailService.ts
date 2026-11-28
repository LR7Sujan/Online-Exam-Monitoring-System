import nodemailer, { type Transporter } from 'nodemailer';
import { env, validateMailConfig } from '../config/env.js';

export interface SentEmailRecord {
  to: string;
  subject: string;
  text: string;
  html: string;
  timestamp: Date;
  otpCode?: string;
}

export interface EmailPayload {
  to: string;
  name?: string;
  subject: string;
  text: string;
  html: string;
  otpCode?: string;
}

export interface MailProvider {
  send(payload: EmailPayload): Promise<boolean>;
}

declare global {
  var __proctoriq_mail_transporter: Transporter | undefined;
}

// ----------------------------------------------------------------------------
// 1. Providers
// ----------------------------------------------------------------------------

export class MockMailProvider implements MailProvider {
  private sentEmails: SentEmailRecord[] = [];

  async send(payload: EmailPayload): Promise<boolean> {
    this.sentEmails.push({
      to: payload.to,
      subject: payload.subject,
      text: payload.text,
      html: payload.html,
      timestamp: new Date(),
      otpCode: payload.otpCode,
    });
    return true;
  }

  getSent(): SentEmailRecord[] {
    return [...this.sentEmails];
  }

  clear(): void {
    this.sentEmails.length = 0;
  }

  getLastOtp(email: string): string | undefined {
    const matches = this.sentEmails.filter((m) => m.to.toLowerCase() === email.toLowerCase());
    return matches[matches.length - 1]?.otpCode;
  }
}

export class ConsoleMailProvider implements MailProvider {
  async send(payload: EmailPayload): Promise<boolean> {
    if (env.NODE_ENV === 'production') {
      throw new Error('[MailService] MAIL_PROVIDER="console" is strictly forbidden in production.');
    }

    const divider = '='.repeat(60);
    const codeNotice = payload.otpCode
      ? `DEV ONLY - OTP: ${payload.otpCode}`
      : `DEV ONLY - EMAIL NOTIFICATION`;

    console.log(`\n${divider}`);
    console.log(`[${codeNotice}]`);
    console.log(`To: ${payload.to}`);
    console.log(`Subject: ${payload.subject}`);
    if (payload.otpCode) {
      console.log(`Code (spaced): ${payload.otpCode.split('').join(' ')}`);
      console.log(`Expires: 10 minutes`);
    }
    console.log(`${divider}\n`);
    return true;
  }
}

export class SmtpMailProvider implements MailProvider {
  private getTransporter(): Transporter {
    if (!globalThis.__proctoriq_mail_transporter) {
      globalThis.__proctoriq_mail_transporter = nodemailer.createTransport({
        host: env.SMTP_HOST,
        port: env.SMTP_PORT ? Number(env.SMTP_PORT) : 587,
        secure: env.SMTP_SECURE,
        auth:
          env.SMTP_USER && env.SMTP_PASS
            ? {
              user: env.SMTP_USER,
              pass: env.SMTP_PASS,
            }
            : undefined,
        pool: false, // Serverless-ready: do not keep open idle socket pools
      });
    }
    return globalThis.__proctoriq_mail_transporter;
  }

  async send(payload: EmailPayload): Promise<boolean> {
    const transporter = this.getTransporter();
    await transporter.sendMail({
      from: env.MAIL_FROM || env.SMTP_FROM,
      to: payload.to,
      subject: payload.subject,
      text: payload.text,
      html: payload.html,
    });
    return true;
  }
}

// ----------------------------------------------------------------------------
// 2. Templates
// ----------------------------------------------------------------------------

export function renderOtpEmail(
  name: string | undefined,
  code: string
): { subject: string; text: string; html: string; otpCode: string } {
  const sanitizedName = name?.trim();
  const greeting = sanitizedName ? `Hello ${sanitizedName},` : 'Hello,';
  const spacedCode = code.trim().split('').join(' ');
  const subject = 'ProctorIQ: Your Verification Code';

  const text = [
    greeting,
    '',
    `Your ProctorIQ verification code is: ${spacedCode}`,
    '',
    'This code expires in 10 minutes.',
    'Never share this code with anyone.',
    "If you didn't request this, ignore this email.",
    '',
    '— The ProctorIQ Team',
  ].join('\n');

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>ProctorIQ Verification Code</title>
  <style>
    body {
      margin: 0;
      padding: 24px;
      background-color: #f4f4f5;
      color: #18181b;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
    }
    .wrapper {
      max-width: 520px;
      margin: 0 auto;
      background-color: #ffffff;
      border: 1px solid #e4e4e7;
      border-radius: 14px;
      padding: 32px;
      box-shadow: 0 4px 16px rgba(0, 0, 0, 0.04);
    }
    .brand {
      font-size: 18px;
      font-weight: 700;
      color: #4f46e5;
      letter-spacing: -0.5px;
      margin-bottom: 24px;
    }
    .greeting {
      font-size: 16px;
      font-weight: 600;
      color: #18181b;
      margin-bottom: 12px;
    }
    .intro {
      font-size: 14px;
      line-height: 1.6;
      color: #3f3f46;
      margin-bottom: 20px;
    }
    .otp-box {
      background-color: #f8fafc;
      border: 1px solid #cbd5e1;
      border-radius: 10px;
      padding: 24px;
      text-align: center;
      margin: 24px 0;
    }
    .otp-code {
      font-family: 'SF Mono', Monaco, Menlo, Consolas, monospace;
      font-size: 34px;
      font-weight: 700;
      letter-spacing: 8px;
      color: #4338ca;
    }
    .policy-list {
      margin: 20px 0;
      padding: 0;
      list-style: none;
    }
    .policy-item {
      font-size: 13px;
      line-height: 1.6;
      color: #52525b;
      margin-bottom: 8px;
    }
    .policy-item strong {
      color: #18181b;
    }
    .footer {
      font-size: 12px;
      color: #71717a;
      border-top: 1px solid #e4e4e7;
      padding-top: 20px;
      margin-top: 28px;
      line-height: 1.5;
    }
    @media (prefers-color-scheme: dark) {
      body {
        background-color: #09090b !important;
        color: #f4f4f5 !important;
      }
      .wrapper {
        background-color: #18181b !important;
        border-color: #27272a !important;
      }
      .brand {
        color: #818cf8 !important;
      }
      .greeting {
        color: #f4f4f5 !important;
      }
      .intro {
        color: #d4d4d8 !important;
      }
      .otp-box {
        background-color: #09090b !important;
        border-color: #3f3f46 !important;
      }
      .otp-code {
        color: #a5b4fc !important;
      }
      .policy-item {
        color: #a1a1aa !important;
      }
      .policy-item strong {
        color: #f4f4f5 !important;
      }
      .footer {
        border-top-color: #27272a !important;
        color: #71717a !important;
      }
    }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="brand">ProctorIQ Security</div>
    <div class="greeting">${greeting}</div>
    <div class="intro">
      We received a request to verify your account or reset your password. Use the verification code below to proceed:
    </div>
    <div class="otp-box">
      <div class="otp-code">${spacedCode}</div>
    </div>
    <ul class="policy-list">
      <li class="policy-item">• <strong>This code expires in 10 minutes.</strong></li>
      <li class="policy-item">• <strong>Never share this code with anyone.</strong></li>
      <li class="policy-item">• <strong>If you didn't request this, ignore this email.</strong></li>
    </ul>
    <div class="footer">
      ProctorIQ Automated Security Service.<br>
      This email was sent to an address associated with ProctorIQ.
    </div>
  </div>
</body>
</html>`;

  return { subject, text, html, otpCode: code };
}

export function renderPasswordChangedEmail(name?: string): {
  subject: string;
  text: string;
  html: string;
} {
  const sanitizedName = name?.trim();
  const greeting = sanitizedName ? `Hello ${sanitizedName},` : 'Hello,';
  const subject = 'ProctorIQ: Your Password Has Been Reset';

  const text = [
    greeting,
    '',
    'Your ProctorIQ account password was successfully reset.',
    '',
    'If you made this change, no further action is required.',
    'If you did not make this change, please contact your administrator or ProctorIQ support immediately.',
    '',
    '— The ProctorIQ Team',
  ].join('\n');

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Password Reset Confirmation</title>
  <style>
    body {
      margin: 0;
      padding: 24px;
      background-color: #f4f4f5;
      color: #18181b;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
    }
    .wrapper {
      max-width: 520px;
      margin: 0 auto;
      background-color: #ffffff;
      border: 1px solid #e4e4e7;
      border-radius: 14px;
      padding: 32px;
      box-shadow: 0 4px 16px rgba(0, 0, 0, 0.04);
    }
    .brand {
      font-size: 18px;
      font-weight: 700;
      color: #059669;
      letter-spacing: -0.5px;
      margin-bottom: 24px;
    }
    .greeting {
      font-size: 16px;
      font-weight: 600;
      color: #18181b;
      margin-bottom: 12px;
    }
    .text {
      font-size: 14px;
      line-height: 1.6;
      color: #3f3f46;
      margin-bottom: 20px;
    }
    .alert-box {
      background-color: #f0fdf4;
      border: 1px solid #bbf7d0;
      border-radius: 10px;
      padding: 16px 20px;
      margin: 20px 0;
      font-size: 14px;
      color: #166534;
      font-weight: 500;
    }
    .footer {
      font-size: 12px;
      color: #71717a;
      border-top: 1px solid #e4e4e7;
      padding-top: 20px;
      margin-top: 28px;
      line-height: 1.5;
    }
    @media (prefers-color-scheme: dark) {
      body {
        background-color: #09090b !important;
        color: #f4f4f5 !important;
      }
      .wrapper {
        background-color: #18181b !important;
        border-color: #27272a !important;
      }
      .brand {
        color: #34d399 !important;
      }
      .greeting {
        color: #f4f4f5 !important;
      }
      .text {
        color: #d4d4d8 !important;
      }
      .alert-box {
        background-color: #052e16 !important;
        border-color: #166534 !important;
        color: #bbf7d0 !important;
      }
      .footer {
        border-top-color: #27272a !important;
        color: #71717a !important;
      }
    }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="brand">✓ Security Confirmation</div>
    <div class="greeting">${greeting}</div>
    <div class="alert-box">
      Your ProctorIQ account password was successfully reset.
    </div>
    <div class="text">
      If you performed this reset, your account is secure and you can sign in using your new credentials.
    </div>
    <div class="text" style="color: #b91c1c; font-size: 13px;">
      If you did not initiate this change, your account may be compromised. Please notify your proctor or administrator immediately.
    </div>
    <div class="footer">
      ProctorIQ Security Notification.<br>
      This automated alert was dispatched to keep your account safe.
    </div>
  </div>
</body>
</html>`;

  return { subject, text, html };
}

// ----------------------------------------------------------------------------
// 3. MailService
// ----------------------------------------------------------------------------

export class MailService {
  private provider: MailProvider;

  constructor(providerType: 'smtp' | 'console' | 'mock' = env.MAIL_PROVIDER) {
    if (providerType === 'mock') {
      this.provider = new MockMailProvider();
    } else if (providerType === 'console') {
      if (env.NODE_ENV === 'production') {
        throw new Error('[MailService] MAIL_PROVIDER="console" is forbidden in production.');
      }
      this.provider = new ConsoleMailProvider();
    } else if (providerType === 'smtp') {
      validateMailConfig(env);
      this.provider = new SmtpMailProvider();
    } else {
      this.provider = new ConsoleMailProvider();
    }
  }

  setProvider(provider: MailProvider): void {
    this.provider = provider;
  }

  getProvider(): MailProvider {
    return this.provider;
  }

  /**
   * Dispatches email in the background with a 10-second timeout guarantee.
   * Failures are logged without revealing the code and never thrown.
   */
  async sendMail(payload: EmailPayload): Promise<boolean> {
    try {
      let timeoutTimer: NodeJS.Timeout;
      const timeoutPromise = new Promise<never>((_, reject) => {
        timeoutTimer = setTimeout(() => {
          reject(new Error('Email dispatch timed out after 10000ms'));
        }, 10000);
        timeoutTimer.unref?.();
      });

      try {
        return await Promise.race([this.provider.send(payload), timeoutPromise]);
      } finally {
        clearTimeout(timeoutTimer!);
      }
    } catch (err) {
      // Ensure the OTP code is NEVER logged in error outputs
      const message = err instanceof Error ? err.message : String(err);
      console.error('[MailService] Failed to send email to recipient:', message);
      return false;
    }
  }

  async sendOtp(to: string, name: string | undefined, code: string): Promise<boolean> {
    const template = renderOtpEmail(name, code);
    return this.sendMail({
      to,
      name,
      subject: template.subject,
      text: template.text,
      html: template.html,
      otpCode: code,
    });
  }

  async sendPasswordChanged(to: string, name?: string): Promise<boolean> {
    const template = renderPasswordChangedEmail(name);
    return this.sendMail({
      to,
      name,
      subject: template.subject,
      text: template.text,
      html: template.html,
    });
  }
}

// Global default service instance
export const mailService = new MailService();

// ----------------------------------------------------------------------------
// 4. Convenience & Test Helpers
// ----------------------------------------------------------------------------

export async function sendOtpEmail(
  email: string,
  nameOrCode: string,
  maybeCode?: string
): Promise<boolean> {
  let name: string | undefined;
  let code: string;

  if (maybeCode !== undefined) {
    name = nameOrCode;
    code = maybeCode;
  } else {
    name = undefined;
    code = nameOrCode;
  }

  return mailService.sendOtp(email, name, code);
}

export async function sendPasswordChangedEmail(email: string, name?: string): Promise<boolean> {
  return mailService.sendPasswordChanged(email, name);
}

export function getSentTestEmails(): SentEmailRecord[] {
  const provider = mailService.getProvider();
  if (provider instanceof MockMailProvider) {
    return provider.getSent();
  }
  return [];
}

export function clearSentTestEmails(): void {
  const provider = mailService.getProvider();
  if (provider instanceof MockMailProvider) {
    provider.clear();
  }
}

export function getLastSentOtpCode(email: string): string | undefined {
  const provider = mailService.getProvider();
  if (provider instanceof MockMailProvider) {
    return provider.getLastOtp(email);
  }
  return undefined;
}
