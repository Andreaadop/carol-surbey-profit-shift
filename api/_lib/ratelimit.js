export async function underLimit(kv, key, limit, ttlSeconds = 86400) {
  const count = await kv.incr(key);
  if (count === 1) await kv.expire(key, ttlSeconds);
  return count <= limit;
}
