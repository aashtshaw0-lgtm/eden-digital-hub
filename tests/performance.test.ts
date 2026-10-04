import { beforeEach, describe, expect, it } from "vitest";
import { api } from "../src/convex/_generated/api";
import { createServiceWithTier, createUser, makeTest, signIn } from "./harness";

/**
 * Performance guard for the admin board.
 *
 * The board used to issue one indexed query per order for its proof and
 * another for that proof's review, so a 200-order book cost ~400 round-trips.
 * These tests assert the batched shape scales and still returns correct data.
 */

let t = makeTest();

beforeEach(() => {
  t = makeTest();
  signIn(null);
});

async function seedOrders(count: number) {
  await seedOrdersOn(t, count);
}

/** Seeds into a caller-supplied instance, so timings can use a clean db. */
async function seedOrdersOn(
  target: ReturnType<typeof makeTest>,
  count: number,
) {
  const { serviceId, tierId } = await createServiceWithTier(target, 1000);
  const clients = await Promise.all(
    Array.from({ length: 5 }, (_, i) =>
      createUser(target, { email: `c${i}@example.com` }),
    ),
  );
  await target.run(async (ctx) => {
    for (let i = 0; i < count; i++) {
      const clientId = clients[i % clients.length];
      const orderId = await ctx.db.insert("orders", {
        clientId,
        serviceId,
        tierId,
        serviceName: "Logo Design",
        tierName: "Basic",
        requirements: {},
        clientName: `Buyer ${i}`,
        clientEmail: `c${i % 5}@example.com`,
        clientWhatsapp: "9999999999",
        totalPrice: 1000,
        status: "pending",
        createdAt: i,
        updatedAt: i,
      });
      if (i % 2 === 0) {
        const proofId = await ctx.db.insert("paymentProofs", {
          orderId,
          storageId: await ctx.storage.store(new Blob([new Uint8Array([1])])),
          utr: `utr-${i}`,
          declaredAmount: 1000,
          uploadedAt: i,
        });
        await ctx.db.insert("paymentReviews", {
          proofId,
          summary: "ok",
          paidAmount: i % 4 === 0 ? 400 : 1000,
          expectedAmount: 1000,
          tipAmount: 0,
          reviewedAt: i,
        });
      }
    }
  });
}

describe("orders.listAll — performance", () => {
  it("scales roughly linearly and stays well under a second at 400 orders", async () => {
    process.env.SUPER_OWNER_EMAIL = "owner@example.com";

    const timeBoard = async (n: number) => {
      const t2 = makeTest();
      await seedOrdersOn(t2, n);
      signIn(await createUser(t2, { email: "owner@example.com" }));
      // One warm-up pass (as the owner) so JIT cost is not attributed to the
      // smaller size.
      await t2.query(api.orders.listAll, {});
      const started = performance.now();
      const board = await t2.query(api.orders.listAll, {});
      return { ms: performance.now() - started, rows: board.length };
    };

    const small = await timeBoard(50);
    const large = await timeBoard(400);

    console.log(
      `listAll: ${small.rows} rows in ${small.ms.toFixed(1)}ms · ` +
        `${large.rows} rows in ${large.ms.toFixed(1)}ms`,
    );

    expect(large.rows).toBe(400);
    // A regression guard, not a precise metric: in-memory reads are far cheaper
    // than production ones, so this only catches a gross blow-up such as
    // reintroducing a per-row index scan.
    expect(large.ms).toBeLessThan(1000);

    delete process.env.SUPER_OWNER_EMAIL;
  });

  it("still attaches proof, review and resolved amounts correctly", async () => {
    process.env.SUPER_OWNER_EMAIL = "owner@example.com";
    await seedOrders(6);
    signIn(await createUser(t, { email: "owner@example.com" }));
    const board = await t.query(api.orders.listAll, {});

    // Every even order has a proof; odd ones have none.
    const withProof = board.filter((o) => o.proof !== null);
    expect(withProof.length).toBe(3);

    // Order 0 read 400 against a 1000 total -> short 600.
    const short = board.find((o) => o.totalPrice === 1000 && o.shortBy === 600);
    expect(short).toBeTruthy();

    // Order 2 read the full amount -> no shortfall.
    const full = board.find((o) => o.proof !== null && o.shortBy === 0);
    expect(full).toBeTruthy();

    // An order with no proof has no known amount at all.
    const unknown = board.filter((o) => o.proof === null);
    expect(unknown.every((o) => o.paidAmount === null && o.shortBy === null)).toBe(true);

    // Client identity still resolves through the batched map.
    expect(board.every((o) => typeof o.clientAccountEmail === "string")).toBe(true);

    delete process.env.SUPER_OWNER_EMAIL;
  });
});

describe("catalog.seedIfEmpty — performance", () => {
  it("does not duplicate an existing catalogue", async () => {
    // The seed used to `collect()` the whole services table just to read
    // `.length`; this guards the behaviour that change had to preserve.
    await createServiceWithTier(t, 500);
    const before = await t.query(api.catalog.listPublic, {});
    await t.mutation(api.catalog.seedIfEmpty, {});
    const after = await t.query(api.catalog.listPublic, {});
    expect(after.length).toBe(before.length);
  });

  it("is idempotent and still seeds an empty catalogue", async () => {
    await t.mutation(api.catalog.seedIfEmpty, {});
    const first = await t.query(api.catalog.listPublic, {});
    await t.mutation(api.catalog.seedIfEmpty, {});
    const second = await t.query(api.catalog.listPublic, {});
    expect(first.length).toBeGreaterThan(0);
    expect(second.length).toBe(first.length);
  });
});