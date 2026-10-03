import { getAuthUserId } from "@convex-dev/auth/server";
import type { Doc } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import type { Role } from "../schema";

/** Env-configured super owner email (set SUPER_OWNER_EMAIL in the Keys tab). */
export function superOwnerEmail(): string | null {
  const email = process.env.SUPER_OWNER_EMAIL;
  return email ? email.toLowerCase() : null;
}

/**
 * Effective role = stored role, promoted to super_owner when the user's email
 * matches SUPER_OWNER_EMAIL. Equivalent of the SQL role trigger, computed
 * server-side so the client can never claim a role.
 */
export function effectiveRole(user: Doc<"users"> | null): Role {
  if (!user) return "customer";
  const envEmail = superOwnerEmail();
  if (envEmail && user.email && user.email.toLowerCase() === envEmail) {
    return "super_owner";
  }
  return user.role ?? "customer";
}

export async function getViewer(ctx: QueryCtx): Promise<Doc<"users"> | null> {
  const userId = await getAuthUserId(ctx);
  if (userId === null) return null;
  return await ctx.db.get(userId);
}

const ADMIN_ROLES: Role[] = ["manager", "super_owner"];

/** Throws unless the caller holds one of the given roles. */
export async function requireRole(
  ctx: MutationCtx | QueryCtx,
  roles: Role[],
): Promise<{ user: Doc<"users">; role: Role }> {
  const user = await getViewer(ctx);
  const role = effectiveRole(user);
  if (!user || !roles.includes(role)) {
    throw new Error("Unauthorized: insufficient permissions.");
  }
  return { user, role };
}

export async function requireAdmin(ctx: MutationCtx | QueryCtx) {
  return requireRole(ctx, ADMIN_ROLES);
}

export async function requireSuperOwner(ctx: MutationCtx | QueryCtx) {
  return requireRole(ctx, ["super_owner"]);
}
