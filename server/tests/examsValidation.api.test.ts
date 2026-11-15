import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { pool } from '../src/config/db.js';

describe('Exams Validation & Publish Rules API Tests', () => {
  const app = createApp();

  let adminToken: string;

  beforeAll(async () => {
    // 1. Admin login
    const adminRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@proctoriq.io', password: 'ProctorIQ#2026' });
    expect(adminRes.status).toBe(200);
    adminToken = adminRes.body.data.token;
  });

  afterAll(async () => {
    await pool.end();
  });

  it('1. POST /api/exams creates a draft with only title (is_published: false)', async () => {
    const res = await request(app)
      .post('/api/exams')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        title: 'Draft Assessment Only Title',
        isPublished: false,
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.title).toBe('Draft Assessment Only Title');
    expect(res.body.data.is_published).toBeFalsy();
    expect(res.body.data.duration_minutes).toBe(60);
  });

  it('2. POST /api/exams rejects empty title', async () => {
    const res = await request(app)
      .post('/api/exams')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        title: '   ',
        isPublished: false,
      });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('3. POST /api/exams published rejects missing or short syllabus (< 20 chars)', async () => {
    const res = await request(app)
      .post('/api/exams')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        title: 'Validation Test Exam',
        description: 'Short desc', // only 10 chars
        durationMinutes: 60,
        minTrustScore: 50,
        startWindow: new Date(Date.now() - 3600000).toISOString(),
        endWindow: new Date(Date.now() + 7200000).toISOString(),
        isPublished: true,
        questions: [
          {
            questionText: 'Valid Question Text Here',
            optionA: 'Option 1',
            optionB: 'Option 2',
            correctOption: 'A',
            marks: 2,
          },
        ],
      });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    const details = res.body.error.details;
    expect(details?.fieldErrors?.description?.length).toBeGreaterThan(0);
    expect(details.fieldErrors.description[0]).toContain('at least 20 characters');
  });

  it('4. POST /api/exams published rejects invalid window (end <= start)', async () => {
    const now = new Date();
    const res = await request(app)
      .post('/api/exams')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        title: 'Validation Test Exam',
        description: 'Comprehensive exam syllabus that has more than 20 characters',
        durationMinutes: 60,
        minTrustScore: 50,
        startWindow: new Date(now.getTime() + 7200000).toISOString(),
        endWindow: new Date(now.getTime() + 3600000).toISOString(), // earlier than start!
        isPublished: true,
        questions: [
          {
            questionText: 'Valid Question Text Here',
            optionA: 'Option 1',
            optionB: 'Option 2',
            correctOption: 'A',
            marks: 2,
          },
        ],
      });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    const details = res.body.error.details;
    expect(details?.fieldErrors?.endWindow?.length).toBeGreaterThan(0);
    expect(details.fieldErrors.endWindow[0]).toContain('after start window');
  });

  it('5. POST /api/exams published rejects window shorter than duration', async () => {
    const now = new Date();
    const res = await request(app)
      .post('/api/exams')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        title: 'Validation Test Exam',
        description: 'Comprehensive exam syllabus that has more than 20 characters',
        durationMinutes: 120, // 2 hours duration
        minTrustScore: 50,
        startWindow: now.toISOString(),
        endWindow: new Date(now.getTime() + 30 * 60 * 1000).toISOString(), // only 30 min window!
        isPublished: true,
        questions: [
          {
            questionText: 'Valid Question Text Here',
            optionA: 'Option 1',
            optionB: 'Option 2',
            correctOption: 'A',
            marks: 2,
          },
        ],
      });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    const details = res.body.error.details;
    expect(details?.fieldErrors?.endWindow?.length).toBeGreaterThan(0);
    expect(details.fieldErrors.endWindow[0]).toContain('must be at least equal to exam duration');
  });

  it('6. POST /api/exams published rejects zero questions', async () => {
    const now = new Date();
    const res = await request(app)
      .post('/api/exams')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        title: 'Validation Test Exam',
        description: 'Comprehensive exam syllabus that has more than 20 characters',
        durationMinutes: 60,
        minTrustScore: 50,
        startWindow: now.toISOString(),
        endWindow: new Date(now.getTime() + 3600000 * 3).toISOString(),
        isPublished: true,
        questions: [],
      });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    const details = res.body.error.details;
    expect(details?.fieldErrors?.questions?.length).toBeGreaterThan(0);
    expect(details.fieldErrors.questions[0]).toContain('At least 1 question is required');
  });

  it('7. POST /api/exams published rejects question where correctOption points to empty option', async () => {
    const now = new Date();
    const res = await request(app)
      .post('/api/exams')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        title: 'Validation Test Exam',
        description: 'Comprehensive exam syllabus that has more than 20 characters',
        durationMinutes: 60,
        minTrustScore: 50,
        startWindow: now.toISOString(),
        endWindow: new Date(now.getTime() + 3600000 * 3).toISOString(),
        isPublished: true,
        questions: [
          {
            questionText: 'What is ACID?',
            optionA: 'Option A',
            optionB: 'Option B',
            optionC: '', // Empty option C!
            correctOption: 'C', // But correctOption is C!
            marks: 2,
          },
        ],
      });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('8. POST /api/exams published succeeds with all valid fields & valid question', async () => {
    const now = new Date();
    const res = await request(app)
      .post('/api/exams')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        title: 'Valid Published Assessment',
        description: 'Comprehensive exam syllabus that has more than 20 characters for ACID verification',
        durationMinutes: 60,
        minTrustScore: 50,
        startWindow: now.toISOString(),
        endWindow: new Date(now.getTime() + 3600000 * 4).toISOString(),
        isPublished: true,
        questions: [
          {
            questionText: 'What does the ACID acronym stand for?',
            optionA: 'Atomicity Consistency Isolation Durability',
            optionB: 'Automated Centralized Integrated Data',
            optionC: 'Array Cluster Index Database',
            optionD: 'Access Control Identity Domain',
            correctOption: 'A',
            marks: 2,
          },
        ],
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.is_published).toBeTruthy();
  });

  it('9. PATCH /api/exams/:id/publish rejects incomplete draft with 400 and fieldErrors', async () => {
    // Create incomplete draft
    const draftRes = await request(app)
      .post('/api/exams')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        title: 'Incomplete Draft For Publish Test',
        isPublished: false,
      });
    expect(draftRes.status).toBe(201);
    const examId = draftRes.body.data.id;

    // Try to publish via publish endpoint
    const pubRes = await request(app)
      .patch(`/api/exams/${examId}/publish`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(pubRes.status).toBe(400);
    expect(pubRes.body.success).toBe(false);
    expect(pubRes.body.error.code).toBe('VALIDATION_ERROR');
    expect(pubRes.body.error.details?.fieldErrors).toBeDefined();
    expect(pubRes.body.error.details.fieldErrors.description).toBeDefined();
    expect(pubRes.body.error.details.fieldErrors.questions).toBeDefined();
  });

  it('10. PATCH /api/exams/:id/publish succeeds after filling syllabus and question', async () => {
    // Create draft
    const draftRes = await request(app)
      .post('/api/exams')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        title: 'Draft Ready To Be Published',
        isPublished: false,
      });
    const examId = draftRes.body.data.id;

    // Update with complete details
    const now = new Date();
    await request(app)
      .patch(`/api/exams/${examId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        description: 'Comprehensive exam syllabus that has more than 20 characters for integrity check',
        durationMinutes: 45,
        minTrustScore: 60,
        startWindow: now.toISOString(),
        endWindow: new Date(now.getTime() + 3600000 * 3).toISOString(),
      });

    // Add a question
    await request(app)
      .post(`/api/exams/${examId}/questions`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        questionText: 'Which isolation level prevents dirty reads?',
        optionA: 'READ UNCOMMITTED',
        optionB: 'READ COMMITTED',
        optionC: 'REPEATABLE READ',
        optionD: 'SERIALIZABLE',
        correctOption: 'B',
        marks: 2,
      });

    // Now publish
    const pubRes = await request(app)
      .patch(`/api/exams/${examId}/publish`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(pubRes.status).toBe(200);
    expect(pubRes.body.success).toBe(true);
    expect(pubRes.body.data.is_published).toBeTruthy();
  });

  it('11. PATCH /api/exams/:id with { isPublished: true } on incomplete exam returns 400', async () => {
    const draftRes = await request(app)
      .post('/api/exams')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        title: 'Another Incomplete Draft',
        isPublished: false,
      });
    const examId = draftRes.body.data.id;

    const res = await request(app)
      .patch(`/api/exams/${examId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        isPublished: true,
      });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error.details?.fieldErrors).toBeDefined();
  });
});
