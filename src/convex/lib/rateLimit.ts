import type { MutationCtx } from "../_generated/server";

export type RateLimitOptions = {
  /** Which limit this is, e.g. "chatSend". */
  name: string;
  /** Caller identity — usually the user id. */
  key: string;
  /** Maximum actions allowed per window. */
  max: number;
  /** Window length in ms. */
  windowMs: number;
};

/**
 * Fixed-window rate limiter backed by the rateLimits table.
 *
 * Runs inside the caller's mutation transaction, so concurrent calls that hit
 * the same row conflict and are retried by Convex — counts stay accurate
 * without any extra infrastructure.
 *
 * Throws a user-friendly error when the caller exceeds the limit.
 */
export async function enforceRateLimit(
  ctx: MutationCtx,
  { name, key, max, windowMs }: RateLimitOptions,
): Promise<void> {
  const now = Date.now();
  const row = await ctx.db
    .query("rateLimits")
    .withIndex("by_name_key", (q) => q.eq("name", name).eq("key", key))
    .first();

  if (!row) {
    await ctx.db.insert("rateLimits", { name, key, count: 1, windowStart: now });
    return;
  }

  if (now - row.windowStart >= windowMs) {
    await ctx.db.patch(row._id, { count: 1, windowStart: now });
    return;
  }

  if (row.count >= max) {
    const waitSec = Math.max(1, Math.ceil((row.windowStart + windowMs - now) / 1000));
    throw new Error(
      `You're moving too fast — try again in ${waitSec > 60 ? `${Math.ceil(waitSec / 60)} min` : `${waitSec}s`}.`,
    );
  }

  await ctx.db.patch(row._id, { count: row.count + 1 });
}
