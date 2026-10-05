// Partial mock for @convex-dev/auth/server.
//
// The schema spreads authTables from this module, so we provide the real table
// definitions (captured from @convex-dev/auth@0.0.90). Only getAuthUserId is
// overridden with a controllable identity so the harness can sign in test users.
//
// The shared identity is also exported here so the harness signIn() can reach it.
export const identity = { current: null as string | null } as { current: string | null };

export const authTables = {
  users: {
    indexes: [{ indexDescriptor: "email", fields: ["email"] }, { indexDescriptor: "phone", fields: ["phone"] }],
    stagedDbIndexes: [],
    searchIndexes: [],
    stagedSearchIndexes: [],
    vectorIndexes: [],
    stagedVectorIndexes: [],
    validator: {
      isOptional: "required",
      isConvexValidator: true,
      fields: {
        name: { isOptional: "optional", isConvexValidator: true, kind: "string" },
        image: { isOptional: "optional", isConvexValidator: true, kind: "string" },
        email: { isOptional: "optional", isConvexValidator: true, kind: "string" },
        emailVerificationTime: { isOptional: "optional", isConvexValidator: true, kind: "float64" },
        phone: { isOptional: "optional", isConvexValidator: true, kind: "string" },
        phoneVerificationTime: { isOptional: "optional", isConvexValidator: true, kind: "float64" },
        isAnonymous: { isOptional: "optional", isConvexValidator: true, kind: "boolean" },
      },
      kind: "object",
    },
  },
  authSessions: {
    indexes: [{ indexDescriptor: "userId", fields: ["userId"] }],
    stagedDbIndexes: [],
    searchIndexes: [],
    stagedSearchIndexes: [],
    vectorIndexes: [],
    stagedVectorIndexes: [],
    validator: {
      isOptional: "required",
      isConvexValidator: true,
      fields: {
        userId: { isOptional: "required", isConvexValidator: true, tableName: "users", kind: "id" },
        expirationTime: { isOptional: "required", isConvexValidator: true, kind: "float64" },
      },
      kind: "object",
    },
  },
  authAccounts: {
    indexes: [
      { indexDescriptor: "userIdAndProvider", fields: ["userId", "provider"] },
      { indexDescriptor: "providerAndAccountId", fields: ["provider", "providerAccountId"] },
    ],
    stagedDbIndexes: [],
    searchIndexes: [],
    stagedSearchIndexes: [],
    vectorIndexes: [],
    stagedVectorIndexes: [],
    validator: {
      isOptional: "required",
      isConvexValidator: true,
      fields: {
        userId: { isOptional: "required", isConvexValidator: true, tableName: "users", kind: "id" },
        provider: { isOptional: "required", isConvexValidator: true, kind: "string" },
        providerAccountId: { isOptional: "required", isConvexValidator: true, kind: "string" },
        secret: { isOptional: "optional", isConvexValidator: true, kind: "string" },
        emailVerified: { isOptional: "optional", isConvexValidator: true, kind: "string" },
        phoneVerified: { isOptional: "optional", isConvexValidator: true, kind: "string" },
      },
      kind: "object",
    },
  },
  authRefreshTokens: {
    indexes: [
      { indexDescriptor: "sessionId", fields: ["sessionId"] },
      { indexDescriptor: "sessionIdAndParentRefreshTokenId", fields: ["sessionId", "parentRefreshTokenId"] },
    ],
    stagedDbIndexes: [],
    searchIndexes: [],
    stagedSearchIndexes: [],
    vectorIndexes: [],
    stagedVectorIndexes: [],
    validator: {
      isOptional: "required",
      isConvexValidator: true,
      fields: {
        sessionId: { isOptional: "required", isConvexValidator: true, tableName: "authSessions", kind: "id" },
        expirationTime: { isOptional: "required", isConvexValidator: true, kind: "float64" },
        firstUsedTime: { isOptional: "optional", isConvexValidator: true, kind: "float64" },
        parentRefreshTokenId: { isOptional: "optional", isConvexValidator: true, tableName: "authRefreshTokens", kind: "id" },
      },
      kind: "object",
    },
  },
  authVerificationCodes: {
    indexes: [
      { indexDescriptor: "accountId", fields: ["accountId"] },
      { indexDescriptor: "code", fields: ["code"] },
    ],
    stagedDbIndexes: [],
    searchIndexes: [],
    stagedSearchIndexes: [],
    vectorIndexes: [],
    stagedVectorIndexes: [],
    validator: {
      isOptional: "required",
      isConvexValidator: true,
      fields: {
        accountId: { isOptional: "required", isConvexValidator: true, tableName: "authAccounts", kind: "id" },
        provider: { isOptional: "required", isConvexValidator: true, kind: "string" },
        code: { isOptional: "required", isConvexValidator: true, kind: "string" },
        expirationTime: { isOptional: "required", isConvexValidator: true, kind: "float64" },
        verifier: { isOptional: "optional", isConvexValidator: true, kind: "string" },
        emailVerified: { isOptional: "optional", isConvexValidator: true, kind: "string" },
        phoneVerified: { isOptional: "optional", isConvexValidator: true, kind: "string" },
      },
      kind: "object",
    },
  },
  authVerifiers: {
    indexes: [{ indexDescriptor: "signature", fields: ["signature"] }],
    stagedDbIndexes: [],
    searchIndexes: [],
    stagedSearchIndexes: [],
    vectorIndexes: [],
    stagedVectorIndexes: [],
    validator: {
      isOptional: "required",
      isConvexValidator: true,
      fields: {
        sessionId: { isOptional: "optional", isConvexValidator: true, tableName: "authSessions", kind: "id" },
        signature: { isOptional: "optional", isConvexValidator: true, kind: "string" },
      },
      kind: "object",
    },
  },
  authRateLimits: {
    indexes: [{ indexDescriptor: "identifier", fields: ["identifier"] }],
    stagedDbIndexes: [],
    searchIndexes: [],
    stagedSearchIndexes: [],
    vectorIndexes: [],
    stagedVectorIndexes: [],
    validator: {
      isOptional: "required",
      isConvexValidator: true,
      fields: {
        identifier: { isOptional: "required", isConvexValidator: true, kind: "string" },
        lastAttemptTime: { isOptional: "required", isConvexValidator: true, kind: "float64" },
        attemptsLeft: { isOptional: "required", isConvexValidator: true, kind: "float64" },
      },
      kind: "object",
    },
  },
};

export const getAuthUserId = async () => identity.current;

// Stubs for the other server exports so nothing throws a "missing export"
// error when the Convex functions under test reference them.
export const convexAuth = {} as never;
export const createAccount = async () => ({} as never);
export const getAuthSessionId = async () => null;
export const invalidateSessions = async () => {};
export const modifyAccountCredentials = async () => {};
export const retrieveAccount = async () => null;
export const signInViaProvider = async () => ({} as never);
