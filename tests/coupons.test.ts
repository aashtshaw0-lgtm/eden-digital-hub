import { describe, expect, it, beforeEach } from "vitest";
import { createUser, makeTest, signIn } from "./harness";
import { api } from "../src/convex/_generated/api";

/** A fresh in-memory database per test, so codes never collide. */
let t = makeTest();

beforeEach(() => {
  t = makeTest();
  signIn(null);
});

async function seedCoupon(fields: Record<string, unknown> = {}) {
  return await t.run(async (ctx) => {
    return await ctx.db.insert("coupons", {
      code: "EDEN20",
      kind: "percent",
      value: 20,
      active: true,
      createdAt: Date.now(),
      ...fields,
    } as never);
  });
}

describe("coupon.validate — security", () => {
  it("refuses anonymous callers", async () => {
    const id = await seedCoupon();
    expect(id).toBeTruthy();
    signIn(null);
    const result = await t.mutation(api.coupons.validate, { code: "EDEN20" });
    expect(result.ok).toBe(false);
    expect(result.message).toMatch(/sign in/i);
  });

  it("accepts a valid code for a signed-in customer", async () => {
    await seedCoupon();
    signIn(await createUser(t, { email: "client@example.com" }));
    const result = await t.mutation(api.coupons.validate, { code: "eden20" });
    expect(result.ok).toBe(true);
    expect(result.kind).toBe("percent");
    expect(result.value).toBe(20);
  });

  it("is rate limited so codes cannot be swept", async () => {
    await seedCoupon();
    signIn(await createUser(t));
    for (let i = 0; i < 20; i++) {
      await t.mutation(api.coupons.validate, { code: "EDEN20" });
    }
    // The 21st probe is refused by the limiter.
    await expect(t.mutation(api.coupons.validate, { code: "EDEN20" })).rejects.toThrow(
      /too fast/i,
    );
  });
});

describe("coupon.validate — targeting", () => {
  it("hides a private coupon from people it was not shared with", async () => {
    await seedCoupon({ allowedEmails: ["vip@example.com"] });
    signIn(await createUser(t, { email: "stranger@example.com" }));
    const result = await t.mutation(api.coupons.validate, { code: "EDEN20" });
    expect(result.ok).toBe(false);
    expect(result.code).toBe("not_allowed");
  });

  it("allows the person it was shared with", async () => {
    await seedCoupon({ allowedEmails: ["vip@example.com"] });
    signIn(await createUser(t, { email: "vip@example.com" }));
    const result = await t.mutation(api.coupons.validate, { code: "EDEN20" });
    expect(result.ok).toBe(true);
  });

  it("stops a client reusing a single-use coupon", async () => {
    const couponId = await seedCoupon({ maxPerClient: 1 });
    const userId = await createUser(t);
    signIn(userId);
    await t.run(async (ctx) => {
      await ctx.db.insert("couponRedemptions", {
        couponId,
        userId,
        discount: 100,
        createdAt: Date.now(),
      });
    });
    const result = await t.mutation(api.coupons.validate, { code: "EDEN20" });
    expect(result.ok).toBe(false);
    expect(result.code).toBe("already_used");
  });

  it("refuses an expired coupon", async () => {
    await seedCoupon({ expiresAt: Date.now() - 1000 });
    signIn(await createUser(t));
    const result = await t.mutation(api.coupons.validate, { code: "EDEN20" });
    expect(result.ok).toBe(false);
    expect(result.code).toBe("expired");
  });

  it("refuses a fully redeemed coupon", async () => {
    const couponId = await seedCoupon({ maxUses: 1 });
    const userId = await createUser(t);
    signIn(userId);
    await t.run(async (ctx) => {
      await ctx.db.insert("couponRedemptions", {
        couponId,
        userId,
        discount: 10,
        createdAt: Date.now(),
      });
    });
    const result = await t.mutation(api.coupons.validate, { code: "EDEN20" });
    expect(result.ok).toBe(false);
    expect(result.code).toBe("used_up");
  });

  it("refuses a paused coupon", async () => {
    await seedCoupon({ active: false });
    signIn(await createUser(t));
    const result = await t.mutation(api.coupons.validate, { code: "EDEN20" });
    expect(result.ok).toBe(false);
    expect(result.code).toBe("inactive");
  });
});

describe("coupons.create — admin only", () => {
  it("rejects a non-admin caller", async () => {
    signIn(await createUser(t, { role: "customer" }));
    await expect(
      t.mutation(api.coupons.create, { code: "FREE50", kind: "percent", value: 50 }),
    ).rejects.toThrow(/Unauthorized/i);
  });

  it("rejects an over-100 percentage", async () => {
    process.env.SUPER_OWNER_EMAIL = "owner@example.com";
    signIn(await createUser(t, { email: "owner@example.com" }));
    await expect(
      t.mutation(api.coupons.create, { code: "TOOMUCH", kind: "percent", value: 150 }),
    ).rejects.toThrow(/cannot exceed/i);
    delete process.env.SUPER_OWNER_EMAIL;
  });

  it("refuses a duplicate code", async () => {
    process.env.SUPER_OWNER_EMAIL = "owner@example.com";
    signIn(await createUser(t, { email: "owner@example.com" }));
    await t.mutation(api.coupons.create, { code: "DUP", kind: "flat", value: 100 });
    await expect(
      t.mutation(api.coupons.create, { code: "dup", kind: "flat", value: 100 }),
    ).rejects.toThrow(/already exists/i);
    delete process.env.SUPER_OWNER_EMAIL;
  });
});

describe("coupons.listForAdmin — admin only", () => {
  it("rejects a customer and reports usage for an owner", async () => {
    const couponId = await seedCoupon();
    const userId = await createUser(t);
    signIn(userId);
    await expect(t.query(api.coupons.listForAdmin, {})).rejects.toThrow(/Unauthorized/i);

    process.env.SUPER_OWNER_EMAIL = "owner@example.com";
    signIn(await createUser(t, { email: "owner@example.com" }));
    await t.run(async (ctx) => {
      await ctx.db.insert("couponRedemptions", {
        couponId,
        userId,
        discount: 250,
        createdAt: Date.now(),
      });
    });
    const list = await t.query(api.coupons.listForAdmin, {});
    expect(list[0].uses).toBe(1);
    expect(list[0].totalDiscount).toBe(250);
    delete process.env.SUPER_OWNER_EMAIL;
  });
});

describe("coupons.delete", () => {
  it("keeps redemption history after a delete", async () => {
    process.env.SUPER_OWNER_EMAIL = "owner@example.com";
    signIn(await createUser(t, { email: "owner@example.com" }));
    const couponId = await t.mutation(api.coupons.create, {
      code: "GONE",
      kind: "flat",
      value: 100,
    });
    const userId = await createUser(t);
    await t.run(async (ctx) => {
      await ctx.db.insert("couponRedemptions", {
        couponId,
        userId,
        discount: 100,
        createdAt: Date.now(),
      });
    });
    await t.mutation(api.coupons.remove, { couponId });
    const remaining = await t.run(async (ctx) =>
      ctx.db.query("couponRedemptions").collect(),
    );
    expect(remaining).toHaveLength(1);
    delete process.env.SUPER_OWNER_EMAIL;
  });
});