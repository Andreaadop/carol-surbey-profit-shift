import test from "node:test";
import assert from "node:assert/strict";
import { parseCookies, buildSessionCookie, maskEmail, SESSION_COOKIE } from "../api/_lib/auth.js";
import { decideMembership, COMP_TAG } from "../api/_lib/membership.js";
import { getKV } from "../api/_lib/kv.js";

test("parseCookies handles multiple cookies and encoded values", () => {
  const c = parseCookies("a=1; psf_m=abc-def; b=x%20y");
  assert.equal(c.psf_m, "abc-def");
  assert.equal(c.b, "x y");
  assert.deepEqual(parseCookies(undefined), {});
});

test("buildSessionCookie is HttpOnly + Secure by default, Secure omitted for dev", () => {
  const prod = buildSessionCookie("s1");
  assert.ok(prod.startsWith(`${SESSION_COOKIE}=s1`));
  for (const attr of ["HttpOnly", "Secure", "SameSite=Lax", "Path=/", "Max-Age=2592000"]) {
    assert.ok(prod.includes(attr), `missing ${attr}`);
  }
  assert.ok(!buildSessionCookie("s1", { secure: false }).includes("Secure"));
});

test("maskEmail keeps domain, hides most of the user part", () => {
  assert.equal(maskEmail("andreadopva@gmail.com"), "an…@gmail.com");
  assert.equal(maskEmail("a@b.co"), "a…@b.co");
  assert.equal(maskEmail("not-an-email"), "");
});

test("decideMembership: comp tag wins regardless of subscriptions", () => {
  assert.deepEqual(decideMembership([COMP_TAG], [], null), { member: true, via: "comp" });
  assert.deepEqual(decideMembership(["Profit-Shift-Comp"], [], null), { member: true, via: "comp" });
});

test("decideMembership: active or trialing subscription grants access", () => {
  assert.equal(decideMembership([], [{ status: "active" }], null).member, true);
  assert.equal(decideMembership([], [{ status: "TRIALING" }], null).member, true);
  assert.equal(decideMembership([], [{ status: "canceled" }], null).member, false);
  assert.equal(decideMembership([], [], null).member, false);
});

test("decideMembership: productId narrows which subscriptions count", () => {
  const subs = [{ status: "active", productId: "prodA" }];
  assert.equal(decideMembership([], subs, "prodA").member, true);
  assert.equal(decideMembership([], subs, "prodB").member, false);
  const viaLineItems = [{ status: "active", lineItems: [{ productId: "prodB" }] }];
  assert.equal(decideMembership([], viaLineItems, "prodB").member, true);
});

test("kv.del makes tokens single-use", async () => {
  const kv = getKV();
  await kv.set("auth:tok1", { email: "x@y.co" }, { ex: 60 });
  assert.deepEqual(await kv.get("auth:tok1"), { email: "x@y.co" });
  assert.equal(await kv.del("auth:tok1"), 1);
  assert.equal(await kv.get("auth:tok1"), null);
  assert.equal(await kv.del("auth:tok1"), 0);
});
