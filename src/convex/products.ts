import { mutation, query } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { v } from "convex/values";
import { requireAdmin } from "./lib/rbac";
import {
  assertValidShares,
  DEFAULT_COLLABORATOR_PERCENT,
  DEFAULT_WEB_OWNER_PERCENT,
  MAX_OUTSIDE_SHARE_PERCENT,
  splitProductSale,
  splitServiceSale,
} from "./lib/split";

/**
 * Handmade products, the people who make them with the studio, and the split.
 *
 * A product is made by the studio alone or with **one** collaborator — the
 * schema holds a single `collaboratorId`, so there is no way to attach a second
 * or third maker to the same item.
 *
 * A sale splits three ways: the maker, the studio, and the web owner who runs
 * the site. Both percentages are snapshotted onto the product at save time, so
 * renegotiating a rate later never rewrites the terms of a sale that has
 * already happened.
 *
 * Every sale writes a `productSales` row with all three shares recorded.
 * Payouts are then a fact you can read, not a number recomputed from whatever
 * the product happens to cost today.
 */

/** Nobody's cut can exceed this, and the studio always keeps something. */
export const MAX_SHARE_PERCENT = MAX_OUTSIDE_SHARE_PERCENT;

/** Splits a product price the way a recorded sale would. */
function splitAmounts(
  gross: number,
  collaboratorPercent: number | undefined,
  webOwnerPercent: number | undefined,
) {
  return splitProductSale(
    gross,
    collaboratorPercent ?? 0,
    webOwnerPercent ?? DEFAULT_WEB_OWNER_PERCENT,
  );
}

// ── Collaborators ─────────────────────────────────────────────────────────

/** Everyone the studio collaborates with — admin only. */
export const listCollaborators = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const collaborators = await ctx.db.query("collaborators").order("desc").collect();
    return await Promise.all(
      collaborators.map(async (person) => {
        const sales = await ctx.db
          .query("productSales")
          .withIndex("by_collaborator_created", (q) =>
            q.eq("collaboratorId", person._id),
          )
          .collect();
        return {
          ...person,
          productCount: await ctx.db
            .query("products")
            .withIndex("by_collaborator", (q) => q.eq("collaboratorId", person._id))
            .collect()
            .then((rows) => rows.length),
          salesCount: sales.length,
          earned: sales.reduce((sum, s) => sum + s.collaboratorShare, 0),
        };
      }),
    );
  },
});

/** Public collaborator list — no payout details, no email. */
export const listPublicCollaborators = query({
  args: {},
  handler: async (ctx) => {
    const people = await ctx.db
      .query("collaborators")
      .filter((q) => q.eq(q.field("active"), true))
      .collect();
    return people.map((person) => ({
      _id: person._id,
      name: person.name,
      handle: person.handle,
      bio: person.bio,
    }));
  },
});

export const addCollaborator = mutation({
  args: {
    name: v.string(),
    handle: v.optional(v.string()),
    bio: v.optional(v.string()),
    sharePercent: v.optional(v.number()),
    payoutEmail: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const trimmed = args.name.trim();
    if (!trimmed) throw new Error("A collaborator needs a name.");

    const share = args.sharePercent ?? DEFAULT_COLLABORATOR_PERCENT;
    if (!Number.isFinite(share) || share < 0 || share > MAX_SHARE_PERCENT) {
      throw new Error(`Their cut must be between 0 and ${MAX_SHARE_PERCENT}%.`);
    }

    return await ctx.db.insert("collaborators", {
      name: trimmed,
      handle: args.handle?.trim() || undefined,
      bio: args.bio?.trim() || undefined,
      payoutEmail: args.payoutEmail?.trim() || undefined,
      sharePercent: Math.round(share),
      active: true,
      createdAt: Date.now(),
    });
  },
});

export const updateCollaborator = mutation({
  args: {
    collaboratorId: v.id("collaborators"),
    name: v.optional(v.string()),
    handle: v.optional(v.string()),
    bio: v.optional(v.string()),
    sharePercent: v.optional(v.number()),
    payoutEmail: v.optional(v.string()),
    active: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const person = await ctx.db.get(args.collaboratorId);
    if (!person) throw new Error("Collaborator not found.");

    const patch: Record<string, unknown> = {};
    if (args.name !== undefined) patch.name = args.name.trim() || person.name;
    if (args.handle !== undefined) patch.handle = args.handle.trim() || undefined;
    if (args.bio !== undefined) patch.bio = args.bio.trim() || undefined;
    if (args.payoutEmail !== undefined) {
      patch.payoutEmail = args.payoutEmail.trim() || undefined;
    }
    if (args.active !== undefined) patch.active = args.active;
    if (args.sharePercent !== undefined) {
      if (args.sharePercent < 0 || args.sharePercent > MAX_SHARE_PERCENT) {
        throw new Error(`Their cut must be between 0 and ${MAX_SHARE_PERCENT}%.`);
      }
      patch.sharePercent = Math.round(args.sharePercent);
    }

    await ctx.db.patch(args.collaboratorId, patch);
    return null;
  },
});

export const removeCollaborator = mutation({
  args: { collaboratorId: v.id("collaborators") },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const products = await ctx.db
      .query("products")
      .withIndex("by_collaborator", (q) => q.eq("collaboratorId", args.collaboratorId))
      .collect();
    if (products.length > 0) {
      throw new Error(
        `This person still has ${products.length} product(s). Move or delete them first.`,
      );
    }
    await ctx.db.delete(args.collaboratorId);
    return null;
  },
});

// ── Products ──────────────────────────────────────────────────────────────

/** Every product with its live split — admin only. */
export const listForAdmin = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const products = await ctx.db.query("products").order("desc").collect();
    const collaborators = await ctx.db.query("collaborators").collect();
    const byId = new Map(collaborators.map((p) => [p._id, p]));

    const sales = await ctx.db.query("productSales").collect();
    const soldByProduct = new Map<string, { count: number; gross: number }>();
    for (const sale of sales) {
      const key = sale.productId as string;
      const row = soldByProduct.get(key) ?? { count: 0, gross: 0 };
      row.count += 1;
      row.gross += sale.gross;
      soldByProduct.set(key, row);
    }

    return products.map((product) => {
      const person = product.collaboratorId
        ? byId.get(product.collaboratorId)
        : undefined;
      const split = splitAmounts(
        product.price,
        product.collaboratorId ? product.collaboratorSharePercent : 0,
        product.webOwnerSharePercent,
      );
      const sold = soldByProduct.get(product._id as string);
      return {
        ...product,
        collaboratorName: person?.name,
        imageUrl: product.imageStorageId
          ? null // resolved per-id below, to avoid N storage lookups in the list
          : undefined,
        perSale: split,
        soldCount: sold?.count ?? 0,
        grossEarned: sold?.gross ?? 0,
      };
    });
  },
});

/** Admin-only signed URL for a product photo. */
export const productImageUrl = query({
  args: { storageId: v.id("_storage") },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    return await ctx.storage.getUrl(args.storageId);
  },
});

/** The storefront feed. Live products only. */
export const listLive = query({
  args: {},
  handler: async (ctx) => {
    const products = await ctx.db
      .query("products")
      .withIndex("by_status_created", (q) => q.eq("status", "live"))
      .collect();
    const collaborators = await ctx.db.query("collaborators").collect();
    const byId = new Map(collaborators.map((p) => [p._id, p]));

    return await Promise.all(
      products.map(async (product) => {
        const person = product.collaboratorId
          ? byId.get(product.collaboratorId)
          : undefined;
        return {
          _id: product._id,
          name: product.name,
          description: product.description,
          price: product.price,
          imageUrl: product.imageStorageId
            ? ((await ctx.storage.getUrl(product.imageStorageId)) ?? undefined)
            : undefined,
          // Only the fact that they made it is public — never the split.
          madeWith: person ? { name: person.name, handle: person.handle } : undefined,
          createdAt: product.createdAt,
        };
      }),
    );
  },
});

export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    return await ctx.storage.generateUploadUrl();
  },
});

export const addProduct = mutation({
  args: {
    name: v.string(),
    price: v.number(),
    description: v.optional(v.string()),
    collaboratorId: v.optional(v.id("collaborators")),
    /** Overrides the collaborator's default cut for this product. */
    collaboratorSharePercent: v.optional(v.number()),
    /** Site commission on this product. Defaults to 20%. */
    webOwnerSharePercent: v.optional(v.number()),
    imageStorageId: v.optional(v.id("_storage")),
    status: v.optional(v.union(v.literal("draft"), v.literal("live"))),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const trimmed = args.name.trim();
    if (!trimmed) throw new Error("A product needs a name.");
    if (!Number.isFinite(args.price) || args.price <= 0) {
      throw new Error("Enter a selling price above zero.");
    }

    // The cut is snapshotted here so later edits to the collaborator's default
    // never change what this product owes.
    let sharePercent: number | undefined;
    if (args.collaboratorId) {
      const person = await ctx.db.get(args.collaboratorId);
      if (!person) throw new Error("That collaborator no longer exists.");
      sharePercent = Math.round(
        args.collaboratorSharePercent ??
          person.sharePercent ??
          DEFAULT_COLLABORATOR_PERCENT,
      );
    } else {
      sharePercent = undefined;
    }

    const webOwnerSharePercent = Math.round(
      args.webOwnerSharePercent ?? DEFAULT_WEB_OWNER_PERCENT,
    );
    // A studio-only product still owes the site commission, so validate against
    // 0 rather than skipping the check when there is no maker.
    assertValidShares(sharePercent ?? 0, webOwnerSharePercent);

    return await ctx.db.insert("products", {
      name: trimmed,
      description: args.description?.trim() || undefined,
      price: Math.round(args.price),
      collaboratorId: args.collaboratorId,
      collaboratorSharePercent: sharePercent,
      webOwnerSharePercent,
      imageStorageId: args.imageStorageId,
      status: args.status ?? "draft",
      createdAt: Date.now(),
    });
  },
});

export const updateProduct = mutation({
  args: {
    productId: v.id("products"),
    name: v.optional(v.string()),
    price: v.optional(v.number()),
    description: v.optional(v.string()),
    collaboratorId: v.optional(v.union(v.id("collaborators"), v.null())),
    collaboratorSharePercent: v.optional(v.number()),
    webOwnerSharePercent: v.optional(v.number()),
    status: v.optional(v.union(v.literal("draft"), v.literal("live"))),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const product = await ctx.db.get(args.productId);
    if (!product) throw new Error("Product not found.");

    const patch: Record<string, unknown> = {};
    if (args.name !== undefined) patch.name = args.name.trim() || product.name;
    if (args.description !== undefined) {
      patch.description = args.description.trim() || undefined;
    }
    if (args.price !== undefined) {
      if (!Number.isFinite(args.price) || args.price <= 0) {
        throw new Error("Enter a selling price above zero.");
      }
      patch.price = Math.round(args.price);
    }
    if (args.status !== undefined) patch.status = args.status;

    let nextCollaboratorShare = product.collaboratorSharePercent ?? 0;
    let hasCollaborator = Boolean(product.collaboratorId);

    // `null` is the explicit "remove the maker" signal. `undefined` means the
    // caller did not mention it, so it must be left alone — passing `undefined`
    // to `db.patch` is a no-op, which would silently fail to clear the field.
    if (args.collaboratorId !== undefined) {
      const nextId = args.collaboratorId ?? undefined;
      patch.collaboratorId = nextId;
      hasCollaborator = Boolean(nextId);
      if (nextId) {
        const person = await ctx.db.get(nextId);
        if (!person) throw new Error("That collaborator no longer exists.");
        nextCollaboratorShare = Math.round(
          args.collaboratorSharePercent ??
            person.sharePercent ??
            DEFAULT_COLLABORATOR_PERCENT,
        );
        patch.collaboratorSharePercent = nextCollaboratorShare;
      } else {
        patch.collaboratorSharePercent = undefined;
        nextCollaboratorShare = 0;
      }
    } else if (args.collaboratorSharePercent !== undefined) {
      if (
        args.collaboratorSharePercent < 0 ||
        args.collaboratorSharePercent > MAX_SHARE_PERCENT
      ) {
        throw new Error(`Their cut must be between 0 and ${MAX_SHARE_PERCENT}%.`);
      }
      nextCollaboratorShare = Math.round(args.collaboratorSharePercent);
      patch.collaboratorSharePercent = nextCollaboratorShare;
    }

    if (!hasCollaborator) {
      // No maker on this product, so only the site commission applies.
      nextCollaboratorShare = 0;
    }

    if (args.webOwnerSharePercent !== undefined) {
      if (
        args.webOwnerSharePercent < 0 ||
        args.webOwnerSharePercent > 100
      ) {
        throw new Error("The site commission must be between 0 and 100%.");
      }
      patch.webOwnerSharePercent = Math.round(args.webOwnerSharePercent);
    }

    assertValidShares(
      nextCollaboratorShare,
      (patch.webOwnerSharePercent as number | undefined) ??
        product.webOwnerSharePercent ??
        DEFAULT_WEB_OWNER_PERCENT,
    );

    await ctx.db.patch(args.productId, patch);
    return null;
  },
});

export const removeProduct = mutation({
  args: { productId: v.id("products") },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const product = await ctx.db.get(args.productId);
    if (!product) return null;
    if (product.imageStorageId) await ctx.storage.delete(product.imageStorageId);
    await ctx.db.delete(args.productId);
    return null;
  },
});

// ── Sales ─────────────────────────────────────────────────────────────────

/**
 * Records a product sale and the split it owes.
 *
 * All three shares are computed once, here, and stored — so what a collaborator
 * and the web owner are owed is a recorded fact rather than something that
 * changes if the product price or a percentage is edited later.
 */
export const recordSale = mutation({
  args: {
    productId: v.id("products"),
    gross: v.number(),
    orderId: v.optional(v.id("orders")),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const product = await ctx.db.get(args.productId);
    if (!product) throw new Error("Product not found.");

    const gross = Math.round(args.gross);
    if (!Number.isFinite(gross) || gross <= 0) {
      throw new Error("Enter what the customer actually paid.");
    }

    const person = product.collaboratorId
      ? await ctx.db.get(product.collaboratorId)
      : null;
    const split = splitAmounts(
      gross,
      product.collaboratorId ? product.collaboratorSharePercent : 0,
      product.webOwnerSharePercent,
    );

    return await ctx.db.insert("productSales", {
      productId: product._id,
      productName: product.name,
      collaboratorId: person?._id,
      collaboratorName: person?.name,
      gross,
      collaboratorShare: split.collaboratorShare,
      studioShare: split.studioShare,
      webOwnerShare: split.webOwnerShare,
      orderId: args.orderId,
      createdAt: Date.now(),
    });
  },
});

/**
 * The smart dashboard: where the money came from, what the studio kept, what
 * each collaborator is owed, and what the site owner earned — across both
 * handmade products and service orders.
 */
export const earnings = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const sales = await ctx.db.query("productSales").collect();
    const collaborators = await ctx.db.query("collaborators").collect();

    const gross = sales.reduce((sum, s) => sum + s.gross, 0);
    const owed = sales.reduce((sum, s) => sum + s.collaboratorShare, 0);
    const kept = sales.reduce((sum, s) => sum + s.studioShare, 0);
    // Rows written before the third split existed have no web-owner share, so
    // `?? 0` keeps the total honest instead of turning undefined into NaN.
    const productWebOwner = sales.reduce(
      (sum, s) => sum + (s.webOwnerShare ?? 0),
      0,
    );

    // Service orders: the site commission applies here too. Unpaid and declined
    // orders are excluded — nothing is owed on money that never arrived.
    const serviceOrders = await ctx.db
      .query("orders")
      .withIndex("by_status_created")
      .collect();
    const paidOrders = serviceOrders.filter(
      (o) => o.status === "approved" || o.status === "completed",
    );
    const serviceGross = paidOrders.reduce(
      (sum, o) => sum + Math.max(0, o.totalPrice ?? 0),
      0,
    );
    const serviceSplit = splitServiceSale(serviceGross);
    const serviceWebOwner = serviceSplit.webOwnerShare;

    const byCollaborator = collaborators
      .map((person) => {
        const theirs = sales.filter((s) => s.collaboratorId === person._id);
        return {
          _id: person._id,
          name: person.name,
          handle: person.handle,
          active: person.active !== false,
          defaultSharePercent: person.sharePercent ?? 0,
          salesCount: theirs.length,
          gross: theirs.reduce((sum, s) => sum + s.gross, 0),
          earned: theirs.reduce((sum, s) => sum + s.collaboratorShare, 0),
        };
      })
      .sort((a, b) => b.earned - a.earned);

    return {
      totals: {
        salesCount: sales.length,
        gross,
        owedToCollaborators: owed,
        keptByStudio: kept,
        studioMarginPercent: gross > 0 ? Math.round((kept / gross) * 100) : 0,
        productWebOwnerShare: productWebOwner,
        serviceGross,
        serviceWebOwnerShare: serviceWebOwner,
        webOwnerTotal: productWebOwner + serviceWebOwner,
        totalRevenue: gross + serviceGross,
      },
      byCollaborator,
      recentSales: sales
        .sort((a, b) => b.createdAt - a.createdAt)
        .slice(0, 25)
        .map((s) => ({
          _id: s._id,
          productName: s.productName,
          collaboratorName: s.collaboratorName,
          gross: s.gross,
          collaboratorShare: s.collaboratorShare,
          studioShare: s.studioShare,
          webOwnerShare: s.webOwnerShare ?? 0,
          createdAt: s.createdAt,
        })),
    };
  },
});

/** Type alias kept close to the queries that return these rows. */
export type CollaboratorDoc = Doc<"collaborators">;
export type ProductDoc = Doc<"products">;
export type ProductId = Id<"products">;