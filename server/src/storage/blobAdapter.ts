import { Readable } from 'node:stream';
import { put, del, list } from '@vercel/blob';
import { env } from '../config/env.js';
import type { StorageAdapter, StorageGetResult, StorageItem, StoragePutOptions } from './types.js';

/**
 * Vercel Blob Storage Adapter.
 * Uses official @vercel/blob client for zero-filesystem serverless execution.
 */
export class VercelBlobStorageAdapter implements StorageAdapter {
  readonly name = 'blob' as const;
  private token?: string;

  constructor(token?: string) {
    this.token = token || env.BLOB_READ_WRITE_TOKEN;
  }

  private getOptions() {
    return this.token ? { token: this.token } : undefined;
  }

  async put(key: string, data: Buffer | Uint8Array, options?: StoragePutOptions): Promise<{ key: string; size: number }> {
    const cleanKey = key.replace(/^\/+/, '');
    const blob = await put(cleanKey, Buffer.from(data), {
      access: 'public', // Vercel Blob access flag
      addRandomSuffix: options?.addRandomSuffix ?? false,
      contentType: options?.contentType,
      ...this.getOptions(),
    });

    return {
      key: blob.pathname,
      size: data.byteLength,
    };
  }

  async get(key: string, range?: { start: number; end?: number }): Promise<StorageGetResult> {
    const cleanKey = key.replace(/^\/+/, '');
    const { blobs } = await list({
      prefix: cleanKey,
      limit: 1,
      ...this.getOptions(),
    });

    const match = blobs.find((b) => b.pathname === cleanKey) || blobs[0];
    if (!match) {
      throw new Error(`Blob not found for key: ${key}`);
    }

    const headers: Record<string, string> = {};
    if (range) {
      const endPart = range.end !== undefined ? range.end : '';
      headers['Range'] = `bytes=${range.start}-${endPart}`;
    }

    const response = await fetch(match.url, { headers });
    if (!response.ok && response.status !== 206) {
      throw new Error(`Failed to fetch blob: ${response.status} ${response.statusText}`);
    }

    const contentLength = Number(response.headers.get('content-length') || match.size || 0);
    const contentType = response.headers.get('content-type') || 'application/octet-stream';

    if (!response.body) {
      throw new Error('Response body stream is empty');
    }

    // Convert Web ReadableStream to Node.js ReadableStream
    const nodeStream = Readable.fromWeb(response.body as import('node:stream/web').ReadableStream);

    return {
      stream: nodeStream,
      size: contentLength,
      contentType,
    };
  }

  async getSignedUrl(key: string, _options?: { expiresInSeconds?: number }): Promise<string> {
    const cleanKey = key.replace(/^\/+/, '');
    const { blobs } = await list({
      prefix: cleanKey,
      limit: 1,
      ...this.getOptions(),
    });
    const match = blobs.find((b) => b.pathname === cleanKey) || blobs[0];
    if (match) {
      return match.url;
    }
    return `/api/snapshots/${cleanKey}`;
  }

  async delete(key: string): Promise<void> {
    const cleanKey = key.replace(/^\/+/, '');
    const { blobs } = await list({
      prefix: cleanKey,
      limit: 1,
      ...this.getOptions(),
    });
    const match = blobs.find((b) => b.pathname === cleanKey) || blobs[0];
    if (match) {
      await del(match.url, this.getOptions());
    }
  }

  async deletePrefix(prefix: string): Promise<number> {
    const cleanPrefix = prefix.replace(/^\/+/, '');
    const { blobs } = await list({
      prefix: cleanPrefix,
      limit: 1000,
      ...this.getOptions(),
    });

    if (blobs.length === 0) return 0;
    const urls = blobs.map((b) => b.url);
    await del(urls, this.getOptions());
    return urls.length;
  }

  async list(prefix?: string): Promise<StorageItem[]> {
    const cleanPrefix = prefix ? prefix.replace(/^\/+/, '') : undefined;
    const { blobs } = await list({
      prefix: cleanPrefix,
      limit: 1000,
      ...this.getOptions(),
    });

    return blobs.map((b) => ({
      key: b.pathname,
      size: b.size,
      lastModified: new Date(b.uploadedAt),
    }));
  }

  async exists(key: string): Promise<boolean> {
    const cleanKey = key.replace(/^\/+/, '');
    try {
      const { blobs } = await list({
        prefix: cleanKey,
        limit: 1,
        ...this.getOptions(),
      });
      return blobs.some((b) => b.pathname === cleanKey);
    } catch {
      return false;
    }
  }
}
