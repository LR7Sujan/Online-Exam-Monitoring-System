import { env } from '../config/env.js';
import type { StorageAdapter, StorageProviderName } from './types.js';
import { LocalStorageAdapter } from './localAdapter.js';
import { VercelBlobStorageAdapter } from './blobAdapter.js';
import { S3StorageAdapter } from './s3Adapter.js';

export * from './types.js';
export * from './localAdapter.js';
export * from './blobAdapter.js';
export * from './s3Adapter.js';

let activeAdapter: StorageAdapter | null = null;

/**
 * Returns the active storage adapter singleton based on environment configuration.
 */
export function getStorageAdapter(): StorageAdapter {
  if (activeAdapter) return activeAdapter;

  const provider = env.STORAGE_PROVIDER as StorageProviderName;

  switch (provider) {
    case 'blob':
      activeAdapter = new VercelBlobStorageAdapter();
      break;
    case 's3':
      activeAdapter = new S3StorageAdapter();
      break;
    case 'local':
    default:
      activeAdapter = new LocalStorageAdapter();
      break;
  }

  return activeAdapter;
}

/**
 * Overrides the active storage adapter (useful for testing or switching dynamically).
 */
export function setStorageAdapter(adapter: StorageAdapter | null): void {
  activeAdapter = adapter;
}

/**
 * Normalizes a key with the environment storage prefix (e.g. 'test/' during tests).
 */
export function resolveStorageKey(key: string): string {
  const clean = key.replace(/^\/+/, '');
  const prefix = env.STORAGE_PREFIX || '';
  if (prefix && !clean.startsWith(prefix)) {
    return `${prefix}${clean}`;
  }
  return clean;
}
