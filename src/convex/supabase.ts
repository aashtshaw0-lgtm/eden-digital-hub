"use node";

/**
 * Supabase, server-side only.
 *
 * Two jobs, both admin-gated, both run as a Convex Node action so neither key
 * ever reaches the browser:
 *
 *  1. `ping`   — prove the project URL and key actually reach Supabase, so a
 *                wrong key shows up as a readable error instead of a mystery.
 *  2. `backup` — mirror the studio's order book into Supabase Storage as a JSON
 *                snapshot. Convex is the source of truth; this is the off-site
 *                copy that survives a Convex project accident.
 *
 * Needs these in the Keys tab:
 *   SUPABASE_URL              — project URL (or set SUPABASE_PROJECT_REF and
 *                               the URL is derived from it)
 *   SUPABASE_SERVICE_ROLE_KEY — server-only key; required for `backup`
 *   SUPABASE_ANON_KEY         — optional; enough for `ping` alone
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { GenericActionCtx } from "convex/server";
import { api } from "./_generated/api";
import type { DataModel } from "./_generated/dataModel";
import { action } from "./_generated/server";

/** Where the JSON snapshots live. Created on first backup if missing. */
const BUCKET = "studio-backups";
/** Snapshots kept in the bucket; older ones are pruned after each backup. */
const KEEP_SNAPSHOTS = 30;

type ActionCtx = GenericActionCtx<DataModel>;

type SupabaseConfig = {
  url: string;
  key: string;
  keyKind: "service_role" | "anon" | "unknown";
  missing: string[];
};

/**
 * Reads the configuration out of the deployment's env, deriving the URL from
 * the project ref when only that was supplied. Returns the missing names
 * rather than throwing, so the caller can say exactly what to paste in.
 */
function readConfig(): SupabaseConfig {
  const rawUrl = process.env.SUPABASE_URL?.trim();
  const ref = process.env.SUPABASE_PROJECT_REF?.trim();
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  const anonKey = process.env.SUPABASE_ANON_KEY?.trim();

  const derivedRef = ref
    ? ref.replace(/^https?:\/\//, "").replace(/\.supabase\.co.*$/, "")
    : "";
  const url = rawUrl || (derivedRef ? `https://${derivedRef}.supabase.co` : "");

  const key = serviceKey || anonKey || "";
  const missing: string[] = [];
  if (!url) missing.push("SUPABASE_URL (or SUPABASE_PROJECT_REF)");
  if (!key) missing.push("SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_ANON_KEY)");

  return {
    url,
    key,
    keyKind: serviceKey ? "service_role" : anonKey ? "anon" : "unknown",
    missing,
  };
}

/**
 * A snapshot row as JSON. The admin view's rich return type must not leak into
 * this module's inferred types: the generated `api` type includes these very
 * actions, so letting the return type reference it would make `api` circular
 * (and degrade every result derived from it across the app).
 */
type SnapshotOrder = Record<string, unknown>;

type PingResult = {
  ok: true;
  project: string;
  keyKind: "service_role" | "anon" | "unknown";
  buckets: number;
};

type BackupResult = {
  ok: true;
  path: string;
  bucket: string;
  orderCount: number;
  bytes: number;
  pruned: number;
};

function client(config: SupabaseConfig): SupabaseClient {
  return createClient(config.url, config.key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/** Same gate as every other admin tool: managers and the super owner only. */
async function requireAdminInAction(ctx: ActionCtx) {
  const role = await ctx.runQuery(api.users.myRole, {});
  if (role !== "manager" && role !== "super_owner") {
    throw new Error("Unauthorized: only studio admins can talk to Supabase.");
  }
}

/** Turns a Supabase error into something an operator can act on. */
function explain(err: { message?: string } | null | undefined): string {
  const message = err?.message ?? "unknown error";
  if (/invalid api key|jwt|401|unauthorized/i.test(message)) {
    return `Supabase rejected the key — check SUPABASE_SERVICE_ROLE_KEY / SUPABASE_ANON_KEY in the Keys tab. (${message})`;
  }
  if (/fetch failed|ENOTFOUND|ECONNREFUSED|network/i.test(message)) {
    return `Could not reach Supabase — check SUPABASE_URL / SUPABASE_PROJECT_REF in the Keys tab. (${message})`;
  }
  return `Supabase said: ${message}`;
}

export const ping = action({
  args: {},
  handler: async (ctx: ActionCtx): Promise<PingResult> => {
    await requireAdminInAction(ctx);

    const config = readConfig();
    if (config.missing.length) {
      throw new Error(`Missing from the Keys tab: ${config.missing.join(", ")}.`);
    }

    const supabase = client(config);
    const { data, error } = await supabase.storage.listBuckets();
    if (error) throw new Error(explain(error));

    return {
      ok: true as const,
      project: new URL(config.url).host,
      keyKind: config.keyKind,
      buckets: data.length,
    };
  },
});

export const backup = action({
  args: {},
  handler: async (ctx: ActionCtx): Promise<BackupResult> => {
    await requireAdminInAction(ctx);

    const config = readConfig();
    if (config.missing.length) {
      throw new Error(`Missing from the Keys tab: ${config.missing.join(", ")}.`);
    }
    if (config.keyKind !== "service_role") {
      throw new Error(
        "A backup upload needs SUPABASE_SERVICE_ROLE_KEY — the anon key cannot write to storage. Add it in the Keys tab.",
      );
    }

    // The same admin-checked query the console renders, so the snapshot is
    // exactly what the owner sees, clients and proofs included. It crosses a
    // JSON boundary the moment it is uploaded, hence the neutral row type.
    const orders = (await ctx.runQuery(api.orders.listAll, {})) as unknown as
      | SnapshotOrder[]
      | null;
    const takenAt = new Date().toISOString();

    const supabase = client(config);

    // Create the bucket the first time; an already-existing bucket is fine.
    const { error: bucketError } = await supabase.storage.createBucket(BUCKET, {
      public: false,
      fileSizeLimit: "10MB",
    });
    if (bucketError && !/already exists|duplicate/i.test(bucketError.message)) {
      throw new Error(explain(bucketError));
    }

    const payload = JSON.stringify({
      takenAt,
      bucket: BUCKET,
      orderCount: orders?.length ?? 0,
      orders: orders ?? [],
    });
    const path = `orders/snapshot-${takenAt.replace(/[:.]/g, "-")}.json`;

    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(path, new Blob([payload], { type: "application/json" }), {
        contentType: "application/json",
        upsert: false,
      });
    if (uploadError) throw new Error(explain(uploadError));

    // Keep the bucket bounded: newest KEEP_SNAPSHOTS win, the rest go.
    const { data: files, error: listError } = await supabase.storage
      .from(BUCKET)
      .list("orders", { limit: 200 });
    let pruned = 0;
    if (!listError && files) {
      const ordered = [...files].sort((a, b) =>
        String(b.created_at ?? "").localeCompare(String(a.created_at ?? "")),
      );
      const stale = ordered.slice(KEEP_SNAPSHOTS).map((f) => `orders/${f.name}`);
      if (stale.length) {
        const { error: removeError } = await supabase.storage.from(BUCKET).remove(stale);
        if (!removeError) pruned = stale.length;
      }
    }

    return {
      ok: true as const,
      path,
      bucket: BUCKET,
      orderCount: orders?.length ?? 0,
      bytes: payload.length,
      pruned,
    };
  },
});