import { convexTest } from "convex-test";
import { vi } from "vitest";
import schema from "../src/convex/schema";

/**
 * The Convex modules under test.
 *
 * `convexTest`'s second argument is a module map, not a path — when you supply
 * one it drops its own `import.meta.glob`, which only looks for a top-level
 * `convex/` directory. This app keeps its functions in `src/convex`, so the map
 * is built here.
 */
const modules = import.meta.glob("../src/convex/**/*.{ts,js}");

/**
 * Runs the real Convex functions against an in-memory backend.
 *
 * Auth is the one thing convex-test cannot drive, so `getAuthUserId` is mocked
 * with a mutable identity. Everything else — RBAC, rate limits, coupon rules,
 * transaction boundaries — is the shipped code under test.
 */
const identity = { current: null as string | null };

// Partial mock: only `getAuthUserId` is stubbed. The rest of the module (notably
// `authTables`, which the schema spreads) must stay real.
vi.mock("@convex-dev/auth/server", async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
    getAuthUserId: async () => identity.current,
  };
});

/** Signs the next request as this user id (or null for signed out). */
export function signIn(userId: string | null) {
  identity.current = userId;
}

export function makeTest() {
  return convexTest(schema, modules);
}

/** Creates a user row and returns its id. */
export async function createUser(
  t: ReturnType<typeof makeTest>,
  fields: { name?: string; email?: string; role?: string } = {},
) {
  return await t.run(async (ctx) => {
    return await ctx.db.insert("users", {
      name: fields.name ?? "User",
      email: fields.email ?? `${Math.random().toString(36).slice(2)}@example.com`,
      role: fields.role as never,
    });
  });
}

/** Creates a catalog service + tier, since orders need both. */
export async function createServiceWithTier(
  t: ReturnType<typeof makeTest>,
  basePrice: number,
) {
  return await t.run(async (ctx) => {
    const serviceId = await ctx.db.insert("services", {
      name: "Logo Design",
      slug: `logo-${Math.random().toString(36).slice(2, 8)}`,
      category: "design",
    });
    const tierId = await ctx.db.insert("serviceTiers", {
      serviceId,
      name: "Basic",
      basePrice,
      deliverables: ["One concept"],
    });
    return { serviceId, tierId };
  });
}