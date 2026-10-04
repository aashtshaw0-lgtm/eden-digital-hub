import { beforeEach, describe, expect, it } from "vitest";
import { api } from "../src/convex/_generated/api";
import { createUser, makeTest, signIn } from "./harness";
import {
  assertValidShares,
  DEFAULT_COLLABORATOR_PERCENT,
  DEFAULT_WEB_OWNER_PERCENT,
  MAX_OUTSIDE_SHARE_PERCENT,
  splitProductSale,
  splitServiceSale,
} from "../src/convex/lib/split";

let t = makeTest();

beforeEach(() => {
  t = makeTest();
  signIn(null);
  process.env.SUPER_OWNER_EMAIL = "owner@example.com";
});

async function asOwner() {
  signIn(await createUser(t, { email: "owner@example.com" }));
}

async function addPerson(sharePercent: number, name = "Rhea") {
  return await t.mutation(api.products.addCollaborator, {
    name,
    handle: "@rhea.makes",
    sharePercent,
  });
}

async function addProduct(args: {
  price: number;
  collaboratorId?: string;
  share?: number;
  webOwnerSharePercent?: number;
}) {
  return await t.mutation(api.products.addProduct, {
    name: "Handmade teddy bear",
    price: args.price,
    collaboratorId: args.collaboratorId as never,
    collaboratorSharePercent: args.share,
    webOwnerSharePercent: args.webOwnerSharePercent,
    status: "live",
  });
}

/** The three recorded shares must always add back up to the gross. */
function expectSharesSumToGross(sale: {
  gross: number;
  collaboratorShare: number;
  studioShare: number;
  webOwnerShare?: number;
}) {
  expect(
    sale.collaboratorShare +
      sale.studioShare +
      (sale.webOwnerShare ?? 0),
  ).toBe(sale.gross);
}

describe("split — pure money math", () => {
  it("divides 1000 the agreed way: 60 maker, 20 studio, 20 site", () => {
    expect(splitProductSale(1000, 60, 20)).toEqual({
      collaboratorShare: 600,
      studioShare: 200,
      webOwnerShare: 200,
    });
  });

  it("always sums to the gross, whatever the percentages", () => {
    for (const gross of [0, 1, 7, 99, 101, 333, 1001, 2248, 99999]) {
      for (const maker of [0, 17, 33, 60, 75, 90]) {
        for (const site of [0, 20, 25, 90]) {
          const s = splitProductSale(gross, maker, site);
          expect(s.collaboratorShare + s.studioShare + s.webOwnerShare).toBe(
            Math.max(0, Math.round(gross)),
          );
          expect(s.collaboratorShare).toBeGreaterThanOrEqual(0);
          expect(s.webOwnerShare).toBeGreaterThanOrEqual(0);
          expect(s.studioShare).toBeGreaterThanOrEqual(0);
        }
      }
    }
  });

  it("never lets the studio be left with nothing", () => {
    // 95 + 95 would be 190% between them; both get scaled down instead.
    const s = splitProductSale(1000, 95, 95);
    expect(s.studioShare).toBeGreaterThan(0);
    expect(s.collaboratorShare + s.webOwnerShare).toBeLessThanOrEqual(
      MAX_OUTSIDE_SHARE_PERCENT * 10,
    );
    expect(s.collaboratorShare + s.studioShare + s.webOwnerShare).toBe(1000);
  });

  it("treats nonsense percentages as zero rather than going negative", () => {
    expect(splitProductSale(500, -20, 20).collaboratorShare).toBe(0);
    expect(splitProductSale(500, Number.NaN, 20).collaboratorShare).toBe(0);
    expect(splitProductSale(500, 60, Number.NaN).webOwnerShare).toBe(0);
    // The good leg is untouched by the bad one.
    expect(splitProductSale(500, Number.NaN, 20).webOwnerShare).toBe(100);
  });

  it("splits a service sale between the studio and the site only", () => {
    expect(splitServiceSale(1000, 20)).toEqual({
      studioShare: 800,
      webOwnerShare: 200,
    });
    // There is no maker on a design service. 20% of 2498 is 499.6, which floors
    // to 499 — the studio absorbs the fraction rather than the two halves
    // drifting apart.
    expect(splitServiceSale(2498)).toEqual({
      studioShare: 1999,
      webOwnerShare: 499,
    });
  });

  it("rejects a pair of cuts that would leave the studio nothing", () => {
    expect(() => assertValidShares(60, 20)).not.toThrow();
    expect(() => assertValidShares(90, 0)).not.toThrow();
    expect(() => assertValidShares(80, 20)).toThrow(/more than 90%/i);
    expect(() => assertValidShares(-1, 20)).toThrow(/between 0 and 100/i);
    expect(() => assertValidShares(60, 101)).toThrow(/between 0 and 100/i);
  });

  it("defaults to the agreed 60 / 20", () => {
    expect(DEFAULT_COLLABORATOR_PERCENT).toBe(60);
    expect(DEFAULT_WEB_OWNER_PERCENT).toBe(20);
  });
});

describe("products — the profit split is exact", () => {
  it("gives the maker 60%, the studio 20% and the site 20% by default", async () => {
    await asOwner();
    const personId = await addPerson(DEFAULT_COLLABORATOR_PERCENT);
    const productId = await addProduct({ price: 1000, collaboratorId: personId });

    await t.mutation(api.products.recordSale, { productId, gross: 1000 });

    const sales = await t.run((ctx) => ctx.db.query("productSales").collect());
    expect(sales[0].collaboratorShare).toBe(600);
    expect(sales[0].studioShare).toBe(200);
    expect(sales[0].webOwnerShare).toBe(200);
  });

  it("always splits the full amount, with no rupee lost to rounding", async () => {
    await asOwner();
    const personId = await addPerson(60);
    // Prices that do not divide cleanly by the percentage.
    for (const gross of [99, 101, 333, 1001, 2248]) {
      const productId = await addProduct({ price: gross, collaboratorId: personId });
      await t.mutation(api.products.recordSale, { productId, gross });
    }
    const sales = await t.run((ctx) => ctx.db.query("productSales").collect());
    for (const sale of sales) expectSharesSumToGross(sale);
  });

  it("still owes the site its commission on a studio-only product", async () => {
    await asOwner();
    const productId = await addProduct({ price: 750 });
    await t.mutation(api.products.recordSale, { productId, gross: 750 });

    const sales = await t.run((ctx) => ctx.db.query("productSales").collect());
    expect(sales[0].collaboratorShare).toBe(0);
    expect(sales[0].studioShare).toBe(600);
    expect(sales[0].webOwnerShare).toBe(150);
    expect(sales[0].collaboratorId).toBeUndefined();
  });

  it("locks the split onto the product so later changes cannot rewrite it", async () => {
    await asOwner();
    const personId = await addPerson(60);
    const productId = await addProduct({ price: 1000, collaboratorId: personId });

    // The collaborator renegotiates down to 20% for everything after this.
    await t.mutation(api.products.updateCollaborator, {
      collaboratorId: personId as never,
      sharePercent: 20,
    });

    await t.mutation(api.products.recordSale, { productId, gross: 1000 });
    const sales = await t.run((ctx) => ctx.db.query("productSales").collect());
    // Still the 60% the product was created under, not the new 20%.
    expect(sales[0].collaboratorShare).toBe(600);
  });

  it("does not rewrite what an already-recorded sale owed", async () => {
    await asOwner();
    const personId = await addPerson(50);
    const productId = await addProduct({
      price: 1000,
      collaboratorId: personId,
      webOwnerSharePercent: 20,
    });
    await t.mutation(api.products.recordSale, { productId, gross: 1000 });

    // Raise their cut after the sale, then reprice the product.
    await t.mutation(api.products.updateCollaborator, {
      collaboratorId: personId as never,
      sharePercent: 80,
    });
    await t.mutation(api.products.updateProduct, { productId, price: 5000 });

    const sales = await t.run((ctx) => ctx.db.query("productSales").collect());
    expect(sales[0].collaboratorShare).toBe(500);
    expect(sales[0].studioShare).toBe(300);
    expectSharesSumToGross(sales[0]);
  });

  it("refuses a cut that would leave the studio nothing", async () => {
    await asOwner();
    await expect(addPerson(95)).rejects.toThrow(/between 0 and 90/i);
    const personId = await addPerson(60);
    await expect(
      addProduct({ price: 100, collaboratorId: personId, share: 100 }),
    ).rejects.toThrow(/more than 90%/i);
  });

  it("refuses a maker cut plus a site commission that add up over 90%", async () => {
    await asOwner();
    const personId = await addPerson(60);
    await expect(
      addProduct({
        price: 1000,
        collaboratorId: personId,
        share: 80,
        webOwnerSharePercent: 30,
      }),
    ).rejects.toThrow(/more than 90%/i);
  });

  it("refuses a product with no price", async () => {
    await asOwner();
    await expect(addProduct({ price: 0 })).rejects.toThrow(/above zero/i);
  });
});

describe("products — only one maker, ever", () => {
  it("stores a single collaborator id, so a second maker cannot be attached", async () => {
    await asOwner();
    const rhea = await addPerson(60, "Rhea");
    const priya = await addPerson(55, "Priya");

    const productId = await addProduct({ price: 1000, collaboratorId: rhea });
    await t.mutation(api.products.recordSale, { productId, gross: 1000 });

    const sales = await t.run((ctx) => ctx.db.query("productSales").collect());
    expect(sales[0].collaboratorId).toBe(rhea);
    expect(sales[0].collaboratorName).toBe("Rhea");

    // Re-pointing the product swaps the maker rather than adding a second one.
    await t.mutation(api.products.updateProduct, {
      productId,
      collaboratorId: priya as never,
    });
    const stored = await t.run(
      (ctx) => ctx.db.get(productId as never),
    );
    expect(stored?.collaboratorId).toBe(priya);

    // And the earlier sale still names only Rhea.
    const after = await t.run((ctx) => ctx.db.query("productSales").collect());
    expect(after[0].collaboratorName).toBe("Rhea");
    expect(after[0].collaboratorShare).toBe(600);
  });

  it("drops the maker's cut when a product is unassigned", async () => {
    await asOwner();
    const rhea = await addPerson(60, "Rhea");
    const productId = await addProduct({ price: 1000, collaboratorId: rhea });

    await t.mutation(api.products.updateProduct, {
      productId,
      collaboratorId: null,
    });
    await t.mutation(api.products.recordSale, { productId, gross: 1000 });

    const sales = await t.run((ctx) => ctx.db.query("productSales").collect());
    expect(sales[0].collaboratorShare).toBe(0);
    expect(sales[0].studioShare).toBe(800);
    expectSharesSumToGross(sales[0]);
  });
});

describe("products — access control", () => {
  it("hides the earnings dashboard from customers", async () => {
    await asOwner();
    signIn(await createUser(t, { email: "nosy@example.com" }));
    await expect(t.query(api.products.earnings, {})).rejects.toThrow(/Unauthorized/i);
    await expect(t.query(api.products.listForAdmin, {})).rejects.toThrow(/Unauthorized/i);
    await expect(
      t.mutation(api.products.addCollaborator, { name: "Fake" }),
    ).rejects.toThrow(/Unauthorized/i);
  });

  it("never leaks the payout email or the split to the public", async () => {
    await asOwner();
    const personId = await addPerson(60);
    await addProduct({ price: 1000, collaboratorId: personId });

    const publicPeople = await t.query(api.products.listPublicCollaborators, {});
    expect(publicPeople[0].payoutEmail).toBeUndefined();
    expect(publicPeople[0].sharePercent).toBeUndefined();

    const live = await t.query(api.products.listLive, {});
    // The shop shows who made it and what it costs, never the split.
    expect(live[0].price).toBe(1000);
    expect(live[0].madeWith?.name).toBe("Rhea");
    const serialised = JSON.stringify(live);
    expect(serialised).not.toContain("collaboratorShare");
    expect(serialised).not.toContain("webOwnerShare");
    expect(serialised).not.toContain("studioShare");
  });

  it("will not delete a collaborator who still has products", async () => {
    await asOwner();
    const personId = await addPerson(60);
    await addProduct({ price: 500, collaboratorId: personId });
    await expect(
      t.mutation(api.products.removeCollaborator, {
        collaboratorId: personId as never,
      }),
    ).rejects.toThrow(/still has/i);
  });

  it("only lists live products in the storefront", async () => {
    await asOwner();
    await addProduct({ price: 500 });
    await t.mutation(api.products.addProduct, {
      name: "Not ready",
      price: 800,
      status: "draft",
    });
    const live = await t.query(api.products.listLive, {});
    expect(live).toHaveLength(1);
    expect(live[0].name).toBe("Handmade teddy bear");
  });
});

describe("products — the dashboard adds up", () => {
  it("reports revenue, what is owed, what the studio keeps and the site cut", async () => {
    await asOwner();
    const personId = await addPerson(60);
    const bear = await addProduct({ price: 1000, collaboratorId: personId });
    const solo = await addProduct({ price: 500 });

    await t.mutation(api.products.recordSale, { productId: bear, gross: 1000 });
    await t.mutation(api.products.recordSale, { productId: bear, gross: 1000 });
    await t.mutation(api.products.recordSale, { productId: solo, gross: 500 });

    const report = await t.query(api.products.earnings, {});
    expect(report.totals.gross).toBe(2500);
    expect(report.totals.owedToCollaborators).toBe(1200);
    expect(report.totals.keptByStudio).toBe(800);
    expect(report.totals.productWebOwnerShare).toBe(500);
    expect(report.totals.studioMarginPercent).toBe(32);

    // Every recorded sale adds up.
    expect(report.totals.owedToCollaborators + report.totals.keptByStudio + report.totals.productWebOwnerShare).toBe(2500);

    const rhea = report.byCollaborator.find((p) => p.name === "Rhea");
    expect(rhea?.earned).toBe(1200);
    expect(rhea?.salesCount).toBe(2);
  });
});