import { getAuthUserId } from "@convex-dev/auth/server";
import { internalMutation } from "./_generated/server";
import { enforceRateLimit } from "./lib/rateLimit";

/**
 * Per-account budget for the sales assistant.
 *
 * The assistant itself lives in `ai.ts`, which is `"use node"` and therefore may
 * only export actions. Actions have no db, so the limiter cannot run inline —
 * this internal mutation is called by the action before it spends anything on
 * a metered model.
 */
export const consumeAssistantQuota = internalMutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Sign in to chat with the studio.");
    await enforceRateLimit(ctx, {
      name: "assistantReply",
      key: userId,
      max: 30,
      windowMs: 60_000,
    });
    return null;
  },
});