import { beforeEach, describe, expect, it } from "vitest";
import { api } from "../src/convex/_generated/api";
import { createServiceWithTier, createUser, makeTest, signIn } from "./harness";

let t = makeTest();

beforeEach(() => {
  t = makeTest();
  signIn(null);
});

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

/** Stores a fake storage id so an order can be created without a real upload. */
async function seedStorage() {
  return await t.run((ctx) => ctx.storage.store(new Blob([new Uint8Array([1, 2, 3])])));
}

async function placeOrder(args: {
  couponCode?: string;
  tipAmount?: number;
  /** Reuse an existing buyer, so per-client limits are actually exercised. */
  asUserId?: string;
}) {
  const clientId = args.asUserId ?? (await createUser(t, { email: "buyer@example.com" }));
  signIn(clientId);
  const { serviceId, tierId } = await createServiceWithTier(t, 1000);
  const storageId = await seedStorage();
  const orderId = await t.mutation(api.orders.createWithProof, {
    serviceId,
    tierId,
    requirements: {},
    clientName: "Buyer",
    clientEmail: "buyer@example.com",
    clientWhatsapp: "9999999999",
    utr: "627654022752",
    storageId,
    couponCode: args.couponCode,
    tipAmount: args.tipAmount,
  });
  const order = await t.run((ctx) => ctx.db.get(orderId));
  return { clientId, orderId, order };
}

describe("orders.createWithProof — coupon is applied server-side", () => {
  it("reduces the total by the discount", async () => {
    await seedCoupon();
    const { order } = await placeOrder({ couponCode: "SAVE200" });
    expect(order!.totalPrice).toBe(800);
  });

  it("records exactly one redemption, tied to the order", async () => {
    await seedCoupon();
    const { orderId } = await placeOrder({ couponCode: "SAVE200" });
    const rows = await t.run((ctx) => ctx.db.query("couponRedemptions").collect());
    expect(rows).toHaveLength(1);
    expect(rows[0].orderId).toBe(orderId);
    expect(rows[0].discount).toBe(200);
  });

  it("never lets a coupon make the total negative", async () => {
    await seedCoupon({ value: 5000 });
    const { order } = await placeOrder({ couponCode: "SAVE200" });
    expect(order!.totalPrice).toBe(0);
  });

  it("applies the coupon after the tip", async () => {
    await seedCoupon();
    const { order } = await placeOrder({ couponCode: "SAVE200", tipAmount: 500 });
    // 1000 + 500 tip, less 200 off.
    expect(order!.totalPrice).toBe(1300);
  });

  it("rejects an unknown code instead of silently ignoring it", async () => {
    const { serviceId, tierId } = await createServiceWithTier(t, 1000);
    signIn(await createUser(t));
    const storageId = await seedStorage();
    await expect(
      t.mutation(api.orders.createWithProof, {
        serviceId,
        tierId,
        requirements: {},
        clientName: "B",
        clientEmail: "b@x.com",
        clientWhatsapp: "1",
        utr: "12345678",
        storageId,
        couponCode: "NOPE",
      }),
    ).rejects.toThrow(/isn't recognised/i);
  });

  it("rejects a private coupon used by the wrong person", async () => {
    await seedCoupon({ allowedEmails: ["vip@example.com"] });
    await expect(placeOrder({ couponCode: "SAVE200" })).rejects.toThrow(/specific people/i);
  });

  it("refuses a second redemption of a single-use coupon", async () => {
    await seedCoupon({ maxPerClient: 1 });
    const buyerId = await createUser(t, { email: "repeat@example.com" });
    await placeOrder({ couponCode: "SAVE200", asUserId: buyerId });
    // Same person, same code — the per-client cap must stop the second attempt.
    await expect(
      placeOrder({ couponCode: "SAVE200", asUserId: buyerId }),
    ).rejects.toThrow(/already used/i);
  });

  it("counts usage against the cap at order time", async () => {
    await seedCoupon({ maxUses: 1 });
    await placeOrder({ couponCode: "SAVE200" });
    // A different buyer still hits the global cap.
    await expect(placeOrder({ couponCode: "SAVE200" })).rejects.toThrow(/fully redeemed/i);
  });

  it("ignores a percentage-free coupon that saves nothing", async () => {
    // A flat coupon larger than a zero subtotal cannot reduce anything.
    const clientId = await createUser(t);
    signIn(clientId);
    const { serviceId, tierId } = await createServiceWithTier(t, 0);
    await seedCoupon();
    const storageId = await seedStorage();
    await expect(
      t.mutation(api.orders.createWithProof, {
        serviceId,
        tierId,
        requirements: {},
        clientName: "B",
        clientEmail: "b@x.com",
        clientWhatsapp: "1",
        utr: "12345678",
        storageId,
        couponCode: "SAVE200",
      }),
    ).rejects.toThrow(/doesn't reduce/i);
  });
});

describe("orders — access control", () => {
  it("keeps another client's orders out of listMine", async () => {
    const { clientId } = await placeOrder({});
    signIn(await createUser(t, { email: "someone-else@example.com" }));
    expect(await t.query(api.orders.listMine, {})).toHaveLength(0);
    signIn(clientId);
    expect(await t.query(api.orders.listMine, {})).toHaveLength(1);
  });

  it("hides the admin board from customers", async () => {
    await placeOrder({});
    signIn(await createUser(t, { email: "nosy@example.com" }));
    await expect(t.query(api.orders.listAll, {})).rejects.toThrow(/Unauthorized/i);
  });

  it("hides approve/reject from customers", async () => {
    const { orderId } = await placeOrder({});
    signIn(await createUser(t, { email: "nosy@example.com" }));
    await expect(t.mutation(api.orders.approve, { orderId })).rejects.toThrow(/Unauthorized/i);
    await expect(
      t.mutation(api.orders.reject, { orderId, reason: "no" }),
    ).rejects.toThrow(/Unauthorized/i);
  });

  it("refuses a stranger attaching a proof to someone else's order", async () => {
    const { orderId } = await placeOrder({});
    signIn(await createUser(t, { email: "nosy@example.com" }));
    await expect(t.mutation(api.orders.generateProofUrl, { orderId })).rejects.toThrow(
      /Unauthorized/i,
    );
  });

  it("requires a reason when declining", async () => {
    const { orderId } = await placeOrder({});
    process.env.SUPER_OWNER_EMAIL = "owner@example.com";
    signIn(await createUser(t, { email: "owner@example.com" }));
    await expect(t.mutation(api.orders.reject, { orderId, reason: "  " })).rejects.toThrow(
      /reason/i,
    );
    delete process.env.SUPER_OWNER_EMAIL;
  });

  it("stops a client tipping someone else's order", async () => {
    const { orderId } = await placeOrder({});
    signIn(await createUser(t, { email: "nosy@example.com" }));
    await expect(
      t.mutation(api.orders.recordTip, { orderId, tipAmount: 500 }),
    ).rejects.toThrow(/your own orders/i);
  });
});

describe("credits — the public wall leaks no money", () => {
  it("omits the amount but keeps the tier", async () => {
    await t.run((ctx) =>
      ctx.db.insert("credits", {
        name: "Supporter",
        greatness: "Legendary",
        amount: 900,
        tier: "legendary",
        kind: "tip",
        createdAt: 1,
      }),
    );
    const wall = await t.query(api.credits.listAll, {});
    expect(wall[0].amount).toBeUndefined();
    expect(wall[0].tier).toBe("legendary");
  });

  it("stores no amount for a marketing credit", async () => {
    process.env.SUPER_OWNER_EMAIL = "owner@example.com";
    signIn(await createUser(t, { email: "owner@example.com" }));
    await t.mutation(api.credits.add, {
      name: "A Sponsor",
      greatness: "Marketing credit",
      kind: "marketing",
      tier: "premium",
    });
    const rows = await t.run((ctx) => ctx.db.query("credits").collect());
    expect(rows[0].amount).toBeUndefined();
    expect(rows[0].kind).toBe("marketing");
    delete process.env.SUPER_OWNER_EMAIL;
  });

  it("keeps the admin ledger private", async () => {
    signIn(await createUser(t, { email: "nosy@example.com" }));
    await expect(t.query(api.credits.listForAdmin, {})).rejects.toThrow(/Unauthorized/i);
  });

  it("refuses credit edits from a customer", async () => {
    signIn(await createUser(t, { email: "nosy@example.com" }));
    await expect(
      t.mutation(api.credits.add, { name: "Fake" }),
    ).rejects.toThrow(/Unauthorized/i);
  });
});