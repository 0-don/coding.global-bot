import { LRUCache } from "lru-cache";

interface CacheOptions {
  /** Time-to-live in milliseconds */
  ttl: number;
  /** Maximum number of entries */
  max: number;
}

export class Cache {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private store: LRUCache<string, any>;

  constructor(options: CacheOptions) {
    this.store = new LRUCache({
      max: options.max,
      ttl: options.ttl,
      ttlAutopurge: true,
    });
  }

  get<T = unknown>(key: string): T | undefined {
    return this.store.get(key) as T | undefined;
  }

  set(key: string, data: unknown): void {
    if (data !== null && data !== undefined) {
      this.store.set(key, data);
    }
  }

  delete(key: string): boolean {
    return this.store.delete(key);
  }

  has(key: string): boolean {
    return this.store.has(key);
  }

  clear(): void {
    this.store.clear();
  }

  get size(): number {
    return this.store.size;
  }

  /** Invalidate all cache entries matching a pattern */
  invalidatePattern(pattern: RegExp): number {
    let count = 0;
    for (const key of this.store.keys()) {
      if (pattern.test(key)) {
        this.store.delete(key);
        count++;
      }
    }
    return count;
  }

  /** Invalidate all cache entries containing a substring */
  invalidateContaining(substring: string): number {
    let count = 0;
    for (const key of this.store.keys()) {
      if (key.includes(substring)) {
        this.store.delete(key);
        count++;
      }
    }
    return count;
  }
}
