/**
 * IndexedDB Queue for Video Recording Chunks
 * Guarantees chunk persistence across network drops and page reloads.
 */

const DB_NAME = 'proctoriq_recording_db';
const DB_VERSION = 1;
const STORE_NAME = 'recording_chunks';

interface StoredChunk {
  id?: number;
  sessionId: number;
  chunkIndex: number;
  blob: Blob;
  status: 'PENDING' | 'UPLOADING' | 'UPLOADED' | 'FAILED';
  createdAt: number;
  retryCount: number;
}

function openRecordingDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      reject(new Error('IndexedDB not supported in this environment'));
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, {
          keyPath: 'id',
          autoIncrement: true,
        });
        store.createIndex('by_session_chunk', ['sessionId', 'chunkIndex'], { unique: true });
        store.createIndex('by_session_status', ['sessionId', 'status'], { unique: false });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Enqueues a video chunk into IndexedDB.
 */
export async function enqueueChunk(sessionId: number, chunkIndex: number, blob: Blob): Promise<void> {
  const db = await openRecordingDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const index = store.index('by_session_chunk');

    const getReq = index.get([sessionId, chunkIndex]);
    getReq.onsuccess = () => {
      const existing = getReq.result as StoredChunk | undefined;
      if (existing) {
        existing.blob = blob;
        existing.status = 'PENDING';
        existing.createdAt = Date.now();
        store.put(existing);
      } else {
        store.add({
          sessionId,
          chunkIndex,
          blob,
          status: 'PENDING',
          createdAt: Date.now(),
          retryCount: 0,
        });
      }
    };

    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/**
 * Uploads a single chunk via PUT /api/sessions/:sessionId/recording/chunks/:chunkIndex.
 */
async function uploadChunkItem(chunk: StoredChunk, token: string): Promise<boolean> {
  try {
    const response = await fetch(`/api/sessions/${chunk.sessionId}/recording/chunks/${chunk.chunkIndex}`, {
      method: 'PUT',
      headers: {
        'Content-Type': chunk.blob.type || 'video/webm',
        Authorization: `Bearer ${token}`,
      },
      body: chunk.blob,
    });

    return response.ok;
  } catch (err) {
    console.warn(`[RecordingQueue] Failed to upload chunk ${chunk.chunkIndex}:`, err);
    return false;
  }
}

/**
 * Flushes all pending chunks for a session in sequential numerical order.
 */
export async function flushAllChunks(sessionId: number, token: string): Promise<number> {
  const db = await openRecordingDb();

  const getPending = (): Promise<StoredChunk[]> => {
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.getAll();

      req.onsuccess = () => {
        const all = (req.result as StoredChunk[]) || [];
        const sessionPending = all
          .filter((c) => c.sessionId === sessionId && c.status !== 'UPLOADED')
          .sort((a, b) => a.chunkIndex - b.chunkIndex);
        resolve(sessionPending);
      };
      req.onerror = () => reject(req.error);
    });
  };

  const pendingList = await getPending();
  let uploadedCount = 0;

  for (const chunk of pendingList) {
    const success = await uploadChunkItem(chunk, token);
    if (success) {
      uploadedCount++;
      // Mark as UPLOADED or delete from DB
      await new Promise<void>((resolve) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        if (chunk.id) store.delete(chunk.id);
        tx.oncomplete = () => resolve();
      });
    } else {
      console.warn(`[RecordingQueue] Stopping flush queue: chunk ${chunk.chunkIndex} failed.`);
      break;
    }
  }

  return uploadedCount;
}

/**
 * Retrieves all chunks for a session sorted in sequential numerical order.
 */
export async function getAllSessionChunkBlobs(sessionId: number): Promise<Blob[]> {
  try {
    const db = await openRecordingDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.getAll();

      req.onsuccess = () => {
        const all = (req.result as StoredChunk[]) || [];
        const sessionChunks = all
          .filter((c) => c.sessionId === sessionId)
          .sort((a, b) => a.chunkIndex - b.chunkIndex)
          .map((c) => c.blob);
        resolve(sessionChunks);
      };
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn('[RecordingQueue] Failed to get session chunks:', err);
    return [];
  }
}

/**
 * Clears stored chunks for a session after successful finalization.
 */
export async function clearSessionChunks(sessionId: number): Promise<void> {
  try {
    const db = await openRecordingDb();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const req = store.getAll();

    req.onsuccess = () => {
      const all = (req.result as StoredChunk[]) || [];
      for (const item of all) {
        if (item.sessionId === sessionId && item.id) {
          store.delete(item.id);
        }
      }
    };
  } catch (err) {
    console.warn('[RecordingQueue] Error clearing session chunks:', err);
  }
}
