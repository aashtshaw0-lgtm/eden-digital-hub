import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { requireAdmin } from "./lib/rbac";

const DEFAULTS = {
  primaryColor: "#2f6b4f",
  backgroundColor: "#f6f2ea",
  upiId: "eden.payments@upi",
};

/**
 * `"studio.example/"` → `"https://studio.example"`. A bare host is promoted to
 * https because that is what a public site is served over; an empty value stays
 * empty, which the client reads as "use the current origin".
 */
export function normalizeSiteUrl(raw?: string | null): string | undefined {
  const trimmed = raw?.trim().replace(/\/+$/, "");
  if (!trimmed) return undefined;
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

/** Public read — powers the whole site's live theming + checkout payment block. */
export const get = query({
  args: {},
  handler: async (ctx) => {
    const row = await ctx.db.query("globalSettings").first();
    const qrImageUrl = row?.qrStorageId
      ? ((await ctx.storage.getUrl(row.qrStorageId)) ?? undefined)
      : undefined;
    // The studio name lives in the copy deck, so the hero's fallback accent
    // words follow it: rename the company and the headline follows.
    const brandRow = await ctx.db
      .query("siteContent")
      .withIndex("by_key", (q) => q.eq("key", "brand.name"))
      .first();
    const brandName = brandRow?.value?.trim() || "the studio";
    return {
      primaryColor: row?.primaryColor ?? DEFAULTS.primaryColor,
      backgroundColor: row?.backgroundColor ?? DEFAULTS.backgroundColor,
      upiId: row?.upiId ?? DEFAULTS.upiId,
      heroLead: row?.heroLead ?? "Elevate your brand",
      heroMode: row?.heroMode ?? "rotating",
      heroAccent: row?.heroAccent ?? `with ${brandName}`,
      heroAccentWords:
        row?.heroAccentWords?.length
          ? row.heroAccentWords
          : [`with ${brandName}`, "by hand", "for keeps", "that converts"],
      qrImageUrl,
      logoUrl: row?.logoStorageId ? ((await ctx.storage.getUrl(row.logoStorageId)) ?? undefined) : undefined,
      logoDarkUrl: row?.logoDarkStorageId
        ? ((await ctx.storage.getUrl(row.logoDarkStorageId)) ?? undefined)
        : undefined,
      logoMode: row?.logoMode ?? undefined,
      brandWord: row?.brandWord ?? undefined,
      brandTagline: row?.brandTagline ?? undefined,
      logoLightColor: row?.logoLightColor ?? undefined,
      logoDarkColor: row?.logoDarkColor ?? undefined,
      // Stored trimmed and without a trailing slash so the client can simply
      // concatenate a path onto it.
      siteUrl: normalizeSiteUrl(row?.siteUrl),
      twitterHandle: row?.twitterHandle?.trim() || undefined,
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
    logoStorageId: v.optional(v.id("_storage")),
    logoDarkStorageId: v.optional(v.id("_storage")),
    logoMode: v.optional(v.union(v.literal("image"), v.literal("text"))),
    brandWord: v.optional(v.string()),
    brandTagline: v.optional(v.string()),
    logoLightColor: v.optional(v.string()),
    logoDarkColor: v.optional(v.string()),
    siteUrl: v.optional(v.string()),
    twitterHandle: v.optional(v.string()),
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
      ...(args.logoStorageId !== undefined
        ? { logoStorageId: args.logoStorageId }
        : {}),
      ...(args.logoDarkStorageId !== undefined
        ? { logoDarkStorageId: args.logoDarkStorageId }
        : {}),
      ...(args.logoMode !== undefined ? { logoMode: args.logoMode } : {}),
      ...(args.brandWord !== undefined ? { brandWord: args.brandWord } : {}),
      ...(args.brandTagline !== undefined ? { brandTagline: args.brandTagline } : {}),
      ...(args.logoLightColor !== undefined ? { logoLightColor: args.logoLightColor } : {}),
      ...(args.logoDarkColor !== undefined ? { logoDarkColor: args.logoDarkColor } : {}),
      ...(args.siteUrl !== undefined
        ? { siteUrl: args.siteUrl.trim().replace(/\/+$/, "") }
        : {}),
      ...(args.twitterHandle !== undefined
        ? { twitterHandle: args.twitterHandle.trim() }
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
      const existingLogo = row.logoStorageId;
      if (args.logoStorageId !== undefined && existingLogo && existingLogo !== args.logoStorageId) {
        await ctx.storage.delete(existingLogo);
      }
      const existingDarkLogo = row.logoDarkStorageId;
      if (
        args.logoDarkStorageId !== undefined &&
        existingDarkLogo &&
        existingDarkLogo !== args.logoDarkStorageId
      ) {
        await ctx.storage.delete(existingDarkLogo);
      }
      await ctx.db.patch(row._id, {
        ...patch,
        ...(args.logoStorageId !== undefined
          ? { logoStorageId: args.logoStorageId }
          : {}),
        ...(args.logoDarkStorageId !== undefined
          ? { logoDarkStorageId: args.logoDarkStorageId }
          : {}),
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
        ...(args.siteUrl ? { siteUrl: args.siteUrl.trim().replace(/\/+$/, "") } : {}),
        ...(args.twitterHandle ? { twitterHandle: args.twitterHandle.trim() } : {}),
        ...(args.logoStorageId !== undefined ? { logoStorageId: args.logoStorageId } : {}),
        ...(args.logoDarkStorageId !== undefined
          ? { logoDarkStorageId: args.logoDarkStorageId }
          : {}),
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

/** Removes the currently stored logo (if different) then replaces it. */
export const setLogoImage = mutation({
  args: { storageId: v.id("_storage") },
  handler: async (ctx, { storageId }) => {
    await requireAdmin(ctx);
    const row = await ctx.db.query("globalSettings").first();
    if (row?.logoStorageId && row.logoStorageId !== storageId) {
      await ctx.storage.delete(row.logoStorageId);
    }
    if (row) {
      await ctx.db.patch(row._id, { logoStorageId: storageId, updatedAt: Date.now() });
    } else {
      await ctx.db.insert("globalSettings", {
        ...DEFAULTS,
        logoStorageId: storageId,
        socialLinks: { instagram: "", twitter: "", behance: "", linkedin: "" },
        updatedAt: Date.now(),
      });
    }
    return null;
  },
});

/** Removes the studio logo from global settings (keeps QR, colors, hero, links). */
export const clearLogo = mutation({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const row = await ctx.db.query("globalSettings").first();
    if (row?.logoStorageId) {
      await ctx.storage.delete(row.logoStorageId);
      await ctx.db.patch(row._id, { logoStorageId: null as never, updatedAt: Date.now() });
    }
    return null;
  },
});

/** Removes the dark-mode variant logo (if different) then replaces it. */
export const setLogoDarkImage = mutation({
  args: { storageId: v.id("_storage") },
  handler: async (ctx, { storageId }) => {
    await requireAdmin(ctx);
    const row = await ctx.db.query("globalSettings").first();
    if (row?.logoDarkStorageId && row.logoDarkStorageId !== storageId) {
      await ctx.storage.delete(row.logoDarkStorageId);
    }
    if (row) {
      await ctx.db.patch(row._id, { logoDarkStorageId: storageId, updatedAt: Date.now() });
    } else {
      await ctx.db.insert("globalSettings", {
        ...DEFAULTS,
        logoDarkStorageId: storageId,
        socialLinks: { instagram: "", twitter: "", behance: "", linkedin: "" },
        updatedAt: Date.now(),
      });
    }
    return null;
  },
});

/** Removes the dark-mode variant logo (keeps the light logo and other settings). */
export const clearLogoDark = mutation({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const row = await ctx.db.query("globalSettings").first();
    if (row?.logoDarkStorageId) {
      await ctx.storage.delete(row.logoDarkStorageId);
      await ctx.db.patch(row._id, { logoDarkStorageId: null as never, updatedAt: Date.now() });
    }
    return null;
  },
});
