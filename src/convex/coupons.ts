import { mutation, query } from "./_generated/server";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { enforceRateLimit } from "./lib/rateLimit";
import { requireAdmin } from "./lib/rbac";

/**
 * Discount coupons.
 *
 * A coupon is issued by the studio, optionally restricted to a named list of
 * people, redeemed once at checkout, and either kept for later or revoked. The
 * discount is always recomputed here from the stored code — the client never
 * sends an amount, so a tampered checkout cannot invent its own discount.
 */

/** A coupon never takes an order below zero. */
export const MAX_DISCOUNT_RATIO = 1;

/** Longest code we accept, so codes stay typeable and shareable. */
const MAX_CODE_LENGTH = 24;

/** Percent coupons are capped here; anything more is a full giveaway. */
const MAX_PERCENT = 100;

export type CouponKind = "flat" | "percent";

export interface CouponCheck {
  ok: boolean;
  /** Rupees to subtract, already clamped to the subtotal. */
  discount: number;
  /** Machine-readable outcome, surfaced to the client as a reason. */
  code:
    | "valid"
    | "not_found"
    | "inactive"
    | "expired"
    | "used_up"
    | "already_used"
    | "not_allowed";
  message: string;
  kind?: CouponKind;
  value?: number;
}

/** Normalises a typed code so "eden20" and " EDEN-20 " behave predictably. */
export function normalizeCode(code: string): string {
  return code.trim().toUpperCase().replace(/\s+/g, "");
}

/**
 * The rupee discount for a coupon against a subtotal.
 *
 * Kept pure and exported so the checkout preview and the server can never
 * disagree about what a client will actually pay.
 */
export function discountFor(
  coupon: { kind: CouponKind; value: number },
  subtotal: number,
): number {
  if (subtotal <= 0) return 0;
  const raw =
    coupon.kind === "flat"
      ? coupon.value
      : Math.round((subtotal * coupon.value) / 100);
  // Never more than the order is worth, so a coupon can't make a total negative.
  return Math.max(0, Math.min(raw, Math.round(subtotal * MAX_DISCOUNT_RATIO)));
}

/** Human label for a coupon, used in the admin list and client receipt line. */
export function describeCoupon(coupon: Doc<"coupons">): string {
  return coupon.kind === "flat"
    ? `₹${coupon.value.toLocaleString("en-IN")} off`
    : `${coupon.value}% off`;
}

function isExpired(coupon: Doc<"coupons">): boolean {
  return coupon.expiresAt !== undefined && coupon.expiresAt < Date.now();
}

async function countUses(
  ctx: QueryCtx | MutationCtx,
  couponId: Id<"coupons">,
): Promise<number> {
  const rows = await ctx.db
    .query("couponRedemptions")
    .withIndex("by_coupon", (q) => q.eq("couponId", couponId))
    .collect();
  return rows.length;
}

/**
 * Validates a code for one signed-in client and returns the discount.
 *
 * A mutation rather than a query on purpose: the per-account probe budget below
 * has to be written transactionally, and Convex forbids writes inside a query.
 * Left as a query, this endpoint was an unthrottled oracle for guessing the
 * studio's coupon codes — including ones shared privately with named people.
 */
export const validate = mutation({
  args: { code: v.string() },
  handler: async (ctx, args): Promise<CouponCheck> => {
    const code = normalizeCode(args.code);
    if (code === "") {
      return { ok: false, discount: 0, code: "not_found", message: "Enter a coupon code." };
    }

    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      return {
        ok: false,
        discount: 0,
        code: "not_found",
        message: "Sign in to use a coupon code.",
      };
    }

    // Codes are short and human-chosen ("EDEN20"), so guessing is cheap
    // without this. Twenty probes every ten minutes is enough to redeem a
    // shared code and hopeless as a sweep.
    await enforceRateLimit(ctx, {
      name: "couponValidate",
      key: userId,
      max: 20,
      windowMs: 600_000,
    });

    const coupon = await ctx.db
      .query("coupons")
      .withIndex("by_code", (q) => q.eq("code", code))
      .first();

    if (!coupon) {
      return {
        ok: false,
        discount: 0,
        code: "not_found",
        message: "That coupon code isn't recognised.",
      };
    }

    return await checkCoupon(ctx, coupon, userId);
  },
});

/**
 * Shared gate for both the pre-flight check and the real redemption, so a
 * coupon cannot pass validation at checkout and then fail (or double-apply)
 * when the order is written.
 */
async function checkCoupon(
  ctx: QueryCtx | MutationCtx,
  coupon: Doc<"coupons">,
  userId: Id<"users"> | null,
): Promise<CouponCheck> {
  const base = { kind: coupon.kind, value: coupon.value };

  if (coupon.active === false) {
    return {
      ok: false,
      discount: 0,
      code: "inactive",
      message: "This coupon has been switched off.",
      ...base,
    };
  }

  if (isExpired(coupon)) {
    return {
      ok: false,
      discount: 0,
      code: "expired",
      message: "This coupon has expired.",
      ...base,
    };
  }

  if (coupon.maxUses !== undefined) {
    const uses = await countUses(ctx, coupon._id);
    if (uses >= coupon.maxUses) {
      return {
        ok: false,
        discount: 0,
        code: "used_up",
        message: "This coupon has been fully redeemed.",
        ...base,
      };
    }
  }

  // A targeted coupon is only valid for the people it was shared with.
  if (coupon.allowedEmails && coupon.allowedEmails.length > 0) {
    const email = userId
      ? ((await ctx.db.get(userId))?.email ?? "").trim().toLowerCase()
      : "";
    const allowed = coupon.allowedEmails.map((e) => e.trim().toLowerCase());
    if (!email || !allowed.includes(email)) {
      return {
        ok: false,
        discount: 0,
        code: "not_allowed",
        message: "This coupon was shared with specific people only.",
        ...base,
      };
    }
  }

  if (userId) {
    const perClient = coupon.maxPerClient ?? 1;
    const mine = await ctx.db
      .query("couponRedemptions")
      .withIndex("by_coupon_user", (q) =>
        q.eq("couponId", coupon._id).eq("userId", userId),
      )
      .collect();
    if (mine.length >= perClient) {
      return {
        ok: false,
        discount: 0,
        code: "already_used",
        message:
          perClient === 1
            ? "You have already used this coupon."
            : `You have already used this coupon ${mine.length} times.`,
        ...base,
      };
    }
  }

  return {
    ok: true,
    // The caller supplies the subtotal when it knows it; 0 here just means
    // "valid, amount not computed yet".
    discount: 0,
    code: "valid",
    message: `${describeCoupon(coupon)} applied.`,
    ...base,
  };
}

/** Issues a new coupon — admin only. */
export const create = mutation({
  args: {
    code: v.string(),
    kind: v.union(v.literal("flat"), v.literal("percent")),
    value: v.number(),
    note: v.optional(v.string()),
    maxUses: v.optional(v.number()),
    maxPerClient: v.optional(v.number()),
    allowedEmails: v.optional(v.array(v.string())),
    expiresAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    const code = normalizeCode(args.code).slice(0, MAX_CODE_LENGTH);
    if (code.length < 3) throw new Error("A coupon code needs at least 3 characters.");

    const clash = await ctx.db
      .query("coupons")
      .withIndex("by_code", (q) => q.eq("code", code))
      .first();
    if (clash) throw new Error(`Coupon "${code}" already exists.`);

    if (!Number.isFinite(args.value) || args.value <= 0) {
      throw new Error("Enter a discount value above zero.");
    }
    if (args.kind === "percent" && args.value > MAX_PERCENT) {
      throw new Error(`A percentage coupon cannot exceed ${MAX_PERCENT}%.`);
    }
    if (args.kind === "flat" && args.value > 1_000_000) {
      throw new Error("That is too large a flat discount.");
    }

    if (args.maxUses !== undefined && args.maxUses <= 0) {
      throw new Error("Max uses must be at least 1 — leave it blank for unlimited.");
    }

    const emails = (args.allowedEmails ?? [])
      .map((e) => e.trim().toLowerCase())
      .filter((e) => e.includes("@"));

    return await ctx.db.insert("coupons", {
      code,
      kind: args.kind,
      value: args.kind === "percent" ? Math.round(args.value) : Math.round(args.value),
      note: args.note?.trim() || undefined,
      maxUses: args.maxUses,
      maxPerClient: args.maxPerClient,
      allowedEmails: emails.length > 0 ? emails : undefined,
      expiresAt: args.expiresAt,
      active: true,
      createdAt: Date.now(),
    });
  },
});

/** Every coupon with its live usage count — admin only. */
export const listForAdmin = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const coupons = await ctx.db.query("coupons").order("desc").collect();
    return await Promise.all(
      coupons.map(async (coupon) => {
        const redemptions = await ctx.db
          .query("couponRedemptions")
          .withIndex("by_coupon", (q) => q.eq("couponId", coupon._id))
          .collect();
        return {
          ...coupon,
          uses: redemptions.length,
          totalDiscount: redemptions.reduce((sum, r) => sum + r.discount, 0),
          expired: isExpired(coupon),
          exhausted:
            coupon.maxUses !== undefined && redemptions.length >= coupon.maxUses,
          restricted: (coupon.allowedEmails?.length ?? 0) > 0,
          label: describeCoupon(coupon),
        };
      }),
    );
  },
});

/** Pauses or resumes a coupon without losing its redemption history. */
export const setActive = mutation({
  args: { couponId: v.id("coupons"), active: v.boolean() },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    await ctx.db.patch(args.couponId, { active: args.active });
    return null;
  },
});

/** Deletes a coupon. Redemptions are kept so past orders stay explainable. */
export const remove = mutation({
  args: { couponId: v.id("coupons") },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    await ctx.db.delete(args.couponId);
    return null;
  },
});

/** Individual redemptions for one coupon — admin only. */
export const redemptionsFor = query({
  args: { couponId: v.id("coupons") },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const rows = await ctx.db
      .query("couponRedemptions")
      .withIndex("by_coupon", (q) => q.eq("couponId", args.couponId))
      .collect();
    return await Promise.all(
      rows.map(async (row) => {
        const user = await ctx.db.get(row.userId);
        return {
          _id: row._id,
          email: user?.email ?? "unknown",
          name: user?.name ?? "Client",
          discount: row.discount,
          createdAt: row.createdAt,
        };
      }),
    );
  },
});

/**
 * Records a redemption.
 *
 * Called by `orders.createWithProof` in the same transaction that writes the
 * order, so a coupon and its usage cannot drift apart.
 */
export async function recordRedemption(
  ctx: MutationCtx,
  args: {
    couponId: Id<"coupons">;
    userId: Id<"users">;
    discount: number;
    orderId?: Id<"orders">;
  },
): Promise<void> {
  await ctx.db.insert("couponRedemptions", {
    couponId: args.couponId,
    userId: args.userId,
    discount: args.discount,
    orderId: args.orderId,
    createdAt: Date.now(),
  });
}

/**
 * Resolves a code to a discount for a specific cart total, or throws with a
 * client-readable reason. Used at order time.
 */
export async function resolveForOrder(
  ctx: MutationCtx,
  args: { code: string; userId: Id<"users">; subtotal: number },
): Promise<{ couponId: Id<"coupons">; discount: number; label: string }> {
  const code = normalizeCode(args.code);
  const coupon = await ctx.db
    .query("coupons")
    .withIndex("by_code", (q) => q.eq("code", code))
    .first();
  if (!coupon) throw new Error("That coupon code isn't recognised.");

  const check = await checkCoupon(ctx, coupon, args.userId);
  if (!check.ok) throw new Error(check.message);

  const discount = discountFor(coupon, args.subtotal);
  if (discount <= 0) {
    throw new Error("That coupon doesn't reduce this order's total.");
  }
  return { couponId: coupon._id, discount, label: describeCoupon(coupon) };
}