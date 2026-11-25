export type StorageProviderName = 'blob' | 's3' | 'local';

export interface StoragePutOptions {
  contentType?: string;
  addRandomSuffix?: boolean;
}

export interface StorageGetResult {
  stream: NodeJS.ReadableStream;
  size: number;
  contentType: string;
}

export interface StorageItem {
  key: string;
  size: number;
  lastModified?: Date;
  contentType?: string;
}

export interface StorageAdapter {
  readonly name: StorageProviderName;

  /**
   * Uploads an object buffer to the storage provider.
   */
  put(key: string, data: Buffer | Uint8Array, options?: StoragePutOptions): Promise<{ key: string; size: number }>;

  /**
   * Retrieves an object as a readable stream with optional byte Range support.
   */
  get(key: string, range?: { start: number; end?: number }): Promise<StorageGetResult>;

  /**
   * Returns a temporary signed URL for authenticated reading or direct uploading.
   */
  getSignedUrl(key: string, options?: { expiresInSeconds?: number; operation?: 'read' | 'write' }): Promise<string>;

  /**
   * Deletes a single object from storage.
   */
  delete(key: string): Promise<void>;

  /**
   * Deletes all objects matching a key prefix.
   */
  deletePrefix(prefix: string): Promise<number>;

  /**
   * Lists objects with an optional key prefix.
   */
  list(prefix?: string): Promise<StorageItem[]>;

  /**
   * Checks whether an object exists.
   */
  exists(key: string): Promise<boolean>;
}
