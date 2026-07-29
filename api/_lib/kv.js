import { Redis } from "@upstash/redis";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import path from "node:path";

// Process-local fallback so tests and keyless local dev work. NOT suitable
// for production: state resets per serverless instance.
//
// Optionally backed by a JSON file (persistPath) so state survives across
// the isolated processes/VM contexts that `vercel dev` spins up per request.
class MemoryKV {
  constructor(persistPath = null) {
    this.persistPath = persistPath;
    this.map = new Map();
    this.lists = new Map();
    if (this.persistPath) {
      try {
        if (existsSync(this.persistPath)) {
          const data = JSON.parse(readFileSync(this.persistPath, "utf8"));
          this.map = new Map(Object.entries(data.map ?? {}));
          this.lists = new Map(Object.entries(data.lists ?? {}));
        }
      } catch {
        // Corrupt or unreadable file — start empty.
      }
    }
  }
  _persist() {
    if (!this.persistPath) return;
    try {
      writeFileSync(
        this.persistPath,
        JSON.stringify({
          map: Object.fromEntries(this.map),
          lists: Object.fromEntries(this.lists),
        })
      );
    } catch (err) {
      console.warn("[kv] failed to persist dev store:", err?.message);
    }
  }
  async incr(key) {
    const next = (this.map.get(key) ?? 0) + 1;
    this.map.set(key, next);
    this._persist();
    return next;
  }
  async expire() { return 1; } // TTLs are a non-goal in dev
  async get(key) { return this.map.has(key) ? this.map.get(key) : null; }
  async set(key, value) {
    this.map.set(key, value);
    this._persist();
    return "OK";
  }
  async lpush(key, value) {
    const list = this.lists.get(key) ?? [];
    list.unshift(value);
    this.lists.set(key, list);
    this._persist();
    return list.length;
  }
  async lrange(key, start, stop) {
    const list = this.lists.get(key) ?? [];
    return list.slice(start, stop === -1 ? undefined : stop + 1);
  }
  async del(key) {
    const existed = this.map.delete(key);
    this._persist();
    return existed ? 1 : 0;
  }
}

export function getKV() {
  if (globalThis.__psfKV) return globalThis.__psfKV;
  const url = process.env.KV_REST_API_URL ?? process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN ?? process.env.UPSTASH_REDIS_REST_TOKEN;
  let instance;
  if (url && token) {
    instance = new Redis({ url, token });
  } else if (process.env.VERCEL_ENV === "production") {
    throw new Error("KV credentials missing in production — configure KV_REST_API_URL/KV_REST_API_TOKEN");
  } else if (process.env.NOW_REGION === "dev1") {
    console.warn(
      "[kv] No Redis credentials — using in-memory store (dev only); state persists to .dev-kv.json"
    );
    instance = new MemoryKV(path.join(process.cwd(), ".dev-kv.json"));
  } else {
    console.warn("[kv] No Redis credentials — using in-memory store (dev only)");
    instance = new MemoryKV();
  }
  globalThis.__psfKV = instance;
  return instance;
}
