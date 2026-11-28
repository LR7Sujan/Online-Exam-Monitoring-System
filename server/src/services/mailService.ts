import nodemailer, { type Transporter } from 'nodemailer';
import { env } from '../config/env.js';

export interface SentEmailRecord {
  to: string;
  subject: string;
  text: string;
  html: string;
  timestamp: Date;
  otpCode?: string;
}

// In-memory capture for test environment (prevents any external network calls)
const testSentEmails: SentEmailRecord[] = [];

export function getSentTestEmails(): SentEmailRecord[] {
  return [...testSentEmails];
}

export function clearSentTestEmails(): void {
  testSentEmails.length = 0;
}

export function getLastSentOtpCode(email: string): string | undefined {
  const matches = testSentEmails.filter((m) => m.to.toLowerCase() === email.toLowerCase());
  return matches[matches.length - 1]?.otpCode;
}

let transporter: Transporter | null = null;

function getTransporter(): Transporter | null {
  if (env.NODE_ENV === 'test') {
    return null;
  }
  if (!transporter && env.SMTP_HOST) {
    transporter = nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT || 587,
      secure: env.SMTP_SECURE,
      auth: env.SMTP_USER && env.SMTP_PASS ? { user: env.SMTP_USER, pass: env.SMTP_PASS } : undefined,
    });
  }
  return transporter;
}

/**
 * Sends a 6-digit OTP verification email for password reset.
 */
export async function sendOtpEmail(email: string, code: string): Promise<boolean> {
  const subject = 'ProctorIQ: Your Password Reset Verification Code';
  const text = `Your ProctorIQ verification code is: ${code}\n\nThis code will expire in 10 minutes.\nIf you did not request a password reset, please ignore this email or contact support.`;
  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #09090b; color: #f4f4f5; margin: 0; padding: 24px; }
          .container { max-width: 520px; margin: 0 auto; background: #18181b; border: 1px solid #27272a; border-radius: 16px; padding: 32px; box-shadow: 0 4px 20px rgba(0,0,0,0.5); }
          .header { text-align: center; margin-bottom: 24px; }
          .logo { font-size: 20px; font-weight: 700; color: #6366f1; letter-spacing: -0.5px; }
          .title { font-size: 18px; font-weight: 600; margin-top: 12px; margin-bottom: 8px; color: #ffffff; }
          .desc { font-size: 14px; color: #a1a1aa; line-height: 1.5; margin-bottom: 24px; }
          .otp-box { background: #09090b; border: 1px solid #3f3f46; border-radius: 12px; padding: 20px; text-align: center; margin-bottom: 24px; }
          .otp-code { font-family: 'SF Mono', Monaco, Menlo, Consolas, monospace; font-size: 32px; font-weight: 700; letter-spacing: 8px; color: #818cf8; }
          .footer { font-size: 12px; color: #71717a; text-align: center; border-top: 1px solid #27272a; padding-top: 20px; margin-top: 24px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <div class="logo">ProctorIQ Security</div>
            <div class="title">Password Reset Verification</div>
          </div>
          <div class="desc">
            We received a request to reset your ProctorIQ account password. Use the verification code below to complete the verification step:
          </div>
          <div class="otp-box">
            <div class="otp-code">${code}</div>
          </div>
          <div class="desc" style="font-size: 12px; color: #71717a;">
            ⏳ This single-use code is valid for <strong>10 minutes</strong>. After 5 incorrect attempts, it will be locked automatically.
          </div>
          <div class="footer">
            If you did not request this code, no action is needed. Your password remains unchanged.
          </div>
        </div>
      </body>
    </html>
  `;

  // Always record in test environment
  if (env.NODE_ENV === 'test' || !env.SMTP_HOST) {
    testSentEmails.push({
      to: email,
      subject,
      text,
      html,
      timestamp: new Date(),
      otpCode: code,
    });
    return true;
  }

  const mailTransporter = getTransporter();
  if (!mailTransporter) {
    return false;
  }

  try {
    await mailTransporter.sendMail({
      from: env.SMTP_FROM,
      to: email,
      subject,
      text,
      html,
    });
    return true;
  } catch (err) {
    console.error('[MailService] Failed to send OTP email:', err);
    return false;
  }
}

/**
 * Sends a confirmation email after a password has been successfully reset.
 */
export async function sendPasswordChangedEmail(email: string): Promise<boolean> {
  const subject = 'ProctorIQ: Your Password Has Been Reset';
  const text = `Your ProctorIQ account password was successfully reset.\n\nIf you did not make this change, please contact your administrator immediately.`;
  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #09090b; color: #f4f4f5; margin: 0; padding: 24px; }
          .container { max-width: 520px; margin: 0 auto; background: #18181b; border: 1px solid #27272a; border-radius: 16px; padding: 32px; box-shadow: 0 4px 20px rgba(0,0,0,0.5); }
          .header { text-align: center; margin-bottom: 24px; }
          .logo { font-size: 20px; font-weight: 700; color: #10b981; letter-spacing: -0.5px; }
          .title { font-size: 18px; font-weight: 600; margin-top: 12px; margin-bottom: 8px; color: #ffffff; }
          .desc { font-size: 14px; color: #a1a1aa; line-height: 1.5; margin-bottom: 24px; }
          .footer { font-size: 12px; color: #71717a; text-align: center; border-top: 1px solid #27272a; padding-top: 20px; margin-top: 24px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <div class="logo">✓ Security Alert</div>
            <div class="title">Password Reset Successful</div>
          </div>
          <div class="desc">
            Your ProctorIQ account password was just successfully updated. All prior active sessions have been terminated.
          </div>
          <div class="footer">
            If you did not initiate this change, contact your security administrator immediately.
          </div>
        </div>
      </body>
    </html>
  `;

  if (env.NODE_ENV === 'test' || !env.SMTP_HOST) {
    testSentEmails.push({
      to: email,
      subject,
      text,
      html,
      timestamp: new Date(),
    });
    return true;
  }

  const mailTransporter = getTransporter();
  if (!mailTransporter) {
    return false;
  }

  try {
    await mailTransporter.sendMail({
      from: env.SMTP_FROM,
      to: email,
      subject,
      text,
      html,
    });
    return true;
  } catch (err) {
    console.error('[MailService] Failed to send password changed email:', err);
    return false;
  }
}
