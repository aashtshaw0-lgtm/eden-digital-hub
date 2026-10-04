import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { requireAdmin } from "./lib/rbac";

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

/**
 * Adds a new service with its tiers — admin only.
 *
 * The storefront reads services straight from the database, so a new entry
 * shows up immediately without a redeploy.
 */
export const addService = mutation({
  args: {
    name: v.string(),
    category: v.string(),
    tagline: v.optional(v.string()),
    tiers: v.array(
      v.object({
        name: v.string(),
        basePrice: v.number(),
        deliverables: v.array(v.string()),
      }),
    ),
  },
  handler: async (ctx, { name, category, tagline, tiers }) => {
    await requireAdmin(ctx);
    const trimmed = name.trim();
    if (!trimmed) throw new Error("A service needs a name.");
    if (tiers.length === 0) throw new Error("Add at least one tier.");

    const base = slugify(trimmed);
    const clash = await ctx.db
      .query("services")
      .withIndex("by_slug", (q) => q.eq("slug", base))
      .first();
    const slug = clash ? `${base}-${Date.now().toString(36).slice(-4)}` : base;

    const maxSort = await ctx.db
      .query("services")
      .collect()
      .then((rows) => rows.reduce((max, s) => Math.max(max, s.sortOrder ?? 0), 0));

    const serviceId = await ctx.db.insert("services", {
      name: trimmed,
      slug,
      category,
      tagline: tagline?.trim() || undefined,
      sortOrder: maxSort + 1,
    });

    for (const [index, tier] of tiers.entries()) {
      await ctx.db.insert("serviceTiers", {
        serviceId,
        name: tier.name.trim() || `Tier ${index + 1}`,
        basePrice: Math.max(0, tier.basePrice),
        deliverables: tier.deliverables,
        sortOrder: index + 1,
      });
    }
    return serviceId;
  },
});

/** Updates a tier's price, name or position — admin only. */
export const updateTier = mutation({
  args: {
    tierId: v.id("serviceTiers"),
    basePrice: v.optional(v.number()),
    name: v.optional(v.string()),
    sortOrder: v.optional(v.number()),
  },
  handler: async (ctx, { tierId, basePrice, name, sortOrder }) => {
    await requireAdmin(ctx);
    const tier = await ctx.db.get(tierId);
    if (!tier) throw new Error("Tier not found.");
    const patch: {
      basePrice?: number;
      name?: string;
      sortOrder?: number;
    } = {};
    if (basePrice !== undefined) {
      if (basePrice < 0) throw new Error("Price cannot be negative.");
      patch.basePrice = Math.round(basePrice);
    }
    if (name !== undefined && name.trim()) patch.name = name.trim();
    if (sortOrder !== undefined) patch.sortOrder = sortOrder;
    await ctx.db.patch(tierId, patch);
    return null;
  },
});

/** All services with their tiers, for the admin pricing panel. */
export const listForAdmin = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const services = await ctx.db.query("services").collect();
    return await Promise.all(
      services.map(async (service) => ({
        ...service,
        tiers: await ctx.db
          .query("serviceTiers")
          .withIndex("by_service", (q) => q.eq("serviceId", service._id))
          .collect(),
      })),
    );
  },
});