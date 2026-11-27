import { chromium } from '../client/node_modules/@playwright/test/index.mjs';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BASE_URL = 'http://localhost:5174';
const OUTPUT_DIR = path.resolve(__dirname, '../docs/phase24-screenshots');
const ARTIFACTS_DIR = 'C:/Users/sujan/.gemini/antigravity/brain/97a5d7ef-e573-4e93-97be-a01e12d76ce9';

const ACCENTS = ['indigo', 'cyan', 'emerald', 'amber', 'rose'];
const THEMES = ['dark', 'light'];

// Mock datasets for rich visual presentation
const MOCK_EXAMS = [
  {
    id: 1,
    title: 'CS 401: Distributed Systems Final Examination',
    description: 'Comprehensive evaluation of distributed algorithms, consensus, Paxos/Raft, and replication.',
    durationMinutes: 90,
    startTime: new Date().toISOString(),
    status: 'ACTIVE',
    totalQuestions: 25,
    allowTimeExtensions: true,
  },
  {
    id: 2,
    title: 'SEC 301: Cryptographic Engineering Midterm',
    description: 'Block ciphers, zero-knowledge proofs, authenticated key exchange.',
    durationMinutes: 60,
    status: 'SCHEDULED',
    totalQuestions: 20,
    allowTimeExtensions: false,
  }
];

const MOCK_SESSIONS = [
  {
    id: 101,
    examId: 1,
    examTitle: 'CS 401: Distributed Systems Final Examination',
    candidateName: 'Alex Mercer (Candidate 101)',
    status: 'IN_PROGRESS',
    trustScore: 94,
    integrityStatus: 'CLEAN',
    violationCount: 0,
    warningCount: 0,
    timeRemainingSeconds: 3240,
    durationMinutes: 90,
    startedAt: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
    answersSubmitted: 8,
    totalQuestions: 25,
  },
  {
    id: 102,
    examId: 1,
    candidateName: 'Jordan Lee (Candidate 102)',
    status: 'IN_PROGRESS',
    trustScore: 72,
    integrityStatus: 'FLAGGED',
    violationCount: 2,
    warningCount: 1,
    timeRemainingSeconds: 2900,
    durationMinutes: 90,
    startedAt: new Date(Date.now() - 20 * 60 * 1000).toISOString(),
  }
];

const MOCK_SCORECARD = {
  session: {
    id: 101,
    examId: 1,
    studentId: 1,
    candidateName: 'Alex Mercer',
    studentEmail: 'student1@proctoriq.io',
    examTitle: 'CS 401: Distributed Systems Final Examination',
    status: 'COMPLETED',
    score: 88,
    totalQuestions: 25,
    trustScore: 92,
    riskBand: 'LOW',
    violationCount: 1,
    warningCount: 1,
    durationMinutes: 90,
    submittedAt: new Date().toISOString(),
    aiAnalysis: 'Candidate exhibited standard examination telemetry with one minor tab blur event during question 14. Trust integrity remains verified at 92%.',
  },
  violations: [
    {
      id: 1,
      type: 'TAB_BLUR',
      severity: 'LOW',
      timestamp: new Date(Date.now() - 25 * 60 * 1000).toISOString(),
      details: 'Browser window lost focus for 3.2s',
      resolved: true,
    }
  ],
  verdicts: [
    {
      proctorId: 1,
      proctorName: 'Chief Proctor Vance',
      verdict: 'APPROVED',
      notes: 'Clean session telemetry, verified low-risk blur.',
      timestamp: new Date().toISOString(),
    }
  ],
  trustHistory: [
    { timestamp: '10:00', score: 100 },
    { timestamp: '10:15', score: 98 },
    { timestamp: '10:30', score: 92 },
    { timestamp: '10:45', score: 92 },
  ]
};

const MOCK_EXAM_SESSION = {
  id: 101,
  examId: 1,
  examTitle: 'CS 401: Distributed Systems Final Examination',
  status: 'IN_PROGRESS',
  durationMinutes: 90,
  timeRemainingSeconds: 4120,
  totalQuestions: 5,
  currentQuestionIndex: 0,
  questions: [
    {
      id: 1001,
      order: 1,
      prompt: 'Explain the fundamental tradeoff presented by the FLP Impossibility Theorem in asynchronous distributed systems.',
      type: 'TEXT',
      options: [],
    },
    {
      id: 1002,
      order: 2,
      prompt: 'Which consensus protocol relies on a rotating leader paradigm without requiring linear leader lease timeouts?',
      type: 'MULTIPLE_CHOICE',
      options: ['Raft', 'Multi-Paxos', 'HotStuff', 'Zab'],
    }
  ],
  answers: {
    1001: 'In an asynchronous system with even one crash fault, no deterministic consensus protocol can guarantee both safety and liveness.',
  }
};

const PAGES = [
  { id: 'login', name: 'Authentication Login', path: '/?tab=signin', role: 'ANON' },
  { id: 'home', name: 'Mission Control Home', path: '/home', role: 'ADMIN' },
  { id: 'live-monitor', name: 'Live Proctoring Matrix', path: '/proctor', role: 'PROCTOR' },
  { id: 'student-audit', name: 'Student Forensic Directory', path: '/admin/students', role: 'ADMIN' },
  { id: 'scorecard', name: 'Exam Integrity Scorecard', path: '/admin/students/1/exams/101', role: 'ADMIN' },
  { id: 'exam-catalog', name: 'Exam Management Catalog', path: '/admin/exams', role: 'ADMIN' },
  { id: 'telemetry-heatmap', name: 'Circadian Risk Heatmap & Telemetry', path: '/admin/analytics', role: 'ADMIN' },
  { id: 'simulator', name: 'Load & Swarm Simulator', path: '/admin/simulator', role: 'ADMIN' },
  { id: 'student-dashboard', name: 'Student Portal Dashboard', path: '/student', role: 'STUDENT' },
  { id: 'exam-screen', name: 'Student Exam Kiosk', path: '/student/session/101', role: 'STUDENT' },
  { id: 'warning-screen', name: 'Student Active Warning State', path: '/student/session/101', role: 'STUDENT', triggerWarning: true },
  { id: 'result-page', name: 'Student Submission & Score Result', path: '/student/results/101', role: 'STUDENT' },
  { id: 'styleguide', name: 'Styleguide Design Tokens', path: '/styleguide/tokens', role: 'ADMIN' },
];

async function setupPageRoutes(page) {
  await page.route('**/api/notifications**', (r) =>
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ notifications: [], unreadCount: 0 }) })
  );
  await page.route('**/api/monitor/stats**', (r) =>
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ liveCount: 14, flagCount: 2, totalActive: 16 }) })
  );
  await page.route('**/api/monitor/live**', (r) =>
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ sessions: MOCK_SESSIONS }) })
  );
  await page.route('**/api/exams**', (r) =>
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ exams: MOCK_EXAMS, total: MOCK_EXAMS.length }) })
  );
  await page.route('**/api/sessions**', (r) =>
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ sessions: MOCK_SESSIONS }) })
  );
  await page.route('**/api/audit/students**', (r) =>
    r.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        students: [
          { id: 1, fullName: 'Alex Mercer', email: 'alex.mercer@proctoriq.io', trustScore: 92, completedExams: 4, flagCount: 1 },
          { id: 2, fullName: 'Jordan Lee', email: 'jordan.lee@proctoriq.io', trustScore: 74, completedExams: 3, flagCount: 3 },
          { id: 3, fullName: 'Samira Chen', email: 'samira.chen@proctoriq.io', trustScore: 98, completedExams: 6, flagCount: 0 },
        ]
      })
    })
  );
  await page.route('**/api/sessions/101/scorecard**', (r) =>
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MOCK_SCORECARD) })
  );
  await page.route('**/api/sessions/101/result**', (r) =>
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MOCK_SCORECARD) })
  );
  await page.route('**/api/sessions/101**', (r) =>
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MOCK_EXAM_SESSION) })
  );
  await page.route('**/api/sessions/101/heartbeat**', (r) =>
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ status: 'OK', timeRemainingSeconds: 4100 }) })
  );
  await page.route('**/api/sessions/101/time-left**', (r) =>
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ timeRemainingSeconds: 4100, isExpired: false }) })
  );
}

async function setSessionState(page, role, theme, accent) {
  await page.goto(`${BASE_URL}/`);
  await page.evaluate(({ r, t, a }) => {
    localStorage.clear();
    localStorage.setItem('proctoriq-theme', t);
    localStorage.setItem('proctoriq-accent', a);
    document.documentElement.setAttribute('data-accent', a);
    if (t === 'dark') {
      document.documentElement.classList.add('dark');
      document.documentElement.classList.remove('light');
      document.documentElement.style.colorScheme = 'dark';
    } else {
      document.documentElement.classList.remove('dark');
      document.documentElement.classList.add('light');
      document.documentElement.style.colorScheme = 'light';
    }

    if (r !== 'ANON') {
      const user = {
        id: 1,
        email: `${r.toLowerCase()}@proctoriq.io`,
        fullName: `Lead ${r}`,
        role: r,
      };
      localStorage.setItem('proctoriq_auth_v1', JSON.stringify({ token: 'mock-jwt-token', user }));
    }
  }, { r: role, t: theme, a: accent });
  await page.waitForTimeout(200);
}

async function run() {
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    ignoreHTTPSErrors: true,
  });
  const page = await context.newPage();
  await setupPageRoutes(page);

  console.log('Starting Phase 24 Multi-Accent Visual Capture...');
  const manifest = [];

  for (const theme of THEMES) {
    for (const accent of ACCENTS) {
      console.log(`\nCapturing Theme: ${theme.toUpperCase()}, Accent: ${accent.toUpperCase()}...`);

      for (const p of PAGES) {
        await setSessionState(page, p.role, theme, accent);
        await page.goto(`${BASE_URL}${p.path}`);
        await page.waitForLoadState('domcontentloaded');
        await page.waitForTimeout(500);

        if (p.triggerWarning) {
          // Trigger mock warning modal or banner if present
          await page.evaluate(() => {
            const warningEl = document.querySelector('[data-testid="warning-banner"]');
            if (warningEl) warningEl.scrollIntoView();
          });
        }

        const fileName = `${theme}-${accent}-${p.id}.png`;
        const filePath = path.join(OUTPUT_DIR, fileName);
        await page.screenshot({ path: filePath, fullPage: false });

        // Copy key highlights to artifacts folder for live visual preview
        if (p.id === 'home' || p.id === 'live-monitor' || p.id === 'scorecard' || p.id === 'exam-screen' || p.id === 'styleguide') {
          try {
            fs.copyFileSync(filePath, path.join(ARTIFACTS_DIR, fileName));
          } catch {}
        }

        manifest.push({
          theme,
          accent,
          pageId: p.id,
          pageName: p.name,
          role: p.role,
          fileName,
        });

        process.stdout.write(`  📸 ${p.id} `);
      }
      console.log('');
    }
  }

  // Generate Contact Sheet HTML
  const contactSheetHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>ProctorIQ Phase 24 Accent Matrix Visual Contact Sheet</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #0c0d14; color: #f4efe4; margin: 0; padding: 24px; }
    h1 { font-size: 24px; font-weight: 700; margin-bottom: 8px; }
    p.subtitle { color: #8a889b; margin-top: 0; margin-bottom: 32px; font-size: 14px; }
    .filters { display: flex; gap: 12px; margin-bottom: 24px; flex-wrap: wrap; }
    .btn { background: #1c1d29; border: 1px solid #2e3042; color: #fff; padding: 8px 16px; border-radius: 8px; cursor: pointer; font-size: 13px; font-weight: 600; }
    .btn.active { background: #6366f1; border-color: #6366f1; }
    .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(380px, 1fr)); gap: 24px; }
    .card { background: #161722; border: 1px solid #232534; border-radius: 12px; overflow: hidden; display: flex; flex-direction: column; }
    .card img { width: 100%; height: auto; display: block; border-bottom: 1px solid #232534; aspect-ratio: 16/10; object-fit: cover; }
    .card-meta { padding: 12px 16px; display: flex; justify-content: space-between; align-items: center; }
    .card-title { font-size: 13px; font-weight: 600; color: #fff; }
    .badge { font-size: 10px; font-family: monospace; padding: 2px 8px; border-radius: 4px; font-weight: 600; text-transform: uppercase; }
    .badge-dark { background: #272839; color: #a5b4fc; }
    .badge-light { background: #fbf8f0; color: #92400e; }
  </style>
</head>
<body>
  <h1>ProctorIQ Phase 24: Global Accent System Contact Sheet</h1>
  <p class="subtitle">Visual verification across 5 accents (Indigo, Cyan, Emerald, Amber, Rose) × 2 themes (Dark, Cream Light) × 13 core views (${manifest.length} screenshots).</p>
  <div class="grid">
    ${manifest.map(m => `
      <div class="card" data-theme="${m.theme}" data-accent="${m.accent}">
        <a href="${m.fileName}" target="_blank">
          <img src="${m.fileName}" alt="${m.pageName} (${m.theme} - ${m.accent})" loading="lazy" />
        </a>
        <div class="card-meta">
          <div>
            <div class="card-title">${m.pageName}</div>
            <div style="font-size: 11px; color: #8a889b; text-transform: uppercase; margin-top: 2px;">Role: ${m.role}</div>
          </div>
          <span class="badge ${m.theme === 'dark' ? 'badge-dark' : 'badge-light'}">${m.theme} • ${m.accent}</span>
        </div>
      </div>
    `).join('')}
  </div>
</body>
</html>`;

  fs.writeFileSync(path.join(OUTPUT_DIR, 'contact-sheet.html'), contactSheetHtml);
  fs.writeFileSync(path.join(ARTIFACTS_DIR, 'contact-sheet.html'), contactSheetHtml);
  console.log(`\n🎉 Visual capture complete! Saved ${manifest.length} screenshots to ${OUTPUT_DIR}`);
  console.log(`📄 Contact sheet generated at ${path.join(OUTPUT_DIR, 'contact-sheet.html')}`);

  await browser.close();
}

run().catch((err) => {
  console.error('Error during capture:', err);
  process.exit(1);
});
