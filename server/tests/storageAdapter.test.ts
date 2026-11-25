import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { createApp } from '../src/app.js';
import { env } from '../src/config/env.js';
import { pool, executeSql, testDbConnection } from '../src/config/db.js';
import {
  getStorageAdapter,
  LocalStorageAdapter,
  VercelBlobStorageAdapter,
  S3StorageAdapter,
  resolveStorageKey,
} from '../src/storage/index.js';
import { saveSnapshotImage } from '../src/routes/sessions.routes.js';
import { generateSignedSnapshotUrl } from '../src/services/snapshotSigner.js';
import {
  cleanupExpiredRecordings,
  setLegalHold,
  getRecordingStorageStats,
} from '../src/services/recordingService.js';

function makeToken(payload: { sub: number; email: string; role: 'STUDENT' | 'PROCTOR' | 'ADMIN'; fullName: string }) {
  return jwt.sign(payload, env.JWT_SECRET, { expiresIn: '1h' });
}

describe('StorageAdapter: Object Storage, Snapshots & Recordings', () => {
  const app = createApp();
  let dbAvailable = false;

  const adminToken = makeToken({ sub: 1, email: 'admin@proctoriq.io', role: 'ADMIN', fullName: 'Dr. Elena Vance' });
  const proctorToken = makeToken({ sub: 2, email: 'proctor@proctoriq.io', role: 'PROCTOR', fullName: 'Marcus Sterling' });
  const student1Id = 9101;
  const student2Id = 9102;
  const student1Token = makeToken({ sub: student1Id, email: 'student1@proctoriq.io', role: 'STUDENT', fullName: 'Alice Examinee' });
  const student2Token = makeToken({ sub: student2Id, email: 'student2@proctoriq.io', role: 'STUDENT', fullName: 'Bob Examinee' });

  const testExamId = 910;
  const session1Id = 91001;
  const session2Id = 91002;

  beforeAll(async () => {
    dbAvailable = await testDbConnection();
    if (dbAvailable) {
      try {
        await executeSql(
          'INSERT IGNORE INTO Users (id, email, password_hash, full_name, role) VALUES (?, ?, ?, ?, ?)',
          [student1Id, 's1_store@proctoriq.io', 'hash', 'Alice Examinee', 'STUDENT']
        );
        await executeSql(
          'INSERT IGNORE INTO Users (id, email, password_hash, full_name, role) VALUES (?, ?, ?, ?, ?)',
          [student2Id, 's2_store@proctoriq.io', 'hash', 'Bob Examinee', 'STUDENT']
        );
        await executeSql(
          'INSERT IGNORE INTO Exams (id, title, duration_minutes, min_trust_score, created_by) VALUES (?, ?, ?, ?, ?)',
          [testExamId, 'Storage Adapter Test Exam', 60, 50, 1]
        );
        await executeSql(
          `INSERT IGNORE INTO Exam_Sessions (id, exam_id, student_id, trust_score, status, started_at, server_deadline)
           VALUES (?, ?, ?, 100, 'IN_PROGRESS', NOW(), DATE_ADD(NOW(), INTERVAL 60 MINUTE))`,
          [session1Id, testExamId, student1Id]
        );
        await executeSql(
          `INSERT IGNORE INTO Exam_Sessions (id, exam_id, student_id, trust_score, status, started_at, server_deadline)
           VALUES (?, ?, ?, 100, 'IN_PROGRESS', NOW(), DATE_ADD(NOW(), INTERVAL 60 MINUTE))`,
          [session2Id, testExamId, student2Id]
        );
      } catch (err) {
        console.warn('[StorageTest] Setup warning:', err);
      }
    }
  });

  afterAll(async () => {
    // Clean up test storage objects
    const adapter = getStorageAdapter();
    await adapter.deletePrefix('test/').catch(() => {});
    await adapter.deletePrefix('snapshots/').catch(() => {});
    await adapter.deletePrefix('recordings/').catch(() => {});

    if (dbAvailable) {
      try {
        await executeSql('DELETE FROM Recording_Access_Log WHERE recording_id IN (SELECT recording_id FROM Exam_Recordings WHERE session_id IN (?, ?))', [session1Id, session2Id]);
        await executeSql('DELETE FROM Recording_Notes WHERE recording_id IN (SELECT recording_id FROM Exam_Recordings WHERE session_id IN (?, ?))', [session1Id, session2Id]);
        await executeSql('DELETE FROM Exam_Recordings WHERE session_id IN (?, ?)', [session1Id, session2Id]);
        await executeSql('DELETE FROM Exam_Sessions WHERE id IN (?, ?)', [session1Id, session2Id]);
        await executeSql('DELETE FROM Exams WHERE id = ?', [testExamId]);
        await executeSql('DELETE FROM Users WHERE id IN (?, ?)', [student1Id, student2Id]);
      } catch {
        // ignore teardown error
      }
    }
  });

  // ==========================================================================
  // 1. StorageAdapter Interface & Provider Contracts
  // ==========================================================================
  describe('1. StorageAdapter Interface & Providers', () => {
    it('LocalStorageAdapter enforces production safety guard and rejects NODE_ENV=production', () => {
      const origEnv = process.env.NODE_ENV;
      try {
        process.env.NODE_ENV = 'production';
        expect(() => new LocalStorageAdapter()).toThrow(/SAFETY GUARD VIOLATION/);
      } finally {
        process.env.NODE_ENV = origEnv;
      }
    });

    it('LocalStorageAdapter successfully puts, gets, lists, checks existence, and deletes objects', async () => {
      const adapter = new LocalStorageAdapter();
      const testKey = resolveStorageKey('unit_test_sample.txt');
      const testContent = Buffer.from('ProctorIQ Zero-Disk Serverless Architecture');

      // Put
      const putResult = await adapter.put(testKey, testContent, { contentType: 'text/plain' });
      expect(putResult.key).toBe(testKey);
      expect(putResult.size).toBe(testContent.length);

      // Exists
      const exists = await adapter.exists(testKey);
      expect(exists).toBe(true);

      // Get
      const getResult = await adapter.get(testKey);
      expect(getResult.size).toBe(testContent.length);
      const chunks: Buffer[] = [];
      for await (const chunk of getResult.stream) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      }
      expect(Buffer.concat(chunks).toString('utf8')).toBe('ProctorIQ Zero-Disk Serverless Architecture');

      // List
      const items = await adapter.list(resolveStorageKey('unit_test'));
      expect(items.some((item) => item.key === testKey)).toBe(true);

      // Delete
      await adapter.delete(testKey);
      expect(await adapter.exists(testKey)).toBe(false);
    });

    it('VercelBlobStorageAdapter exposes StorageAdapter interface with "blob" provider name', () => {
      const blobAdapter = new VercelBlobStorageAdapter('mock_vercel_blob_rw_token');
      expect(blobAdapter.name).toBe('blob');
      expect(typeof blobAdapter.put).toBe('function');
      expect(typeof blobAdapter.get).toBe('function');
      expect(typeof blobAdapter.delete).toBe('function');
    });

    it('S3StorageAdapter exposes StorageAdapter interface with "s3" provider name', () => {
      const s3Adapter = new S3StorageAdapter({
        bucket: 'test-bucket',
        accessKeyId: 'mock-key',
        secretAccessKey: 'mock-secret',
      });
      expect(s3Adapter.name).toBe('s3');
      expect(typeof s3Adapter.put).toBe('function');
      expect(typeof s3Adapter.get).toBe('function');
      expect(typeof s3Adapter.delete).toBe('function');
    });
  });

  // ==========================================================================
  // 2. Snapshot Upload, Serving, RBAC, IDOR & Signed URLs
  // ==========================================================================
  describe('2. Snapshot Upload, Access Control & Expiry', () => {
    let savedStorageKey: string;
    const tinyValidJpegBase64 =
      '/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=';

    beforeAll(async () => {
      const result = await saveSnapshotImage(session1Id, `data:image/jpeg;base64,${tinyValidJpegBase64}`);
      expect(result).toBeTruthy();
      savedStorageKey = result!;
    });

    it('stores the snapshot in object storage behind a storage key without local file path', async () => {
      const adapter = getStorageAdapter();
      expect(await adapter.exists(savedStorageKey)).toBe(true);
      expect(savedStorageKey).not.toContain('\\');
    });

    it('allows PROCTOR and ADMIN to access the snapshot via /api/snapshots/:key', async () => {
      // Proctor access
      const proctorRes = await request(app)
        .get(`/api/snapshots/${savedStorageKey}`)
        .set('Authorization', `Bearer ${proctorToken}`);
      expect(proctorRes.status).toBe(200);
      expect(proctorRes.headers['content-type']).toContain('image/jpeg');

      // Admin access
      const adminRes = await request(app)
        .get(`/api/snapshots/${savedStorageKey}`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(adminRes.status).toBe(200);
    });

    it('allows student examinee to access their own session snapshot via /api/snapshots/:key', async () => {
      if (!dbAvailable) return;
      const res = await request(app)
        .get(`/api/snapshots/${savedStorageKey}`)
        .set('Authorization', `Bearer ${student1Token}`);
      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('image/jpeg');
    });

    it('strictly rejects another student from viewing the snapshot (IDOR 403 Forbidden)', async () => {
      if (!dbAvailable) return;
      const res = await request(app)
        .get(`/api/snapshots/${savedStorageKey}`)
        .set('Authorization', `Bearer ${student2Token}`);
      expect(res.status).toBe(403);
      expect(res.body.error?.code).toBe('FORBIDDEN');
    });

    it('rejects unauthenticated requests to view snapshot (401 Unauthorized)', async () => {
      const res = await request(app).get(`/api/snapshots/${savedStorageKey}`);
      expect(res.status).toBe(401);
      expect(res.body.error?.code).toBe('UNAUTHORIZED_SNAPSHOT_ACCESS');
    });

    it('allows access via valid HMAC-signed snapshot URL (/api/snapshots/signed)', async () => {
      const signedUrl = generateSignedSnapshotUrl(savedStorageKey, 1234, 300);
      expect(signedUrl).toBeTruthy();

      const res = await request(app).get(signedUrl!);
      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('image/jpeg');
    });

    it('rejects expired signed snapshot URLs (401 EXPIRED_SNAPSHOT_URL)', async () => {
      // Generate URL expired 10 seconds ago
      const expiredUrl = generateSignedSnapshotUrl(savedStorageKey, 1234, -10);
      expect(expiredUrl).toBeTruthy();

      const res = await request(app).get(expiredUrl!);
      expect(res.status).toBe(401);
      expect(res.body.error?.code).toBe('EXPIRED_SNAPSHOT_URL');
    });

    it('rejects tampered signed snapshot URLs (401 INVALID_SNAPSHOT_SIGNATURE)', async () => {
      const validUrl = generateSignedSnapshotUrl(savedStorageKey, 1234, 300)!;
      const tamperedUrl = validUrl.replace(/sig=[a-f0-9]{6}/, 'sig=000000');

      const res = await request(app).get(tamperedUrl);
      expect(res.status).toBe(401);
      expect(res.body.error?.code).toBe('INVALID_SNAPSHOT_SIGNATURE');
    });
  });

  // ==========================================================================
  // 3. Option (b) Recording Lifecycle: Upload, Range Stream, 2x Playback & Retention
  // ==========================================================================
  describe('3. Option (b) Recording Lifecycle & Range Streaming', () => {
    let recordingId: number;
    const testVideoBuffer = Buffer.from(
      '0123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890123456789' // 100 bytes
    );

    it('uploads a complete WebM video directly into object storage via Option (b)', async () => {
      if (!dbAvailable) return;
      const res = await request(app)
        .post(`/api/sessions/${session1Id}/recording/upload?durationMs=15000`)
        .set('Authorization', `Bearer ${student1Token}`)
        .set('Content-Type', 'video/webm')
        .send(testVideoBuffer);

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('READY');
      expect(res.body.data.durationMs).toBe(15000);
      expect(res.body.data.sizeBytes).toBe(testVideoBuffer.length);
      recordingId = res.body.data.recordingId;
      expect(recordingId).toBeGreaterThan(0);
    });

    it('serves video stream with HTTP 206 Partial Content Range support (seeking / 2x speed)', async () => {
      if (!dbAvailable) return;
      // Seek from byte 20 to 60 (simulating scrubber scrub and accelerated chunk buffering)
      const res = await request(app)
        .get(`/api/recordings/${recordingId}/stream`)
        .set('Authorization', `Bearer ${proctorToken}`)
        .set('Range', 'bytes=20-60');

      expect(res.status).toBe(206);
      expect(res.headers['content-range']).toBe(`bytes 20-60/${testVideoBuffer.length}`);
      expect(res.headers['content-length']).toBe('41');
      expect(res.headers['accept-ranges']).toBe('bytes');
      expect(res.body.length).toBe(41);
    });

    it('records view action in Recording_Access_Log during streaming', async () => {
      if (!dbAvailable) return;
      const logs = await pool.query(
        'SELECT * FROM Recording_Access_Log WHERE recording_id = ? ORDER BY log_id DESC LIMIT 1',
        [recordingId]
      );
      const rows = (logs[0] as unknown[]) ?? [];
      expect(rows.length).toBe(1);
    });

    it('allows Admin to download video stream and logs DOWNLOAD action', async () => {
      if (!dbAvailable) return;
      const res = await request(app)
        .get(`/api/recordings/${recordingId}/download`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.headers['content-disposition']).toContain('attachment; filename=');
      expect(res.body.length).toBe(testVideoBuffer.length);

      const dlLogs = await pool.query(
        "SELECT * FROM Recording_Access_Log WHERE recording_id = ? AND action = 'DOWNLOAD'",
        [recordingId]
      );
      const rows = (dlLogs[0] as unknown[]) ?? [];
      expect(rows.length).toBe(1);
    });

    it('protects recording from retention cleanup when legal hold is enabled', async () => {
      if (!dbAvailable) return;
      // Set legal hold
      await setLegalHold(recordingId, true);

      // Expire recording timestamp manually
      await executeSql('UPDATE Exam_Recordings SET expires_at = DATE_SUB(NOW(), INTERVAL 1 DAY) WHERE recording_id = ?', [recordingId]);

      // Run cleanup
      const deletedCount = await cleanupExpiredRecordings();
      expect(deletedCount).toBe(0);

      // Verify recording still exists in database and storage
      const stats = await getRecordingStorageStats();
      expect(stats.recordingsCount).toBeGreaterThanOrEqual(1);

      // Release legal hold
      await setLegalHold(recordingId, false);
    });

    it('deletes both object storage file and database row upon expiration cleanup', async () => {
      if (!dbAvailable) return;
      const adapter = getStorageAdapter();
      const recRows = await pool.query(
        'SELECT file_path FROM Exam_Recordings WHERE recording_id = ?',
        [recordingId]
      );
      const filePath = (recRows[0] as Array<{ file_path: string }>)[0]?.file_path;
      expect(filePath).toBeTruthy();
      expect(await adapter.exists(filePath)).toBe(true);

      // Run retention cleanup now that legal hold is false and expires_at is past
      const deletedCount = await cleanupExpiredRecordings();
      expect(deletedCount).toBe(1);

      // Verify row is deleted
      const checkRows = await pool.query('SELECT * FROM Exam_Recordings WHERE recording_id = ?', [recordingId]);
      expect(((checkRows[0] as unknown[]) ?? []).length).toBe(0);

      // Verify storage file is deleted
      expect(await adapter.exists(filePath)).toBe(false);
    });
  });
});
