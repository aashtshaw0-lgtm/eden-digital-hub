import { mutation, query } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { v } from "convex/values";
import { requireAdmin } from "./lib/rbac";

/**
 * Handmade products, the people who make them with the studio, and the split.
 *
 * A product can be made by the studio alone or with a collaborator. When a
 * collaborator is attached, `collaboratorSharePercent` is snapshotted onto the
 * product at save time, so changing their default later never rewrites the
 * terms of a sale that has already happened.
 *
 * Every sale writes a `productSales` row with both halves of the money
 * recorded. Payouts are then a fact you can read, not a number recomputed from
 * whatever the product happens to cost today.
 */

/** Nobody's cut can exceed this, and the studio always keeps something. */
export const MAX_SHARE_PERCENT = 90;

/** Rounds to whole rupees — the split must always add up exactly. */
function splitAmounts(
  gross: number,
  collaboratorPercent: number | undefined,
): { collaboratorShare: number; studioShare: number } {
  const clamped = Math.max(
    0,
    Math.min(collaboratorPercent ?? 0, MAX_SHARE_PERCENT),
  );
  const collaboratorShare = Math.round((gross * clamped) / 100);
  // Studio share is derived from the same integer total, so the two halves can
  // never drift apart by a rupee.
  return { collaboratorShare, studioShare: gross - collaboratorShare };
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

    const share = args.sharePercent ?? 0;
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
      const { collaboratorShare, studioShare } = splitAmounts(
        product.price,
        product.collaboratorId ? product.collaboratorSharePercent : 0,
      );
      const sold = soldByProduct.get(product._id as string);
      return {
        ...product,
        collaboratorName: person?.name,
        imageUrl: product.imageStorageId
          ? null // resolved per-id below, to avoid N storage lookups in the list
          : undefined,
        perSale: { collaboratorShare, studioShare },
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
      sharePercent = args.collaboratorSharePercent ?? person.sharePercent ?? 0;
      if (sharePercent < 0 || sharePercent > MAX_SHARE_PERCENT) {
        throw new Error(`Their cut must be between 0 and ${MAX_SHARE_PERCENT}%.`);
      }
      sharePercent = Math.round(sharePercent);
    }

    return await ctx.db.insert("products", {
      name: trimmed,
      description: args.description?.trim() || undefined,
      price: Math.round(args.price),
      collaboratorId: args.collaboratorId,
      collaboratorSharePercent: sharePercent,
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
    collaboratorId: v.optional(v.id("collaborators")),
    collaboratorSharePercent: v.optional(v.number()),
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

    if (args.collaboratorId !== undefined) {
      patch.collaboratorId = args.collaboratorId;
      if (args.collaboratorId) {
        const person = await ctx.db.get(args.collaboratorId);
        if (!person) throw new Error("That collaborator no longer exists.");
        patch.collaboratorSharePercent = Math.round(
          args.collaboratorSharePercent ?? person.sharePercent ?? 0,
        );
      } else {
        patch.collaboratorSharePercent = undefined;
      }
    } else if (args.collaboratorSharePercent !== undefined) {
      if (
        args.collaboratorSharePercent < 0 ||
        args.collaboratorSharePercent > MAX_SHARE_PERCENT
      ) {
        throw new Error(`Their cut must be between 0 and ${MAX_SHARE_PERCENT}%.`);
      }
      patch.collaboratorSharePercent = Math.round(args.collaboratorSharePercent);
    }

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
 * Both halves are computed once, here, and stored — so what a collaborator is
 * owed is a recorded fact rather than something that changes if the product
 * price or their default percentage is edited later.
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
    const { collaboratorShare, studioShare } = splitAmounts(
      gross,
      product.collaboratorId ? product.collaboratorSharePercent : 0,
    );

    return await ctx.db.insert("productSales", {
      productId: product._id,
      productName: product.name,
      collaboratorId: person?._id,
      collaboratorName: person?.name,
      gross,
      collaboratorShare,
      studioShare,
      orderId: args.orderId,
      createdAt: Date.now(),
    });
  },
});

/**
 * The smart dashboard: where the money came from, what the studio kept, and
 * what each collaborator is owed.
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
          createdAt: s.createdAt,
        })),
    };
  },
});

/** Type alias kept close to the queries that return these rows. */
export type CollaboratorDoc = Doc<"collaborators">;
export type ProductDoc = Doc<"products">;
export type ProductId = Id<"products">;