import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  DeleteObjectsCommand,
  ListObjectsV2Command,
  HeadObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { env } from '../config/env.js';
import type { StorageAdapter, StorageGetResult, StorageItem, StoragePutOptions } from './types.js';

/**
 * AWS S3 and Cloudflare R2 Storage Adapter.
 */
export class S3StorageAdapter implements StorageAdapter {
  readonly name = 's3' as const;
  private client: S3Client;
  private bucket: string;

  constructor(config?: {
    bucket?: string;
    region?: string;
    endpoint?: string;
    accessKeyId?: string;
    secretAccessKey?: string;
    forcePathStyle?: boolean;
  }) {
    this.bucket = config?.bucket || env.S3_BUCKET || 'proctoriq-evidence';
    const credentials =
      config?.accessKeyId && config?.secretAccessKey
        ? { accessKeyId: config.accessKeyId, secretAccessKey: config.secretAccessKey }
        : env.S3_ACCESS_KEY_ID && env.S3_SECRET_ACCESS_KEY
          ? { accessKeyId: env.S3_ACCESS_KEY_ID, secretAccessKey: env.S3_SECRET_ACCESS_KEY }
          : undefined;

    this.client = new S3Client({
      region: config?.region || env.S3_REGION || 'auto',
      endpoint: config?.endpoint || env.S3_ENDPOINT || undefined,
      credentials,
      forcePathStyle: config?.forcePathStyle ?? env.S3_FORCE_PATH_STYLE ?? true,
    });
  }

  async put(key: string, data: Buffer | Uint8Array, options?: StoragePutOptions): Promise<{ key: string; size: number }> {
    const cleanKey = key.replace(/^\/+/, '');
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: cleanKey,
        Body: data,
        ContentType: options?.contentType || 'application/octet-stream',
      })
    );
    return { key: cleanKey, size: data.byteLength };
  }

  async get(key: string, range?: { start: number; end?: number }): Promise<StorageGetResult> {
    const cleanKey = key.replace(/^\/+/, '');
    const rangeHeader = range
      ? `bytes=${range.start}-${range.end !== undefined ? range.end : ''}`
      : undefined;

    const res = await this.client.send(
      new GetObjectCommand({
        Bucket: this.bucket,
        Key: cleanKey,
        Range: rangeHeader,
      })
    );

    const stream = res.Body as NodeJS.ReadableStream;
    const size = Number(res.ContentLength || 0);
    const contentType = res.ContentType || 'application/octet-stream';

    return {
      stream,
      size,
      contentType,
    };
  }

  async getSignedUrl(key: string, options?: { expiresInSeconds?: number; operation?: 'read' | 'write' }): Promise<string> {
    const cleanKey = key.replace(/^\/+/, '');
    const expiresIn = options?.expiresInSeconds ?? 300; // 5 minutes default

    if (options?.operation === 'write') {
      const command = new PutObjectCommand({ Bucket: this.bucket, Key: cleanKey });
      return getSignedUrl(this.client, command, { expiresIn });
    }

    const command = new GetObjectCommand({ Bucket: this.bucket, Key: cleanKey });
    return getSignedUrl(this.client, command, { expiresIn });
  }

  async delete(key: string): Promise<void> {
    const cleanKey = key.replace(/^\/+/, '');
    await this.client.send(
      new DeleteObjectCommand({
        Bucket: this.bucket,
        Key: cleanKey,
      })
    );
  }

  async deletePrefix(prefix: string): Promise<number> {
    const cleanPrefix = prefix.replace(/^\/+/, '');
    const listed = await this.client.send(
      new ListObjectsV2Command({
        Bucket: this.bucket,
        Prefix: cleanPrefix,
      })
    );

    if (!listed.Contents || listed.Contents.length === 0) {
      return 0;
    }

    const objects = listed.Contents.map((item) => ({ Key: item.Key! }));
    await this.client.send(
      new DeleteObjectsCommand({
        Bucket: this.bucket,
        Delete: { Objects: objects },
      })
    );

    return objects.length;
  }

  async list(prefix?: string): Promise<StorageItem[]> {
    const cleanPrefix = prefix ? prefix.replace(/^\/+/, '') : undefined;
    const res = await this.client.send(
      new ListObjectsV2Command({
        Bucket: this.bucket,
        Prefix: cleanPrefix,
      })
    );

    return (res.Contents || []).map((c) => ({
      key: c.Key!,
      size: Number(c.Size || 0),
      lastModified: c.LastModified,
    }));
  }

  async exists(key: string): Promise<boolean> {
    const cleanKey = key.replace(/^\/+/, '');
    try {
      await this.client.send(
        new HeadObjectCommand({
          Bucket: this.bucket,
          Key: cleanKey,
        })
      );
      return true;
    } catch {
      return false;
    }
  }
}
