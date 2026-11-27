#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const clientSrc = path.join(rootDir, 'client', 'src');

const ALLOWED_FILES = new Set([
  path.normalize(path.join(clientSrc, 'styles', 'accents.css')),
  path.normalize(path.join(clientSrc, 'pages', 'styleguide', 'sections', 'TokensSection.tsx')),
]);

const FORBIDDEN_PATTERNS = [
  { regex: /#6366[Ff]1/g, name: 'Indigo brand hex #6366F1' },
  { regex: /#8[Bb]5[Cc][Ff]6/g, name: 'Violet brand hex #8B5CF6' },
  { regex: /#[Dd]946[Ee][Ff]/g, name: 'Fuchsia brand hex #D946EF' },
  { regex: /\b(?:text|bg|border|from|via|to|ring|shadow)-indigo-\d+\b/g, name: 'Tailwind indigo utility' },
  { regex: /\b(?:text|bg|border|from|via|to|ring|shadow)-violet-\d+\b/g, name: 'Tailwind violet utility' },
  { regex: /\b(?:text|bg|border|from|via|to|ring|shadow)-fuchsia-\d+\b/g, name: 'Tailwind fuchsia utility' },
  { regex: /\b(?:text|bg|border|from|via|to|ring|shadow)-purple-\d+\b/g, name: 'Tailwind purple utility' },
];

const violations = [];

function scanDir(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== 'node_modules' && entry.name !== 'dist') {
        scanDir(fullPath);
      }
    } else if (/\.(tsx|ts|css|html)$/.test(entry.name)) {
      if (ALLOWED_FILES.has(path.normalize(fullPath))) {
        continue;
      }
      const content = fs.readFileSync(fullPath, 'utf8');
      const lines = content.split('\n');
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        for (const pattern of FORBIDDEN_PATTERNS) {
          // Reset regex state in case of global flag
          pattern.regex.lastIndex = 0;
          if (pattern.regex.test(line)) {
            violations.push({
              file: path.relative(rootDir, fullPath),
              lineNum: i + 1,
              rule: pattern.name,
              snippet: line.trim(),
            });
          }
        }
      }
    }
  }
}

scanDir(clientSrc);

if (violations.length > 0) {
  console.error('\n❌ BRAND TOKEN VIOLATIONS FOUND:');
  console.error('Use CSS accent variables (var(--accent), var(--accent-from), etc.) instead of hardcoded brand colors.');
  for (const v of violations) {
    console.error(`  - ${v.file}:${v.lineNum} [${v.rule}]: ${v.snippet}`);
  }
  process.exit(1);
} else {
  console.log('✅ Global accent token compliance check passed! Zero hardcoded brand colors found outside token definitions.');
  process.exit(0);
}
