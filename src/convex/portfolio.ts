import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { requireAdmin } from "./lib/rbac";

/** Admin-only signed URL for intake reference files. */
export const fileUrl = query({
  args: { storageId: v.id("_storage") },
  handler: async (ctx, { storageId }) => {
    await requireAdmin(ctx);
    return await ctx.storage.getUrl(storageId);
  },
});

/** Public gallery feed. */
export const list = query({
  args: {},
  handler: async (ctx) => {
    const items = await ctx.db.query("portfolioImages").collect();
    return await Promise.all(
      items.map(async (item) => ({
        _id: item._id,
        title: item.title ?? "Eden work",
        url:
          item.url ??
          (item.storageId ? ((await ctx.storage.getUrl(item.storageId)) ?? undefined) : undefined),
        createdAt: item.createdAt,
      })),
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

/** Saves an uploaded image (jpeg/png) into the gallery. */
export const add = mutation({
  args: { storageId: v.id("_storage"), title: v.optional(v.string()) },
  handler: async (ctx, { storageId, title }) => {
    await requireAdmin(ctx);
    await ctx.db.insert("portfolioImages", {
      storageId,
      title: title || "Untitled work",
      createdAt: Date.now(),
    });
    return null;
  },
});

export const remove = mutation({
  args: { id: v.id("portfolioImages") },
  handler: async (ctx, { id }) => {
    await requireAdmin(ctx);
    const item = await ctx.db.get(id);
    if (!item) return null;
    if (item.storageId) await ctx.storage.delete(item.storageId);
    await ctx.db.delete(id);
    return null;
  },
});
