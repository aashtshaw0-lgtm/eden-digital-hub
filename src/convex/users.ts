import { getAuthUserId } from "@convex-dev/auth/server";
import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { effectiveRole, requireAdmin, requireSuperOwner, superOwnerEmail } from "./lib/rbac";
import { ROLES } from "./schema";

/**
 * Get the current signed in user. Returns null if the user is not signed in.
 * Usage: const signedInUser = await ctx.runQuery(api.authHelpers.currentUser);
 * THIS FUNCTION IS READ-ONLY. DO NOT MODIFY.
 */
export const currentUser = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return null;
    return await ctx.db.get(userId);
  },
});

/** Effective role for the signed-in user (computes SUPER_OWNER_EMAIL promotion server-side). */
export const myRole = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return null;
    const user = await ctx.db.get(userId);
    return effectiveRole(user);
  },
});

/** Called after sign-in: auto-promotes the env-configured super owner. */
export const syncUserRole = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return null;
    const user = await ctx.db.get(userId);
    if (!user) return null;
    const role = effectiveRole(user);
    if (role === ROLES.SUPER_OWNER && user.role !== ROLES.SUPER_OWNER) {
      await ctx.db.patch(userId, { role: ROLES.SUPER_OWNER });
    }
    return role;
  },
});

/** All registered users with effective roles — admin only. */
export const listAll = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const users = await ctx.db.query("users").collect();
    return users.map((u) => ({
      _id: u._id,
      name: u.name,
      email: u.email,
      role: effectiveRole(u),
      createdAt: u._creationTime,
    }));
  },
});

/** Assign / remove the manager role — super owner only. */
export const setRole = mutation({
  args: { userId: v.id("users"), role: v.union(v.literal("customer"), v.literal("manager")) },
  handler: async (ctx, { userId, role }) => {
    const { user: caller } = await requireSuperOwner(ctx);
    if (userId === caller._id) {
      throw new Error("You cannot change your own role.");
    }
    const target = await ctx.db.get(userId);
    if (!target) throw new Error("User not found.");
    const envEmail = superOwnerEmail();
    if (envEmail && target.email && target.email.toLowerCase() === envEmail) {
      throw new Error("The super owner role is protected and cannot be changed here.");
    }
    await ctx.db.patch(userId, { role });
    return null;
  },
});
