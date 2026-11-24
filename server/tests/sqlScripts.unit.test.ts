import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { parseSqlScript } from '../src/scripts/initDb.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dbDir = path.resolve(__dirname, '../../db');

test('001_init.sql equals schema.sql unchanged and parses cleanly', () => {
  const schemaText = readFileSync(path.join(dbDir, 'schema.sql'), 'utf8');
  const initText = readFileSync(path.join(dbDir, 'migrations/001_init.sql'), 'utf8');
  assert.equal(initText, schemaText);

  const stmts = parseSqlScript(initText);
  assert.ok(stmts.length > 20);
  assert.ok(stmts.some((s) => s.includes('CREATE TRIGGER trg_after_violation_insert')));
  assert.ok(stmts.some((s) => s.includes('CREATE PROCEDURE sp_SubmitAndGradeExam')));
});

test('002_improvements.sql parses cleanly and defines required triggers, procedure, column, and views', () => {
  const migText = readFileSync(path.join(dbDir, 'migrations/002_improvements.sql'), 'utf8');
  const stmts = parseSqlScript(migText);

  assert.ok(stmts.some((s) => s.includes('ADD COLUMN needs_reinstatement BOOLEAN')));
  assert.ok(stmts.some((s) => s.includes('CREATE TRIGGER trg_before_log_delete')));
  assert.ok(stmts.some((s) => s.includes('CREATE TRIGGER trg_before_log_update')));
  assert.ok(stmts.some((s) => s.includes('CREATE TRIGGER trg_after_review_update')));
  assert.ok(stmts.some((s) => s.includes('CREATE PROCEDURE sp_AutoTimeoutExpiredSessions')));
  assert.ok(stmts.some((s) => s.includes('CREATE VIEW vw_ExamAnalytics')));
  assert.ok(stmts.some((s) => s.includes('CREATE VIEW vw_ViolationHeatmap')));
});

test('seed.sql parses cleanly with exact seeded entity counts', () => {
  const seedText = readFileSync(path.join(dbDir, 'seed.sql'), 'utf8');
  const stmts = parseSqlScript(seedText);

  const adminMatches = seedText.match(/'ADMIN'/g) ?? [];
  const proctorMatches = seedText.match(/'PROCTOR'/g) ?? [];
  const studentMatches = seedText.match(/'STUDENT'/g) ?? [];
  const logInserts = stmts.filter((s) => s.startsWith('INSERT INTO Proctoring_Logs'));
  const spCalls = stmts.filter((s) => s.startsWith('CALL sp_SubmitAndGradeExam'));

  assert.equal(adminMatches.length, 1);
  assert.equal(proctorMatches.length, 3);
  assert.equal(studentMatches.length, 60);
  assert.equal(logInserts.length, 300);
  assert.equal(spCalls.length, 40);
});

