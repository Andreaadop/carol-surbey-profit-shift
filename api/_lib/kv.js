import { Redis } from "@upstash/redis";

// Process-local fallback so tests and keyless local dev work. NOT suitable
// for production: state resets per serverless instance.
class MemoryKV {
  constructor() { this.map = new Map(); this.lists = new Map(); }
  async incr(key) {
    const next = (this.map.get(key) ?? 0) + 1;
    this.map.set(key, next);
    return next;
  }
  async expire() { return 1; } // TTLs are a non-goal in dev
  async get(key) { return this.map.has(key) ? this.map.get(key) : null; }
  async set(key, value) { this.map.set(key, value); return "OK"; }
  async lpush(key, value) {
    const list = this.lists.get(key) ?? [];
    list.unshift(value);
    this.lists.set(key, list);
    return list.length;
  }
  async lrange(key, start, stop) {
    const list = this.lists.get(key) ?? [];
    return list.slice(start, stop === -1 ? undefined : stop + 1);
  }
}

let instance = null;

export function getKV() {
  if (instance) return instance;
  const url = process.env.KV_REST_API_URL ?? process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN ?? process.env.UPSTASH_REDIS_REST_TOKEN;
  if (url && token) {
    instance = new Redis({ url, token });
  } else {
    console.warn("[kv] No Redis credentials — using in-memory store (dev only)");
    instance = new MemoryKV();
  }
  return instance;
}
