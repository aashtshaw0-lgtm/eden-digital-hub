import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { requireAdmin } from "./lib/rbac";

/**
 * Greatness tier thresholds.
 *
 * A credit below 100 is a standard mention. At 100 and above it becomes
 * premium, and at 500 and above it is legendary — the same two numbers the
 * studio uses for automatic influence ordering.
 */
export const LEGENDARY_THRESHOLD = 500;
export const PREMIUM_THRESHOLD = 100;

export type CreditTier = "standard" | "premium" | "legendary";

/** Maps a contribution amount to its greatness tier. */
export function tierFor(amount: number): CreditTier {
  if (amount >= LEGENDARY_THRESHOLD) return "legendary";
  if (amount >= PREMIUM_THRESHOLD) return "premium";
  return "standard";
}

/** Influence weight used to order the credits page — bigger contributions rank first. */
export function influenceFor(amount: number): number {
  const tier = tierFor(amount);
  const tierBonus =
    tier === "legendary" ? LEGENDARY_THRESHOLD : tier === "premium" ? PREMIUM_THRESHOLD : 0;
  return amount + tierBonus;
}

/**
 * Reduces a name to something safe to publish.
 *
 * The wall is public, so it shows a first name and a last initial — enough for
 * a supporter to recognise their own credit, not enough to publish someone's
 * full identity. Applied server-side in the query below, so the stored name
 * never leaves the backend for an anonymous visitor.
 */
export function maskName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "A supporter";
  // A single word is already all given name, so there is nothing to hide.
  if (parts.length === 1) return parts[0];
  const initial = parts[parts.length - 1].charAt(0).toUpperCase();
  return `${parts[0]} ${initial}.`;
}

/**
 * Public credits wall, ordered by influence so the loudest names sit on top.
 *
 * Two things are deliberately withheld: the rupee amount (the wall is a
 * thank-you, not a ledger) and the full name (see `maskName`). Tiers and
 * ordering still use the real values server-side, so ranking is unaffected.
 */
export const listAll = query({
  args: {},
  handler: async (ctx) => {
    const credits = await ctx.db.query("credits").collect();
    return credits
      .map((credit) => ({
        _id: credit._id,
        name: maskName(credit.name),
        greatness: credit.greatness,
        helpText: credit.helpText,
        tier: credit.tier ?? tierFor(credit.amount ?? 0),
        influence: influenceFor(credit.amount ?? 0),
        kind: (credit.kind ?? "tip") as "tip" | "marketing",
        createdAt: credit.createdAt,
      }))
      .sort((a, b) => b.influence - a.influence || b.createdAt - a.createdAt);
  },
});

/**
 * Full ledger for the admin console, including amounts.
 *
 * Split from `listAll` so the public wall cannot accidentally start leaking
 * what each person paid.
 */
export const listForAdmin = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const credits = await ctx.db.query("credits").collect();
    return credits
      .map((credit) => ({
        _id: credit._id,
        name: credit.name,
        greatness: credit.greatness,
        amount: credit.amount ?? 0,
        tier: tierFor(credit.amount ?? 0),
        kind: (credit.kind ?? "tip") as "tip" | "marketing",
        autoGranted: credit.autoGranted ?? false,
        createdAt: credit.createdAt,
      }))
      .sort((a, b) => b.createdAt - a.createdAt);
  },
});

/** Adds a name to the ledger by hand — admin only. */
export const add = mutation({
  args: {
    name: v.string(),
    greatness: v.optional(v.string()),
    /** Custom help text for marketing credits describing what they did. */
    helpText: v.optional(v.string()),
    amount: v.optional(v.number()),
    kind: v.optional(v.union(v.literal("tip"), v.literal("marketing"))),
    /** Tier to show for a marketing credit, which has no amount behind it. */
    tier: v.optional(v.union(v.literal("standard"), v.literal("premium"), v.literal("legendary"))),
  },
  handler: async (ctx, { name, greatness, amount, kind, tier }) => {
    await requireAdmin(ctx);
    const trimmed = name.trim();
    if (!trimmed) throw new Error("A credit needs a name.");

    const entryKind = kind ?? "tip";
    if (entryKind === "marketing") {
      // A marketing credit is a gesture, not a payment, so it carries no
      // amount — the studio picks the tier it wants to display.
      return await ctx.db.insert("credits", {
        name: trimmed,
        greatness: greatness?.trim() || undefined,
        tier: tier ?? "standard",
        kind: "marketing",
        helpText: undefined,
        createdAt: Date.now(),
      });
    }

    const contribution = Math.max(0, amount ?? 0);
    return await ctx.db.insert("credits", {
      name: trimmed,
      greatness: greatness?.trim() || undefined,
      amount: contribution,
      tier: tierFor(contribution),
      kind: "tip",
      createdAt: Date.now(),
    });
  },
});

/** Edits an existing ledger entry — admin only. */
export const update = mutation({
  args: {
    creditId: v.id("credits"),
    name: v.optional(v.string()),
    greatness: v.optional(v.string()),
    /** Custom help text for marketing credits describing what they did. */
    helpText: v.optional(v.string()),
    amount: v.optional(v.number()),
    kind: v.optional(v.union(v.literal("tip"), v.literal("marketing"))),
    tier: v.optional(v.union(v.literal("standard"), v.literal("premium"), v.literal("legendary"))),
  },
  handler: async (ctx, { creditId, name, greatness, amount, kind, tier }) => {
    await requireAdmin(ctx);
    const credit = await ctx.db.get(creditId);
    if (!credit) throw new Error("Credit not found.");

    const nextKind = kind ?? (credit.kind ?? "tip");
    const patch: Record<string, unknown> = {
      name: name?.trim() || credit.name,
      greatness: greatness === undefined ? credit.greatness : greatness.trim() || undefined,
      kind: nextKind,
    };

    if (nextKind === "marketing") {
      // Drop any stored amount so the entry can't leak a figure later.
      patch.amount = undefined;
      patch.tier = tier ?? credit.tier ?? "standard";
      patch.helpText = undefined;
    } else {
      const contribution = amount === undefined ? credit.amount ?? 0 : Math.max(0, amount);
      patch.amount = contribution;
      patch.tier = tier ?? tierFor(contribution);
    }

    await ctx.db.patch(creditId, patch);
    return null;
  },
});

/** Removes a ledger entry — admin only. */
export const remove = mutation({
  args: { creditId: v.id("credits") },
  handler: async (ctx, { creditId }) => {
    await requireAdmin(ctx);
    const credit = await ctx.db.get(creditId);
    if (!credit) throw new Error("Credit not found.");
    await ctx.db.delete(creditId);
    return null;
  },
});

/**
 * Grants a credit automatically when an order's tip clears a tier threshold.
 *
 * Used when an admin logs a tip manually against an existing order. The
 * checkout path calls the same gate inside `orders.recordTip` so the threshold
 * cannot be bypassed from the client.
 */
export const grantFromTip = mutation({
  args: { orderId: v.id("orders"), tipAmount: v.number() },
  handler: async (ctx, { orderId, tipAmount }) => {
    await requireAdmin(ctx);
    if (tipAmount < PREMIUM_THRESHOLD) return null;

    const order = await ctx.db.get(orderId);
    if (!order) throw new Error("Order not found.");

    const existing = await ctx.db
      .query("credits")
      .withIndex("by_source_order", (q) => q.eq("sourceOrderId", orderId))
      .first();

    const tier = tierFor(tipAmount);
    const fields = {
      name: order.clientName,
      greatness:
        tier === "legendary"
          ? "Legendary supporter — carried the studio."
          : "Premium supporter — tipped above the tier line.",
      amount: tipAmount,
      tier: tier as string,
      kind: "tip" as const,
      sourceOrderId: orderId,
      autoGranted: true,
    };

    if (existing) {
      await ctx.db.patch(existing._id, fields);
      return null;
    }
    return await ctx.db.insert("credits", { ...fields, createdAt: Date.now() });
  },
});