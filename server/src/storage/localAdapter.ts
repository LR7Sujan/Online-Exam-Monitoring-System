import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { env } from '../config/env.js';
import type { StorageAdapter, StorageGetResult, StorageItem, StoragePutOptions } from './types.js';

/**
 * Local filesystem storage adapter.
 * Intended strictly for local development and test runs.
 * Refuses to run when NODE_ENV === 'production'.
 */
export class LocalStorageAdapter implements StorageAdapter {
  readonly name = 'local' as const;
  private rootDir: string;

  constructor(rootDir?: string) {
    if (env.NODE_ENV === 'production' || process.env.NODE_ENV === 'production') {
      throw new Error(
        '[SAFETY GUARD VIOLATION] LocalStorageAdapter is strictly prohibited in production. Configure STORAGE_PROVIDER="blob" or "s3".'
      );
    }
    this.rootDir = rootDir ? path.resolve(rootDir) : path.resolve(process.cwd(), env.UPLOADS_DIR);
    if (!fs.existsSync(this.rootDir)) {
      fs.mkdirSync(this.rootDir, { recursive: true });
    }
  }

  private resolvePath(key: string): string {
    const cleanKey = key.replace(/^\/+/, '').replace(/\.\./g, '');
    return path.resolve(this.rootDir, cleanKey);
  }

  async put(key: string, data: Buffer | Uint8Array, _options?: StoragePutOptions): Promise<{ key: string; size: number }> {
    const targetPath = this.resolvePath(key);
    const parentDir = path.dirname(targetPath);
    if (!fs.existsSync(parentDir)) {
      fs.mkdirSync(parentDir, { recursive: true });
    }
    await fs.promises.writeFile(targetPath, Buffer.from(data));
    return { key, size: data.byteLength };
  }

  async get(key: string, range?: { start: number; end?: number }): Promise<StorageGetResult> {
    const targetPath = this.resolvePath(key);
    if (!fs.existsSync(targetPath)) {
      throw new Error(`File not found: ${key}`);
    }
    const stat = await fs.promises.stat(targetPath);
    const totalSize = stat.size;

    let stream: NodeJS.ReadableStream;
    let effectiveSize = totalSize;

    if (range) {
      const start = Math.max(0, range.start);
      const end = range.end !== undefined && range.end < totalSize ? range.end : totalSize - 1;
      effectiveSize = end - start + 1;
      stream = fs.createReadStream(targetPath, { start, end });
    } else {
      stream = fs.createReadStream(targetPath);
    }

    const ext = path.extname(targetPath).toLowerCase();
    const contentType =
      ext === '.jpg' || ext === '.jpeg'
        ? 'image/jpeg'
        : ext === '.png'
          ? 'image/png'
          : ext === '.webp'
            ? 'image/webp'
            : ext === '.webm'
              ? 'video/webm'
              : 'application/octet-stream';

    return {
      stream,
      size: effectiveSize,
      contentType,
    };
  }

  async getSignedUrl(key: string, options?: { expiresInSeconds?: number }): Promise<string> {
    const expiresIn = options?.expiresInSeconds ?? 300;
    const expires = Math.floor(Date.now() / 1000) + expiresIn;
    const cleanKey = key.replace(/^\/+/, '');
    const dataToSign = `${cleanKey}:${expires}`;
    const sig = crypto.createHmac('sha256', env.JWT_SECRET).update(dataToSign).digest('hex');
    return `/api/snapshots/signed?key=${encodeURIComponent(cleanKey)}&expires=${expires}&sig=${sig}`;
  }

  async delete(key: string): Promise<void> {
    const targetPath = this.resolvePath(key);
    if (fs.existsSync(targetPath)) {
      await fs.promises.unlink(targetPath).catch(() => {});
    }
  }

  async deletePrefix(prefix: string): Promise<number> {
    let deleted = 0;
    const cleanPrefix = prefix.replace(/^\/+/, '').replace(/\.\./g, '');
    const targetBase = path.resolve(this.rootDir, cleanPrefix);

    if (!fs.existsSync(targetBase)) {
      return 0;
    }

    const stat = await fs.promises.stat(targetBase);
    if (stat.isDirectory()) {
      const walk = async (dir: string) => {
        const entries = await fs.promises.readdir(dir, { withFileTypes: true });
        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);
          if (entry.isDirectory()) {
            await walk(fullPath);
          } else {
            await fs.promises.unlink(fullPath).catch(() => {});
            deleted++;
          }
        }
      };
      await walk(targetBase);
      await fs.promises.rm(targetBase, { recursive: true, force: true }).catch(() => {});
    } else {
      await fs.promises.unlink(targetBase).catch(() => {});
      deleted++;
    }

    return deleted;
  }

  async list(prefix?: string): Promise<StorageItem[]> {
    const items: StorageItem[] = [];
    if (!fs.existsSync(this.rootDir)) return items;

    const walk = async (currentDir: string) => {
      const entries = await fs.promises.readdir(currentDir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(currentDir, entry.name);
        if (entry.isDirectory()) {
          await walk(fullPath);
        } else if (entry.isFile()) {
          const relKey = path.relative(this.rootDir, fullPath).replace(/\\/g, '/');
          if (!prefix || relKey.startsWith(prefix)) {
            const stat = await fs.promises.stat(fullPath);
            items.push({
              key: relKey,
              size: stat.size,
              lastModified: stat.mtime,
            });
          }
        }
      }
    };

    await walk(this.rootDir);
    return items;
  }

  async exists(key: string): Promise<boolean> {
    const targetPath = this.resolvePath(key);
    return fs.existsSync(targetPath);
  }
}
