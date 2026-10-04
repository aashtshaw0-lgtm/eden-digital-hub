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

/** Public credits wall, ordered by influence so the loudest names sit on top. */
export const listAll = query({
  args: {},
  handler: async (ctx) => {
    const credits = await ctx.db.query("credits").collect();
    return credits
      .map((credit) => ({
        _id: credit._id,
        name: credit.name,
        greatness: credit.greatness,
        amount: credit.amount ?? 0,
        tier: tierFor(credit.amount ?? 0),
        influence: influenceFor(credit.amount ?? 0),
        createdAt: credit.createdAt,
      }))
      .sort((a, b) => b.influence - a.influence || b.createdAt - a.createdAt);
  },
});

/** Adds a name to the ledger by hand — admin only. */
export const add = mutation({
  args: {
    name: v.string(),
    greatness: v.optional(v.string()),
    amount: v.optional(v.number()),
  },
  handler: async (ctx, { name, greatness, amount }) => {
    await requireAdmin(ctx);
    const trimmed = name.trim();
    if (!trimmed) throw new Error("A credit needs a name.");
    const contribution = Math.max(0, amount ?? 0);
    return await ctx.db.insert("credits", {
      name: trimmed,
      greatness: greatness?.trim() || undefined,
      amount: contribution,
      tier: tierFor(contribution),
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
    amount: v.optional(v.number()),
  },
  handler: async (ctx, { creditId, name, greatness, amount }) => {
    await requireAdmin(ctx);
    const credit = await ctx.db.get(creditId);
    if (!credit) throw new Error("Credit not found.");
    const contribution = amount === undefined ? credit.amount ?? 0 : Math.max(0, amount);
    await ctx.db.patch(creditId, {
      name: name?.trim() || credit.name,
      greatness: greatness === undefined ? credit.greatness : greatness.trim() || undefined,
      amount: contribution,
      tier: tierFor(contribution),
    });
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
      tier,
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