// Partial mock for @convex-dev/auth/server.
//
// The real module pulls in `server-only` and the whole Auth.js stack, which
// cannot be imported in the vitest (node) environment. The schema still spreads
// these tables, so the definitions below are the ones shipped by
// @convex-dev/auth@0.0.90 — rebuilt with the *real* `defineTable`/`v` from
// `convex/server` rather than hand-rolled object literals.
//
// That detail matters: convex-test calls `tableSchema.export()` on every table
// it is handed, and only a genuine `defineTable` result has that method (plus
// the compiled index metadata). Plain objects made convex-test throw
// "tableSchema.export is not a function" before a single test could run.
//
// `users` here is overridden by src/convex/schema.ts, which defines its own
// users table after spreading authTables; the remaining auth tables are the
// ones the in-memory backend actually uses.
import { defineTable } from "convex/server";
import { v } from "convex/values";

export const authTables = {
  users: defineTable({
    name: v.optional(v.string()),
    image: v.optional(v.string()),
    email: v.optional(v.string()),
    emailVerificationTime: v.optional(v.number()),
    phone: v.optional(v.string()),
    phoneVerificationTime: v.optional(v.number()),
    isAnonymous: v.optional(v.boolean()),
  })
    .index("email", ["email"])
    .index("phone", ["phone"]),

  authSessions: defineTable({
    userId: v.id("users"),
    expirationTime: v.number(),
  }).index("userId", ["userId"]),

  authAccounts: defineTable({
    userId: v.id("users"),
    provider: v.string(),
    providerAccountId: v.string(),
    secret: v.optional(v.string()),
    emailVerified: v.optional(v.string()),
    phoneVerified: v.optional(v.string()),
  })
    .index("userIdAndProvider", ["userId", "provider"])
    .index("providerAndAccountId", ["provider", "providerAccountId"]),

  authRefreshTokens: defineTable({
    sessionId: v.id("authSessions"),
    expirationTime: v.number(),
    firstUsedTime: v.optional(v.number()),
    parentRefreshTokenId: v.optional(v.id("authRefreshTokens")),
  })
    .index("sessionId", ["sessionId"])
    .index("sessionIdAndParentRefreshTokenId", [
      "sessionId",
      "parentRefreshTokenId",
    ]),

  authVerificationCodes: defineTable({
    accountId: v.id("authAccounts"),
    provider: v.string(),
    code: v.string(),
    expirationTime: v.number(),
    verifier: v.optional(v.string()),
    emailVerified: v.optional(v.string()),
    phoneVerified: v.optional(v.string()),
  })
    .index("accountId", ["accountId"])
    .index("code", ["code"]),

  authVerifiers: defineTable({
    sessionId: v.optional(v.id("authSessions")),
    signature: v.optional(v.string()),
  }).index("signature", ["signature"]),

  authRateLimits: defineTable({
    identifier: v.string(),
    lastAttemptTime: v.number(),
    attemptsLeft: v.number(),
  }).index("identifier", ["identifier"]),
};

// `getAuthUserId` is overridden by tests/harness.ts with its own controllable
// identity, so this implementation is only a fallback for direct importers.
export const getAuthUserId = async () => null;

// Stubs for the other server exports so nothing throws a "missing export"
// error when the Convex functions under test reference them.
export const convexAuth = {} as never;
export const createAccount = async () => ({} as never);
export const getAuthSessionId = async () => null;
export const invalidateSessions = async () => {};
export const modifyAccountCredentials = async () => {};
export const retrieveAccount = async () => null;
export const signInViaProvider = async () => ({} as never);
