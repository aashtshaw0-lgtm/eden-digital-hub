import { api } from "@/convex/_generated/api";
import { useAction } from "convex/react";
import { Database, Loader2, ShieldCheck, UploadCloud } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

/** Mirrors what `ping` returns in src/convex/supabase.ts. */
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

const primaryBtn =
  "tap inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50";

const secondaryBtn =
  "tap clay-sm inline-flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50";

function errorMessage(e: unknown, fallback: string): string {
  if (e instanceof Error && e.message) return e.message;
  return fallback;
}

/**
 * Supabase: connection check and off-site backup of the order book.
 *
 * Both buttons call Convex Node actions, so the Supabase keys stay on the
 * server; this component only ever sees the results.
 */
export function AdminSupabase() {
  const pingSupabase = useAction(api.supabase.ping);
  const backupSupabase = useAction(api.supabase.backup);

  const [busy, setBusy] = useState<null | "ping" | "backup">(null);
  const [connection, setConnection] = useState<PingResult | null>(null);
  const [lastBackup, setLastBackup] = useState<BackupResult | null>(null);

  const run = async (kind: "ping" | "backup", work: () => Promise<void>) => {
    if (busy) return;
    setBusy(kind);
    try {
      await work();
    } catch (e) {
      toast.error(
        errorMessage(
          e,
          kind === "ping" ? "Could not reach Supabase." : "Backup failed.",
        ),
      );
      if (kind === "ping") setConnection(null);
    } finally {
      setBusy(null);
    }
  };

  const testConnection = () =>
    run("ping", async () => {
      const result = (await pingSupabase({})) as PingResult;
      setConnection(result);
      toast.success(`Supabase reachable — ${result.buckets} storage bucket(s).`);
    });

  const runBackup = () =>
    run("backup", async () => {
      const result = (await backupSupabase({})) as BackupResult;
      setLastBackup(result);
      toast.success(
        `Backed up ${result.orderCount} order(s) to Supabase Storage.`,
      );
    });

  const kb = (bytes: number) =>
    bytes < 1024 ? `${bytes} B` : `${(bytes / 1024).toFixed(1)} KB`;

  return (
    <section className="clay space-y-4 p-6">
      <div className="flex items-start gap-2.5">
        <Database className="mt-0.5 size-4 shrink-0 text-primary" />
        <div>
          <h3 className="font-display text-lg font-semibold">Off-site backup (Supabase)</h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Mirrors the order book into your own Supabase project, so a copy of
            the studio's data exists outside Convex. Runs entirely on the
            server: the Supabase keys are read in a Convex action and never
            reach the browser.
          </p>
        </div>
      </div>

      <p className="clay-inset rounded-xl px-4 py-3 text-[11px] leading-relaxed text-muted-foreground">
        Needs <code className="font-mono">SUPABASE_URL</code> and{" "}
        <code className="font-mono">SUPABASE_SERVICE_ROLE_KEY</code> in the Keys
        tab (find both in Supabase → Project Settings → API). Snapshots land in a{" "}
        <code className="font-mono">studio-backups</code> bucket — created on
        the first backup, keeping only the newest 30 snapshots.
      </p>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={testConnection}
          disabled={busy !== null}
          className={secondaryBtn}
        >
          {busy === "ping" ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <ShieldCheck className="size-4" />
          )}
          Test connection
        </button>
        <button
          type="button"
          onClick={runBackup}
          disabled={busy !== null}
          className={primaryBtn}
        >
          {busy === "backup" ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <UploadCloud className="size-4" />
          )}
          Back up now
        </button>
      </div>

      <div className="space-y-1 text-[11px] leading-relaxed text-muted-foreground">
        {connection && (
          <p>
            Connected to{" "}
            <span className="font-mono text-foreground">{connection.project}</span>{" "}
            with the {connection.keyKind.replace("_", " ")} key ·{" "}
            {connection.buckets} bucket(s).
          </p>
        )}
        {lastBackup && (
          <p>
            Last backup: {lastBackup.orderCount} order(s), {kb(lastBackup.bytes)} →{" "}
            <span className="font-mono text-foreground">
              {lastBackup.bucket}/{lastBackup.path}
            </span>
            {lastBackup.pruned > 0 ? ` · ${lastBackup.pruned} old snapshot(s) pruned` : ""}.
          </p>
        )}
        {!connection && !lastBackup && (
          <p>Run a connection test first — it validates the keys before you rely on them.</p>
        )}
      </div>
    </section>
  );
}