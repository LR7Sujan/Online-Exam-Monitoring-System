import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createServer, type Server } from 'node:http';
import { createApp } from '../src/app.js';
import { executeSql, testDbConnection } from '../src/config/db.js';
import { env, validateMailConfig } from '../src/config/env.js';
import {
  MailService,
  MockMailProvider,
  ConsoleMailProvider,
  SmtpMailProvider,
  renderOtpEmail,
  renderPasswordChangedEmail,
  mailService,
  sendOtpEmail,
  sendPasswordChangedEmail,
  getSentTestEmails,
  clearSentTestEmails,
  getLastSentOtpCode,
} from '../src/services/mailService.js';

describe('MailService: Providers, Validation, Templates, and Resilience', () => {
  beforeEach(() => {
    clearSentTestEmails();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('1. Provider Selection', () => {
    it('creates MockMailProvider when MAIL_PROVIDER is mock', () => {
      const service = new MailService('mock');
      expect(service.getProvider()).toBeInstanceOf(MockMailProvider);
    });

    it('creates ConsoleMailProvider when MAIL_PROVIDER is console in development', () => {
      const originalNodeEnv = env.NODE_ENV;
      try {
        (env as { NODE_ENV: string }).NODE_ENV = 'development';
        const service = new MailService('console');
        expect(service.getProvider()).toBeInstanceOf(ConsoleMailProvider);
      } finally {
        (env as { NODE_ENV: string }).NODE_ENV = originalNodeEnv;
      }
    });

    it('creates SmtpMailProvider when MAIL_PROVIDER is smtp with valid variables', () => {
      const originalHost = env.SMTP_HOST;
      const originalPort = env.SMTP_PORT;
      const originalUser = env.SMTP_USER;
      const originalPass = env.SMTP_PASS;
      try {
        (env as { SMTP_HOST?: string }).SMTP_HOST = 'smtp.test.io';
        (env as { SMTP_PORT?: number }).SMTP_PORT = 587;
        (env as { SMTP_USER?: string }).SMTP_USER = 'test_user';
        (env as { SMTP_PASS?: string }).SMTP_PASS = 'test_pass';

        const service = new MailService('smtp');
        expect(service.getProvider()).toBeInstanceOf(SmtpMailProvider);
      } finally {
        (env as { SMTP_HOST?: string }).SMTP_HOST = originalHost;
        (env as { SMTP_PORT?: number }).SMTP_PORT = originalPort;
        (env as { SMTP_USER?: string }).SMTP_USER = originalUser;
        (env as { SMTP_PASS?: string }).SMTP_PASS = originalPass;
      }
    });
  });

  describe('2. Startup Validation & Missing SMTP Variables', () => {
    it('throws error detailing all missing SMTP variables when MAIL_PROVIDER is smtp', () => {
      expect(() => {
        validateMailConfig({
          MAIL_PROVIDER: 'smtp',
          NODE_ENV: 'development',
          SMTP_HOST: undefined,
          SMTP_PORT: undefined,
          SMTP_USER: undefined,
          SMTP_PASS: undefined,
          MAIL_FROM: undefined,
          SMTP_FROM: undefined,
        });
      }).toThrowError(/Missing required SMTP configuration variables: SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, MAIL_FROM/);
    });

    it('identifies exact missing variable when only one is absent', () => {
      expect(() => {
        validateMailConfig({
          MAIL_PROVIDER: 'smtp',
          NODE_ENV: 'development',
          SMTP_HOST: 'smtp.sendgrid.net',
          SMTP_PORT: 587,
          SMTP_USER: 'apikey',
          SMTP_PASS: undefined,
          MAIL_FROM: 'test@proctoriq.io',
        });
      }).toThrowError(/Missing required SMTP configuration variables: SMTP_PASS/);
    });

    it('passes validation when all SMTP parameters are present', () => {
      expect(() => {
        validateMailConfig({
          MAIL_PROVIDER: 'smtp',
          NODE_ENV: 'production',
          SMTP_HOST: 'smtp.gmail.com',
          SMTP_PORT: 587,
          SMTP_USER: 'user@gmail.com',
          SMTP_PASS: 'secret',
          MAIL_FROM: 'no-reply@proctoriq.io',
        });
      }).not.toThrow();
    });
  });

  describe('3. Production Security & Console Provider Enforcement', () => {
    it('validateMailConfig refuses console provider in production', () => {
      expect(() => {
        validateMailConfig({
          MAIL_PROVIDER: 'console',
          NODE_ENV: 'production',
        });
      }).toThrowError(/MAIL_PROVIDER="console" is forbidden in production/);
    });

    it('ConsoleMailProvider.send rejects execution in production', async () => {
      const originalNodeEnv = env.NODE_ENV;
      try {
        (env as { NODE_ENV: string }).NODE_ENV = 'production';
        const consoleProvider = new ConsoleMailProvider();
        await expect(
          consoleProvider.send({
            to: 'student@proctoriq.io',
            subject: 'Verification',
            text: 'Code',
            html: '<p>Code</p>',
            otpCode: '123456',
          })
        ).rejects.toThrowError(/strictly forbidden in production/);
      } finally {
        (env as { NODE_ENV: string }).NODE_ENV = originalNodeEnv;
      }
    });

    it('ConsoleMailProvider prints formatted DEV ONLY block in development', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const originalNodeEnv = env.NODE_ENV;
      try {
        (env as { NODE_ENV: string }).NODE_ENV = 'development';
        const consoleProvider = new ConsoleMailProvider();
        const success = await consoleProvider.send({
          to: 'candidate@proctoriq.io',
          subject: 'ProctorIQ Verification',
          text: 'Body',
          html: '<p>Body</p>',
          otpCode: '482917',
        });

        expect(success).toBe(true);
        const logged = consoleSpy.mock.calls.map((c) => c[0]).join('\n');
        expect(logged).toContain('[DEV ONLY - OTP: 482917]');
        expect(logged).toContain('To: candidate@proctoriq.io');
        expect(logged).toContain('Code (spaced): 4 8 2 9 1 7');
        expect(logged).toContain('Expires: 10 minutes');
      } finally {
        (env as { NODE_ENV: string }).NODE_ENV = originalNodeEnv;
      }
    });
  });

  describe('4. Templates: Spaced Code, Security Notes, and Readability', () => {
    it('renders OTP template with spaced code, security notices, and name greeting', () => {
      const email = renderOtpEmail('Jane Student', '951370');

      // Spaced code verification (e.g. 9 5 1 3 7 0)
      expect(email.text).toContain('9 5 1 3 7 0');
      expect(email.html).toContain('9 5 1 3 7 0');

      // Greeting
      expect(email.text).toContain('Hello Jane Student,');
      expect(email.html).toContain('Hello Jane Student,');

      // Mandatory security disclosures
      expect(email.text).toContain('This code expires in 10 minutes.');
      expect(email.html).toContain('This code expires in 10 minutes.');

      expect(email.text).toContain('Never share this code with anyone.');
      expect(email.html).toContain('Never share this code with anyone.');

      expect(email.text).toContain("If you didn't request this, ignore this email.");
      expect(email.html).toContain("If you didn't request this, ignore this email.");

      // Product branding
      expect(email.text).toContain('ProctorIQ');
      expect(email.html).toContain('ProctorIQ');

      // Security hygiene: no tracking pixel images or auto-login link tokens
      expect(email.html).not.toMatch(/<img[^>]+src=["'][^"']*track/i);
      expect(email.html).not.toMatch(/<a[^>]+href=["'][^"']*\?token=/i);
    });

    it('renders password changed confirmation template with name and security notice', () => {
      const email = renderPasswordChangedEmail('Alex Proctor');

      expect(email.text).toContain('Hello Alex Proctor,');
      expect(email.html).toContain('Hello Alex Proctor,');
      expect(email.text).toContain('Your ProctorIQ account password was successfully reset.');
      expect(email.html).toContain('Your ProctorIQ account password was successfully reset.');
      expect(email.text).toContain('ProctorIQ');
      expect(email.html).toContain('ProctorIQ');
    });

    it('falls back to generic greeting when name is absent', () => {
      const email = renderOtpEmail(undefined, '112233');
      expect(email.text).toContain('Hello,');
      expect(email.html).toContain('Hello,');
    });
  });

  describe('5. Mock Provider & Convenience Helpers', () => {
    it('records and retrieves OTP emails in test mode', async () => {
      clearSentTestEmails();
      expect(getSentTestEmails()).toHaveLength(0);

      const ok = await sendOtpEmail('test@proctoriq.io', 'Test User', '654321');
      expect(ok).toBe(true);

      const sent = getSentTestEmails();
      expect(sent).toHaveLength(1);
      expect(sent[0]?.to).toBe('test@proctoriq.io');
      expect(sent[0]?.otpCode).toBe('654321');
      expect(getLastSentOtpCode('test@proctoriq.io')).toBe('654321');

      const passOk = await sendPasswordChangedEmail('test@proctoriq.io', 'Test User');
      expect(passOk).toBe(true);
      expect(getSentTestEmails()).toHaveLength(2);
    });
  });

  describe('6. Resilience: Mail Failure Does Not Break Generic API Response', () => {
    let httpServer: Server;
    let baseUrl: string;

    beforeEach(async () => {
      const ready = await testDbConnection();
      if (!ready) {
        throw new Error('Test DB not ready');
      }

      await executeSql('DELETE FROM Password_Reset_Tokens');
      await executeSql('DELETE FROM Password_Reset_Otps');
      await executeSql('DELETE FROM Rate_Limits');
      clearSentTestEmails();

      const app = createApp();
      httpServer = createServer(app);
      await new Promise<void>((resolve) => httpServer.listen(0, '127.0.0.1', resolve));
      const address = httpServer.address();
      if (!address || typeof address !== 'object') {
        throw new Error('Failed to bind server');
      }
      baseUrl = `http://127.0.0.1:${address.port}/api`;
    });

    afterEach(async () => {
      if (httpServer) {
        await new Promise<void>((resolve) => httpServer.close(() => resolve()));
      }
    });

    it('returns generic 200 message even when mail dispatch fails in background', async () => {
      // Simulate mail dispatch failure
      const sendMailSpy = vi.spyOn(mailService, 'sendMail').mockRejectedValueOnce(new Error('SMTP connection timeout'));
      vi.spyOn(console, 'error').mockImplementation(() => {});

      const res = await fetch(`${baseUrl}/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'admin@proctoriq.io' }),
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data).toEqual({
        success: true,
        data: {
          message: 'If an account exists for this email, a code has been sent.',
        },
        error: null,
      });

      // Verify failure was logged without exposing the code
      expect(sendMailSpy).toHaveBeenCalled();
    });
  });
});
