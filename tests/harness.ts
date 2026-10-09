import { convexTest } from "convex-test";
import { vi } from "vitest";
import type { Test } from "convex-test";
import schema from "../src/convex/schema";

/**
 * The Convex modules under test.
 *
 * `convexTest`'s second argument is a module map, not a path — when you supply
 * one it drops its own `import.meta.glob`, which only looks for a top-level
 * `convex/` directory. This app keeps its functions in `src/convex`, so the map
 * is built here.
 *
 * Bun's plain `bun test` runtime does not always expose `import.meta.glob`,
 * so this polyfills it with a filesystem-backed shim that returns the same
 * `{ [pattern]: factory }` shape convex-test expects.
 */
if (typeof import.meta.glob !== "function") {
  (import.meta as Record<string, unknown>).glob = function (
    pattern: string,
  ): Record<string, () => Promise<unknown>> {
    const fs = require("fs");
    const path = require("path");
    const url = require("url");
    const cache = new Map<string, () => Promise<unknown>>();
    // __dirname is not available in ESM; derive it from import.meta.url.
    let dir: string;
    if ("dirname" in import.meta && typeof import.meta.dirname === "string") {
      dir = import.meta.dirname;
    } else {
      dir = path.dirname(url.fileURLToPath(import.meta.url));
    }
    // Strip the glob suffix to get the base directory. The pattern may look
    // like "../src/convex/**/*.{ts,js}" — we need the directory portion only.
    const globPattern = pattern.replace(/^\.\//, "");
    // Remove a trailing glob segment like "/**/*.{ts,js}" or "/*.ts" to find
    // the root directory that the pattern is anchored on.
    const anchor = globPattern.replace(/[/\\][*][*].*$/, "").replace(/[/\\].*$/, "");
    const baseDir = path.resolve(dir, anchor);

    function collect(dir: string, out: string[]) {
      let entries: ReturnType<typeof fs.readdirSync>;
      try {
        entries = fs.readdirSync(dir, { withFileTypes: true });
      } catch {
        return;
      }
      for (const entry of entries) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          collect(full, out);
        } else if (
          entry.name.endsWith(".ts") ||
          entry.name.endsWith(".js")
        ) {
          out.push(full);
        }
      }
    }

    const files: string[] = [];
    collect(baseDir, files);

    for (const file of files) {
      const key = `file://${file}`;
      if (cache.has(key)) continue;
      cache.set(
        key,
        () => import(file as never),
      );
    }

    return cache;
  };
}

// Vitest provides import.meta.glob. The pattern must resolve from the test
// file's location so the _generated folder is included.
const modules = import.meta.glob("../src/convex/**/*.{ts,js}");
// When Vitest's own import.meta.glob returns nothing, fall back to a plain
// filesystem walk so convex-test can still find the _generated files.
if (!modules || Object.keys(modules).length === 0) {
  const fs = require("fs");
  const path = require("path");
  const url = require("url");
  let dir: string;
  if ("dirname" in import.meta && typeof import.meta.dirname === "string") {
    dir = import.meta.dirname;
  } else {
    dir = path.dirname(url.fileURLToPath(import.meta.url));
  }
  const anchor = "../src/convex".replace(/^\.\//, "");
  const baseDir = path.resolve(dir, anchor);
  const files: string[] = [];
  function collect(dir: string) {
    let entries: ReturnType<typeof fs.readdirSync>;
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); }
    catch { return; }
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) collect(full);
      else if (entry.name.endsWith(".ts") || entry.name.endsWith(".js")) files.push(full);
    }
  }
  collect(baseDir);
  for (const file of files) {
    const key = `file://${file}`;
    if (!modules[key]) {
      (modules as Record<string, unknown>)[key] = () => import(file as never);
    }
  }
}

/**
 * Runs the real Convex functions against an in-memory backend.
 *
 * Auth is the one thing convex-test cannot drive, so `getAuthUserId` is mocked
 * with a mutable identity. Everything else — RBAC, rate limits, coupon rules,
 * transaction boundaries — is the shipped code under test.
 */
// `vi.mock` is hoisted above every import and every top-level binding in this
// file, so the factory may not close over anything declared below it. Both the
// shared identity and the pre-built auth mock therefore come from `vi.hoisted`
// (and a dynamic import inside the factory); reading them directly from module
// scope is the classic "Cannot access '…' before initialization" failure, which
// is what used to stop every suite in this folder from loading at all.
const { identity } = vi.hoisted(() => ({
  identity: { current: null as string | null },
}));

// Partial mock: only `getAuthUserId` is stubbed. The rest of the module (notably
// `authTables`, which the schema spreads) must stay real so the Convex schema
// can be constructed.
//
// The pre-built mock (a different module path, so not intercepted by the mock
// below) contains the real authTables and stubs for everything else. We spread
// it and override getAuthUserId with our controllable identity so signIn() can
// swap users between tests.
vi.mock("@convex-dev/auth/server", async () => {
  const mockAuth = await import("../__mocks__/@convex-dev/auth/server");
  return {
    ...mockAuth,
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