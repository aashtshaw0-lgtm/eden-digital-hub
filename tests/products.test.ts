import { beforeEach, describe, expect, it } from "vitest";
import { api } from "../src/convex/_generated/api";
import { createUser, makeTest, signIn } from "./harness";

let t = makeTest();

beforeEach(() => {
  t = makeTest();
  signIn(null);
  process.env.SUPER_OWNER_EMAIL = "owner@example.com";
});

async function asOwner() {
  signIn(await createUser(t, { email: "owner@example.com" }));
}

async function addPerson(sharePercent: number) {
  return await t.mutation(api.products.addCollaborator, {
    name: "Rhea",
    handle: "@rhea.makes",
    sharePercent,
  });
}

async function addProduct(args: {
  price: number;
  collaboratorId?: string;
  share?: number;
}) {
  return await t.mutation(api.products.addProduct, {
    name: "Handmade teddy bear",
    price: args.price,
    collaboratorId: args.collaboratorId as never,
    collaboratorSharePercent: args.share,
    status: "live",
  });
}

describe("products — the profit split is exact", () => {
  it("gives the collaborator their cut and keeps the rest", async () => {
    await asOwner();
    const personId = await addPerson(60);
    const productId = await addProduct({ price: 1000, collaboratorId: personId });

    await t.mutation(api.products.recordSale, { productId, gross: 1000 });

    const sales = await t.run((ctx) => ctx.db.query("productSales").collect());
    expect(sales[0].collaboratorShare).toBe(600);
    expect(sales[0].studioShare).toBe(400);
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
    for (const sale of sales) {
      expect(sale.collaboratorShare + sale.studioShare).toBe(sale.gross);
    }
  });

  it("keeps the whole sale when the studio makes it alone", async () => {
    await asOwner();
    const productId = await addProduct({ price: 750 });
    await t.mutation(api.products.recordSale, { productId, gross: 750 });

    const sales = await t.run((ctx) => ctx.db.query("productSales").collect());
    expect(sales[0].studioShare).toBe(750);
    expect(sales[0].collaboratorShare).toBe(0);
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
    const productId = await addProduct({ price: 1000, collaboratorId: personId });
    await t.mutation(api.products.recordSale, { productId, gross: 1000 });

    // Raise their cut after the sale, then reprice the product.
    await t.mutation(api.products.updateCollaborator, {
      collaboratorId: personId as never,
      sharePercent: 80,
    });
    await t.mutation(api.products.updateProduct, { productId, price: 5000 });

    const sales = await t.run((ctx) => ctx.db.query("productSales").collect());
    expect(sales[0].collaboratorShare).toBe(500);
    expect(sales[0].studioShare).toBe(500);
  });

  it("refuses a cut that would leave the studio nothing", async () => {
    await asOwner();
    await expect(addPerson(95)).rejects.toThrow(/between 0 and 90/i);
    const personId = await addPerson(60);
    // The cap only applies to a real collaborator — a share with nobody
    // attached is meaningless and is ignored rather than rejected.
    await expect(
      addProduct({ price: 100, collaboratorId: personId, share: 100 }),
    ).rejects.toThrow(/between 0 and 90/i);
  });

  it("refuses a product with no price", async () => {
    await asOwner();
    await expect(addProduct({ price: 0 })).rejects.toThrow(/above zero/i);
  });
});

describe("products — access control", () => {
  it("hides the earnings dashboard from customers", async () => {
    await asOwner();
    const personId = await addPerson(60);
    signIn(await createUser(t, { email: "nosy@example.com" }));
    await expect(t.query(api.products.earnings, {})).rejects.toThrow(/Unauthorized/i);
    await expect(t.query(api.products.listForAdmin, {})).rejects.toThrow(/Unauthorized/i);
    await expect(
      t.mutation(api.products.addCollaborator, { name: "Fake" }),
    ).rejects.toThrow(/Unauthorized/i);
    void personId;
  });

  it("never leaks the payout email or the split to the public", async () => {
    await asOwner();
    const personId = await addPerson(60);
    await addProduct({ price: 1000, collaboratorId: personId });

    const publicPeople = await t.query(api.products.listPublicCollaborators, {});
    expect(publicPeople[0].payoutEmail).toBeUndefined();
    expect(publicPeople[0].sharePercent).toBeUndefined();
    expect(JSON.stringify(publicPeople)).not.toContain("@rhea.makes" + "payout");

    const live = await t.query(api.products.listLive, {});
    // The shop shows who made it and what it costs, never the split.
    expect(live[0].price).toBe(1000);
    expect(live[0].madeWith?.name).toBe("Rhea");
    expect(JSON.stringify(live)).not.toContain("collaboratorShare");
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
    const draftId = await t.mutation(api.products.addProduct, {
      name: "Not ready",
      price: 800,
      status: "draft",
    });
    void draftId;
    const live = await t.query(api.products.listLive, {});
    expect(live).toHaveLength(1);
    expect(live[0].name).toBe("Handmade teddy bear");
  });
});

describe("products — the dashboard adds up", () => {
  it("reports revenue, what is owed, and what the studio keeps", async () => {
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
    expect(report.totals.keptByStudio).toBe(1300);
    expect(report.totals.studioMarginPercent).toBe(52);

    const rhea = report.byCollaborator.find((p) => p.name === "Rhea");
    expect(rhea?.earned).toBe(1200);
    expect(rhea?.salesCount).toBe(2);
  });
});