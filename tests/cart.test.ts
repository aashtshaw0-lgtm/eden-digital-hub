import { beforeEach, describe, expect, it } from "vitest";
import { api } from "../src/convex/_generated/api";
import {
  allocateProportionally,
  distributeDiscount,
} from "../src/convex/lib/money";
import { createServiceWithTier, createUser, makeTest, signIn } from "./harness";

let t = makeTest();

beforeEach(() => {
  t = makeTest();
  signIn(null);
});

async function seedStorage() {
  return await t.run((ctx) => ctx.storage.store(new Blob([new Uint8Array([1, 2, 3])])));
}

async function seedCoupon(fields: Record<string, unknown> = {}) {
  return await t.run((ctx) =>
    ctx.db.insert("coupons", {
      code: "SAVE200",
      kind: "flat",
      value: 200,
      active: true,
      createdAt: Date.now(),
      ...fields,
    } as never),
  );
}

/** Places a multi-line cart exactly as Checkout does. */
async function placeCart(args: {
  prices: number[];
  tipAmount?: number;
  couponCode?: string;
}) {
  const clientId = await createUser(t, { email: "buyer@example.com" });
  signIn(clientId);

  const lines = [];
  for (const price of args.prices) {
    const { serviceId, tierId } = await createServiceWithTier(t, price);
    lines.push({ serviceId, tierId, requirements: {} });
  }

  const storageId = await seedStorage();
  const placed = await t.mutation(api.orders.createCartWithProof, {
    items: lines,
    clientName: "Buyer",
    clientEmail: "buyer@example.com",
    clientWhatsapp: "9999999999",
    utr: "627654022752",
    storageId,
    tipAmount: args.tipAmount,
    couponCode: args.couponCode,
  });

  const orders = await t.run(async (ctx) =>
    Promise.all(placed.map((line) => ctx.db.get(line.orderId))),
  );
  return { clientId, placed, orders };
}

describe("cart totals are allocated without losing a rupee", () => {
  it("splits an amount in proportion and the parts sum to the whole", () => {
    // Which line receives a leftover rupee is an arbitrary tie-break, so this
    // asserts the contract (sums exactly, nothing negative) rather than one
    // particular distribution.
    const even = allocateProportionally(100, [1000, 1000, 1000]);
    expect(even.reduce((a, b) => a + b, 0)).toBe(100);
    expect(even.every((v) => v >= 0)).toBe(true);
    expect(Math.max(...even) - Math.min(...even)).toBeLessThanOrEqual(1);
    expect(allocateProportionally(0, [500, 500])).toEqual([0, 0]);
    expect(allocateProportionally(700, [])).toEqual([]);
  });

  it("never rounds every share up and leaves the last line negative", () => {
    // Regression: rounding each share independently overshot the target here,
    // handing the final (zero-priced) line -1 rupee.
    const parts = allocateProportionally(646, [4379, 4216, 1326, 2195, 1252, 0]);
    expect(parts.reduce((a, b) => a + b, 0)).toBe(646);
    expect(parts.every((v) => v >= 0)).toBe(true);
  });

  it("never splits more than there is to split", () => {
    // All-zero weights would divide by zero; everything lands on line one.
    expect(allocateProportionally(50, [0, 0])).toEqual([50, 0]);
  });

  it("caps a line's share of the discount at what that line is worth", () => {
    // A 900 discount on lines worth 100 and 500 cannot take more than 600 total.
    const parts = distributeDiscount([100, 500], 900);
    expect(parts.reduce((a, b) => a + b, 0)).toBe(600);
    expect(parts.every((p) => p >= 0)).toBe(true);
  });
});

describe("orders.createCartWithProof — one transaction for the whole cart", () => {
  it("charges the tip once, not once per line", async () => {
    // 1000 + 2000 items with a 300 tip must total 3300, not 3600.
    const { orders } = await placeCart({ prices: [1000, 2000], tipAmount: 300 });
    const total = orders.reduce((sum, o) => sum + o!.totalPrice, 0);
    expect(total).toBe(3300);
  });

  it("spends a single-use coupon exactly once across many lines", async () => {
    await seedCoupon({ maxPerClient: 1 });
    const { placed } = await placeCart({
      prices: [1000, 2000, 1500],
      couponCode: "SAVE200",
    });
    expect(placed).toHaveLength(3);
    const redemptions = await t.run((ctx) =>
      ctx.db.query("couponRedemptions").collect(),
    );
    expect(redemptions).toHaveLength(1);
  });

  it("reduces the cart total by the coupon exactly once", async () => {
    await seedCoupon();
    // 4500 of items less 200 off = 4300 across three orders.
    const { orders } = await placeCart({
      prices: [1000, 2000, 1500],
      couponCode: "SAVE200",
    });
    const total = orders.reduce((sum, o) => sum + o!.totalPrice, 0);
    expect(total).toBe(4300);
  });

  it("records the discount against the cart, not per line", async () => {
    await seedCoupon({ kind: "percent", value: 10 });
    const { orders } = await placeCart({
      prices: [1000, 1000],
      couponCode: "SAVE200",
    });
    // 10% of 2000 = 200 off, once.
    expect(orders.reduce((sum, o) => sum + o!.totalPrice, 0)).toBe(1800);
  });

  it("gives every line its own proof row pointing at the one screenshot", async () => {
    const { placed } = await placeCart({ prices: [1000, 2000] });
    const proofs = await t.run((ctx) => ctx.db.query("paymentProofs").collect());
    expect(proofs).toHaveLength(2);
    expect(new Set(proofs.map((p) => p.storageId)).size).toBe(1);
    expect(new Set(placed.map((p) => p.orderId))).toEqual(
      new Set(proofs.map((p) => p.orderId)),
    );
  });

  it("returns per-line totals that add up to the charge", async () => {
    await seedCoupon();
    const { placed } = await placeCart({
      prices: [1000, 2000],
      tipAmount: 100,
      couponCode: "SAVE200",
    });
    expect(placed.map((p) => p.amount).reduce((a, b) => a + b, 0)).toBe(2900);
    expect(placed[0].label).toMatch(/·/);
  });

  it("grants one credit for the tip, not one per line", async () => {
    const { orders } = await placeCart({ prices: [1000, 2000], tipAmount: 500 });
    const credits = await t.run((ctx) => ctx.db.query("credits").collect());
    expect(credits).toHaveLength(1);
    expect(credits[0].sourceOrderId).toBe(orders[0]!._id);
  });

  it("splits a real cart exactly the way the receipt does", async () => {
    // The cart reported on in the browser: Logo Design 1499 + YouTube
    // Thumbnails 499, a 500 tip, and EDEN10 (10% off).
    await seedCoupon({ code: "EDEN10", kind: "percent", value: 10 });
    const { placed, orders } = await placeCart({
      prices: [1499, 499],
      tipAmount: 500,
      couponCode: "EDEN10",
    });

    // 2498 subtotal, 10% = 250 off, so 2248 payable.
    expect(orders.reduce((sum, o) => sum + o!.totalPrice, 0)).toBe(2248);
    expect(placed.map((p) => p.amount).reduce((a, b) => a + b, 0)).toBe(2248);
    // The line amounts must not be the raw tier prices — that is the bug this
    // guards: a receipt showing 1499 + 499 when 2248 was charged.
    expect(placed.map((p) => p.amount)).not.toEqual([1499, 499]);
    expect(placed[0].amount).toBe(1686);
    expect(placed[1].amount).toBe(562);
  });

  it("writes nothing at all when one line is invalid", async () => {
    const clientId = await createUser(t, { email: "buyer@example.com" });
    signIn(clientId);
    const good = await createServiceWithTier(t, 1000);
    const storageId = await seedStorage();

    await expect(
      t.mutation(api.orders.createCartWithProof, {
        items: [
          { serviceId: good.serviceId, tierId: good.tierId, requirements: {} },
          // A tier that belongs to a different service must abort the cart.
          {
            serviceId: good.serviceId,
            tierId: (await createServiceWithTier(t, 2000)).tierId,
            requirements: {},
          },
        ],
        clientName: "Buyer",
        clientEmail: "buyer@example.com",
        clientWhatsapp: "1",
        utr: "12345678",
        storageId,
      }),
    ).rejects.toThrow(/Invalid tier/i);

    // The good line must not have been committed.
    expect(await t.run((ctx) => ctx.db.query("orders").collect())).toHaveLength(0);
    expect(await t.run((ctx) => ctx.db.query("paymentProofs").collect())).toHaveLength(0);
  });

  it("refuses an empty cart", async () => {
    signIn(await createUser(t));
    const storageId = await seedStorage();
    await expect(
      t.mutation(api.orders.createCartWithProof, {
        items: [],
        clientName: "B",
        clientEmail: "b@x.com",
        clientWhatsapp: "1",
        utr: "12345678",
        storageId,
      }),
    ).rejects.toThrow(/empty/i);
  });

  it("rejects a spent coupon without writing any order", async () => {
    await seedCoupon({ maxUses: 1 });
    await placeCart({ prices: [1000], couponCode: "SAVE200" });

    const clientId = await createUser(t, { email: "second@example.com" });
    signIn(clientId);
    const line = await createServiceWithTier(t, 1000);
    const storageId = await seedStorage();
    await expect(
      t.mutation(api.orders.createCartWithProof, {
        items: [{ serviceId: line.serviceId, tierId: line.tierId, requirements: {} }],
        clientName: "B",
        clientEmail: "b@x.com",
        clientWhatsapp: "1",
        utr: "12345678",
        storageId,
        couponCode: "SAVE200",
      }),
    ).rejects.toThrow(/fully redeemed/i);

    expect(await t.run((ctx) => ctx.db.query("orders").collect())).toHaveLength(1);
  });
});