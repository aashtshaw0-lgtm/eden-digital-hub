import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { requireAdmin } from "./lib/rbac";

const DEFAULTS = {
  primaryColor: "#2f6b4f",
  backgroundColor: "#f6f2ea",
  upiId: "eden.payments@upi",
};

/** Public read — powers the whole site's live theming + checkout payment block. */
export const get = query({
  args: {},
  handler: async (ctx) => {
    const row = await ctx.db.query("globalSettings").first();
    const qrImageUrl = row?.qrStorageId
      ? ((await ctx.storage.getUrl(row.qrStorageId)) ?? undefined)
      : undefined;
    return {
      primaryColor: row?.primaryColor ?? DEFAULTS.primaryColor,
      backgroundColor: row?.backgroundColor ?? DEFAULTS.backgroundColor,
      upiId: row?.upiId ?? DEFAULTS.upiId,
      heroLead: row?.heroLead ?? "Elevate your brand",
      heroMode: row?.heroMode ?? "rotating",
      heroAccent: row?.heroAccent ?? "with Eden",
      heroAccentWords:
        row?.heroAccentWords?.length
          ? row.heroAccentWords
          : ["with Eden", "by hand", "for keeps", "that converts"],
      qrImageUrl,
      socialLinks: {
        instagram: row?.socialLinks?.instagram ?? "",
        twitter: row?.socialLinks?.twitter ?? "",
        behance: row?.socialLinks?.behance ?? "",
        linkedin: row?.socialLinks?.linkedin ?? "",
      },
      updatedAt: row?.updatedAt,
    };
  },
});

/** CMS write — managers and the super owner only. */
export const update = mutation({
  args: {
    primaryColor: v.optional(v.string()),
    backgroundColor: v.optional(v.string()),
    upiId: v.optional(v.string()),
    instagram: v.optional(v.string()),
    twitter: v.optional(v.string()),
    behance: v.optional(v.string()),
    linkedin: v.optional(v.string()),
    heroLead: v.optional(v.string()),
    heroMode: v.optional(v.union(v.literal("rotating"), v.literal("static"))),
    heroAccent: v.optional(v.string()),
    heroAccentWords: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const row = await ctx.db.query("globalSettings").first();
    const patch = {
      ...(args.primaryColor !== undefined ? { primaryColor: args.primaryColor } : {}),
      ...(args.backgroundColor !== undefined ? { backgroundColor: args.backgroundColor } : {}),
      ...(args.upiId !== undefined ? { upiId: args.upiId } : {}),
      ...(args.heroLead !== undefined ? { heroLead: args.heroLead } : {}),
      ...(args.heroMode !== undefined ? { heroMode: args.heroMode } : {}),
      ...(args.heroAccent !== undefined ? { heroAccent: args.heroAccent } : {}),
      ...(args.heroAccentWords !== undefined
        ? {
            heroAccentWords: args.heroAccentWords
              .map((w) => w.trim())
              .filter(Boolean)
              .slice(0, 8),
          }
        : {}),
      socialLinks: {
        instagram: args.instagram,
        twitter: args.twitter,
        behance: args.behance,
        linkedin: args.linkedin,
      },
      updatedAt: Date.now(),
    };
    if (row) {
      const current = row.socialLinks ?? {};
      await ctx.db.patch(row._id, {
        ...patch,
        socialLinks: {
          instagram: args.instagram ?? current.instagram ?? "",
          twitter: args.twitter ?? current.twitter ?? "",
          behance: args.behance ?? current.behance ?? "",
          linkedin: args.linkedin ?? current.linkedin ?? "",
        },
      });
    } else {
      await ctx.db.insert("globalSettings", {
        primaryColor: args.primaryColor ?? DEFAULTS.primaryColor,
        backgroundColor: args.backgroundColor ?? DEFAULTS.backgroundColor,
        upiId: args.upiId ?? DEFAULTS.upiId,
        socialLinks: {
          instagram: args.instagram ?? "",
          twitter: args.twitter ?? "",
          behance: args.behance ?? "",
          linkedin: args.linkedin ?? "",
        },
        updatedAt: Date.now(),
      });
    }
    return null;
  },
});

/** Step 1 of a QR upload — returns a short-lived storage upload URL. */
export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    return await ctx.storage.generateUploadUrl();
  },
});

/** Step 2 of a QR upload — swaps the stored QR image (deletes the old file). */
export const setQrImage = mutation({
  args: { storageId: v.id("_storage") },
  handler: async (ctx, { storageId }) => {
    await requireAdmin(ctx);
    const row = await ctx.db.query("globalSettings").first();
    if (row?.qrStorageId && row.qrStorageId !== storageId) {
      await ctx.storage.delete(row.qrStorageId);
    }
    if (row) {
      await ctx.db.patch(row._id, { qrStorageId: storageId, updatedAt: Date.now() });
    } else {
      await ctx.db.insert("globalSettings", {
        ...DEFAULTS,
        qrStorageId: storageId,
        socialLinks: { instagram: "", twitter: "", behance: "", linkedin: "" },
        updatedAt: Date.now(),
      });
    }
    return null;
  },
});
