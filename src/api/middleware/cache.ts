import { LRUCache } from "lru-cache";

export const PAGE_LIMIT = 100;
export const CACHE_TTL = 60 * 60 * 1000; // 1 hour

export const cache = new LRUCache<string, object>({
  ttl: CACHE_TTL,
  max: 1000,
});
