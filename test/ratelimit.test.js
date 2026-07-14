import test from "node:test";
import assert from "node:assert/strict";
import { getKV } from "../api/_lib/kv.js";
import { underLimit } from "../api/_lib/ratelimit.js";

test("MemoryKV set/get/lpush/lrange round-trip", async () => {
  const kv = getKV(); // no env vars in tests → MemoryKV
  await kv.set("k1", { a: 1 }, { ex: 60 });
  assert.deepEqual(await kv.get("k1"), { a: 1 });
  assert.equal(await kv.get("missing"), null);
  await kv.lpush("list", { n: 1 });
  await kv.lpush("list", { n: 2 });
  assert.deepEqual(await kv.lrange("list", 0, -1), [{ n: 2 }, { n: 1 }]);
});

test("underLimit allows up to limit then blocks", async () => {
  const kv = getKV();
  assert.equal(await underLimit(kv, "rl:test", 3), true);
  assert.equal(await underLimit(kv, "rl:test", 3), true);
  assert.equal(await underLimit(kv, "rl:test", 3), true);
  assert.equal(await underLimit(kv, "rl:test", 3), false);
});
