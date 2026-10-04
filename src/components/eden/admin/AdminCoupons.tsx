import { api } from "@/convex/_generated/api";
import { inr } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useMutation, useQuery } from "convex/react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Ban,
  Check,
  Copy,
  Loader2,
  Plus,
  Ticket,
  Trash2,
  Users,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import type { Id } from "@/convex/_generated/dataModel";

type Kind = "flat" | "percent";

export function AdminCoupons() {
  const coupons = useQuery(api.coupons.listForAdmin);
  const createCoupon = useMutation(api.coupons.create);
  const setActive = useMutation(api.coupons.setActive);
  const removeCoupon = useMutation(api.coupons.remove);

  const [kind, setKind] = useState<Kind>("percent");
  const [code, setCode] = useState("");
  const [value, setValue] = useState("10");
  const [note, setNote] = useState("");
  const [maxUses, setMaxUses] = useState("");
  const [maxPerClient, setMaxPerClient] = useState("");
  const [emails, setEmails] = useState("");
  const [expires, setExpires] = useState("");
  const [saving, setSaving] = useState(false);
  const [expanded, setExpanded] = useState<Id<"coupons"> | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const shareList = emails
    .split(/[\s,;]+/)
    .map((e) => e.trim())
    .filter((e) => e.includes("@"));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (code.trim().length < 3) {
      toast.error("Give the coupon a code of at least 3 characters.");
      return;
    }
    const numeric = Number(value);
    if (!Number.isFinite(numeric) || numeric <= 0) {
      toast.error("Enter a discount value above zero.");
      return;
    }
    setSaving(true);
    try {
      await createCoupon({
        code,
        kind,
        value: numeric,
        note: note || undefined,
        maxUses: maxUses ? Number(maxUses) : undefined,
        maxPerClient: maxPerClient ? Number(maxPerClient) : undefined,
        allowedEmails: shareList.length > 0 ? shareList : undefined,
        expiresAt: expires ? new Date(expires).getTime() : undefined,
      });
      toast.success(`Coupon ${code.trim().toUpperCase()} created`);
      setCode("");
      setNote("");
      setMaxUses("");
      setMaxPerClient("");
      setEmails("");
      setExpires("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not create coupon");
    } finally {
      setSaving(false);
    }
  };

  const copyLink = async (value: string) => {
    const link = `${window.location.origin}/services?coupon=${encodeURIComponent(value)}`;
    try {
      await navigator.clipboard.writeText(link);
      setCopied(value);
      toast.success("Coupon link copied — send it to your client.");
      setTimeout(() => setCopied(null), 2000);
    } catch {
      toast.error("Couldn't copy — the code is " + value);
    }
  };

  return (
    <div className="space-y-6">
      <motion.form
        onSubmit={(e) => void submit(e)}
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="clay space-y-4 p-5"
      >
        <div>
          <h2 className="font-display flex items-center gap-2 text-lg font-semibold">
            <Ticket className="size-4" /> Create a coupon
          </h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Make any offer you like — a flat amount off or a percentage. Share it with specific
            people to make it private, or leave the share list empty to make it public. Delete it
            later or pause it without losing the usage history.
          </p>
        </div>

        {/* Flat vs percent */}
        <div className="flex gap-2">
          {(
            [
              { key: "percent" as const, label: "% off" },
              { key: "flat" as const, label: "₹ off" },
            ]
          ).map((option) => (
            <button
              key={option.key}
              type="button"
              onClick={() => setKind(option.key)}
              className={cn(
                "rounded-full px-3.5 py-2 text-xs font-semibold transition",
                kind === option.key
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "clay-sm text-muted-foreground hover:text-foreground",
              )}
            >
              {option.label}
            </button>
          ))}
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Code">
            <input
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="EDEN20"
              className="clay-inset w-full rounded-xl px-3.5 py-2.5 text-sm font-semibold uppercase tracking-wide outline-none focus:ring-2 focus:ring-primary/40"
            />
          </Field>
          <Field label={kind === "percent" ? "Percentage off" : "Rupees off"}>
            <input
              type="number"
              min={0}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              className="clay-inset w-full rounded-xl px-3.5 py-2.5 text-sm tabular-nums outline-none focus:ring-2 focus:ring-primary/40"
            />
          </Field>
          <Field label="Internal note">
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Launch week, Diwali offer…"
              className="clay-inset w-full rounded-xl px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/40"
            />
          </Field>
          <Field label="Share with (emails, optional)">
            <input
              value={emails}
              onChange={(e) => setEmails(e.target.value)}
              placeholder="a@x.com, b@y.com — leave blank for anyone"
              className="clay-inset w-full rounded-xl px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/40"
            />
          </Field>
          <Field label="Total uses (blank = unlimited)">
            <input
              type="number"
              min={1}
              value={maxUses}
              onChange={(e) => setMaxUses(e.target.value)}
              placeholder="Unlimited"
              className="clay-inset w-full rounded-xl px-3.5 py-2.5 text-sm tabular-nums outline-none focus:ring-2 focus:ring-primary/40"
            />
          </Field>
          <Field label="Uses per client (blank = 1)">
            <input
              type="number"
              min={1}
              value={maxPerClient}
              onChange={(e) => setMaxPerClient(e.target.value)}
              placeholder="1"
              className="clay-inset w-full rounded-xl px-3.5 py-2.5 text-sm tabular-nums outline-none focus:ring-2 focus:ring-primary/40"
            />
          </Field>
          <Field label="Expires (optional)">
            <input
              type="date"
              value={expires}
              onChange={(e) => setExpires(e.target.value)}
              className="clay-inset w-full rounded-xl px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/40"
            />
          </Field>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <motion.span
            key={`${kind}-${value}`}
            initial={{ scale: 0.94, opacity: 0.5 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", stiffness: 400, damping: 20 }}
            className="inline-flex items-center gap-1.5 rounded-full bg-primary/12 px-3 py-1.5 text-xs font-semibold text-primary"
          >
            <Ticket className="size-3" />
            {code.trim() ? code.trim().toUpperCase() : "CODE"} —{" "}
            {kind === "percent" ? `${Number(value) || 0}% off` : `${inr(Number(value) || 0)} off`}
          </motion.span>

          {shareList.length > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-3 py-1.5 text-xs font-semibold text-amber-700">
              <Users className="size-3" />
              Only {shareList.length} {shareList.length === 1 ? "person" : "people"}
            </span>
          )}

          <button
            type="submit"
            disabled={saving}
            className="ml-auto inline-flex items-center gap-1.5 rounded-2xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-md transition hover:brightness-110 disabled:opacity-60"
          >
            {saving ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
            Create coupon
          </button>
        </div>
      </motion.form>

      {coupons === undefined ? (
        <div className="clay h-32 animate-pulse opacity-60" />
      ) : coupons.length === 0 ? (
        <p className="clay p-8 text-center text-sm text-muted-foreground">
          No coupons yet — create your first one above.
        </p>
      ) : (
        <ul className="space-y-2.5">
          <AnimatePresence initial={false}>
            {coupons.map((coupon, index) => {
              const dead = coupon.expired || coupon.exhausted || coupon.active === false;
              return (
                <motion.li
                  key={coupon._id}
                  layout
                  initial={{ opacity: 0, y: 18, scale: 0.97 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.18 } }}
                  transition={{ type: "spring", stiffness: 260, damping: 26, delay: index * 0.03 }}
                  className={cn("clay p-4 ring-1", dead ? "ring-border opacity-70" : "ring-primary/30")}
                >
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="font-display rounded-lg bg-secondary px-2.5 py-1 text-sm font-bold tracking-wider">
                      {coupon.code}
                    </span>
                    <span className="text-sm font-semibold text-primary">{coupon.label}</span>
                    {coupon.note && (
                      <span className="text-xs text-muted-foreground">{coupon.note}</span>
                    )}

                    <StatusPill coupon={coupon} />

                    <div className="ml-auto flex items-center gap-1.5">
                      <span className="inline-flex items-center gap-1 rounded-full bg-secondary px-2.5 py-1 text-xs font-semibold text-secondary-foreground">
                        <Users className="size-3" />
                        {coupon.uses}
                        {coupon.maxUses ? `/${coupon.maxUses}` : ""} used
                      </span>
                      <button
                        onClick={() => void copyLink(coupon.code)}
                        className="clay-sm flex size-8 items-center justify-center text-muted-foreground hover:text-primary"
                        aria-label={`Copy link for ${coupon.code}`}
                      >
                        {copied === coupon.code ? (
                          <Check className="size-3.5 text-emerald-600" />
                        ) : (
                          <Copy className="size-3.5" />
                        )}
                      </button>
                      <button
                        onClick={() =>
                          void setActive({ couponId: coupon._id, active: coupon.active === false })
                        }
                        className="clay-sm flex size-8 items-center justify-center text-muted-foreground hover:text-primary"
                        aria-label={`${coupon.active === false ? "Enable" : "Pause"} ${coupon.code}`}
                      >
                        <Ban className="size-3.5" />
                      </button>
                      <button
                        onClick={() => {
                          if (expanded === coupon._id) setExpanded(null);
                          else setExpanded(coupon._id);
                        }}
                        className="clay-sm flex size-8 items-center justify-center text-muted-foreground hover:text-primary"
                        aria-label={`Show who used ${coupon.code}`}
                      >
                        <Users className="size-3.5" />
                      </button>
                      <button
                        onClick={() => void removeCoupon({ couponId: coupon._id })}
                        className="clay-sm flex size-8 items-center justify-center text-muted-foreground hover:text-destructive"
                        aria-label={`Delete ${coupon.code}`}
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    </div>
                  </div>

                  <AnimatePresence>
                    {expanded === coupon._id && (
                      <RedemptionList couponId={coupon._id} />
                    )}
                  </AnimatePresence>
                </motion.li>
              );
            })}
          </AnimatePresence>
        </ul>
      )}
    </div>
  );
}

function RedemptionList({ couponId }: { couponId: Id<"coupons"> }) {
  const rows = useQuery(api.coupons.redemptionsFor, { couponId });
  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: "auto" }}
      exit={{ opacity: 0, height: 0 }}
      className="overflow-hidden"
    >
      <div className="clay-inset mt-3 rounded-xl p-3">
        {rows === undefined ? (
          <p className="text-xs text-muted-foreground">Loading redemptions…</p>
        ) : rows.length === 0 ? (
          <p className="text-xs text-muted-foreground">Nobody has used this coupon yet.</p>
        ) : (
          <ul className="space-y-1.5">
            {rows.map((row) => (
              <li key={row._id} className="flex items-center justify-between gap-3 text-xs">
                <span className="truncate">
                  <span className="font-medium">{row.name}</span>{" "}
                  <span className="text-muted-foreground">{row.email}</span>
                </span>
                <span className="shrink-0 font-semibold tabular-nums text-primary">
                  −{inr(row.discount)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </motion.div>
  );
}

function StatusPill({
  coupon,
}: {
  coupon: {
    active?: boolean;
    expired: boolean;
    exhausted: boolean;
    restricted: boolean;
    maxUses?: number;
    allowedEmails?: string[];
  };
}) {
  if (coupon.active === false) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-slate-600/15 px-2.5 py-1 text-[11px] font-semibold text-slate-700 dark:text-slate-300">
        Paused
      </span>
    );
  }
  if (coupon.expired) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-rose-600/15 px-2.5 py-1 text-[11px] font-semibold text-rose-700">
        Expired
      </span>
    );
  }
  if (coupon.exhausted) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-rose-600/15 px-2.5 py-1 text-[11px] font-semibold text-rose-700">
        Fully used
      </span>
    );
  }
  if (coupon.restricted) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2.5 py-1 text-[11px] font-semibold text-amber-700">
        <Users className="size-2.5" />
        Private · {coupon.allowedEmails?.length}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-600/15 px-2.5 py-1 text-[11px] font-semibold text-emerald-700">
      Live
    </span>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      {children}
    </label>
  );
}