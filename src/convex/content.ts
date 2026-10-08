import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { requireAdmin } from "./lib/rbac";

/**
 * The site's copy deck.
 *
 * Every editable string on the public site lives here as one row: a stable
 * `key` (e.g. "landing.hero.subtitle") and its text. The page components ship a
 * built-in default for each key, so this table only ever holds the keys an
 * admin has actually overridden — which is what makes "reset to default" a
 * delete rather than a stored copy of the shipped wording.
 */

/** Public read — the copy is on the public site, so it is not secret. */
export const list = query({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db.query("siteContent").collect();
    const map: Record<string, string> = {};
    for (const row of rows) map[row.key] = row.value;
    return map;
  },
});

/**
 * Bulk upsert used by the admin content editor. Empty (or whitespace-only)
 * values delete the override, which drops the key straight back to its shipped
 * default instead of leaving a blank spot on the site.
 */
export const setMany = mutation({
  args: {
    entries: v.array(v.object({ key: v.string(), value: v.string() })),
  },
  handler: async (ctx, { entries }) => {
    await requireAdmin(ctx);
    const now = Date.now();
    for (const { key, value } of entries) {
      const trimmed = value.trim();
      const existing = await ctx.db
        .query("siteContent")
        .withIndex("by_key", (q) => q.eq("key", key))
        .first();
      if (!trimmed) {
        if (existing) await ctx.db.delete(existing._id);
        continue;
      }
      if (existing) {
        if (existing.value !== trimmed) {
          await ctx.db.patch(existing._id, { value: trimmed, updatedAt: now });
        }
      } else {
        await ctx.db.insert("siteContent", { key, value: trimmed, updatedAt: now });
      }
    }
    return null;
  },
});

/** Drops one key — or every key — back to the built-in defaults. */
export const reset = mutation({
  args: { key: v.optional(v.string()) },
  handler: async (ctx, { key }) => {
    await requireAdmin(ctx);
    if (key === undefined) {
      const rows = await ctx.db.query("siteContent").collect();
      for (const row of rows) await ctx.db.delete(row._id);
      return null;
    }
    const existing = await ctx.db
      .query("siteContent")
      .withIndex("by_key", (q) => q.eq("key", key))
      .first();
    if (existing) await ctx.db.delete(existing._id);
    return null;
  },
});
