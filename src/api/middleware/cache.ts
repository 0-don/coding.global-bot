import { Elysia } from "elysia";
import { LRUCache } from "lru-cache";

export const PAGE_LIMIT = 100;
export const CACHE_TTL = 60 * 60 * 1000; // 1 hour

export const cache = new LRUCache<string, object>({
  ttl: CACHE_TTL,
  max: 1000,
});

export const cacheMiddleware = new Elysia({ name: "cache-middleware" })
  .derive(({ request, path }) => {
    if (request.method !== "GET") return { cacheKey: null };
    const url = new URL(request.url);
    const cacheKey = url.search ? `${path}${url.search}` : path;
    return { cacheKey };
  })
  .onBeforeHandle(({ cacheKey }) => {
    if (!cacheKey) return;
    return cache.get(cacheKey);
  })
  .onAfterHandle(({ cacheKey, responseValue }) => {
    if (cacheKey) cache.set(cacheKey, responseValue as object);
  });
