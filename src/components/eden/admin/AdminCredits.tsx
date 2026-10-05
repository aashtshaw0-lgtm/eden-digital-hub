import { api } from "@/convex/_generated/api";
import { LEGENDARY_THRESHOLD as LEGENDARY, PREMIUM_THRESHOLD as PREMIUM, tierMetaForTier } from "@/lib/credits";
import { inr } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useMutation, useQuery } from "convex/react";
import { AnimatePresence, motion } from "framer-motion";
import { HandCoins, Loader2, Megaphone, Pencil, Plus, Trash2, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import type { Id } from "@/convex/_generated/dataModel";

type CreditKind = "tip" | "marketing";
type Tier = "standard" | "premium" | "legendary";

const TIERS: Tier[] = ["standard", "premium", "legendary"];

export function AdminCredits() {
  const credits = useQuery(api.credits.listForAdmin);
  const addCredit = useMutation(api.credits.add);
  const updateCredit = useMutation(api.credits.update);
  const removeCredit = useMutation(api.credits.remove);

  const [kind, setKind] = useState<CreditKind>("tip");
  const [name, setName] = useState("");
  const [greatness, setGreatness] = useState("");
  const [helpText, setHelpText] = useState("");
  const [amount, setAmount] = useState("0");
  const [marketingTier, setMarketingTier] = useState<Tier>("premium");
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState<Id<"credits"> | null>(null);

  const numericAmount = Math.max(0, Number(amount) || 0);
  const previewTier = tierMetaForTier(
    numericAmount >= LEGENDARY ? "legendary" : numericAmount >= PREMIUM ? "premium" : "standard",
  );

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("A credit needs a name.");
      return;
    }
    setSaving(true);
    try {
      await addCredit({
        name,
        greatness: greatness || undefined,
        helpText: kind === "marketing" ? helpText || undefined : undefined,
        // Marketing credits carry no amount, so none is sent.
        amount: kind === "tip" ? numericAmount : undefined,
        kind,
        tier: kind === "marketing" ? marketingTier : undefined,
      });
      toast.success(`Added ${name.trim()} to the ledger`);
      setName("");
      setGreatness("");
      setHelpText("");
      setAmount("0");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not add credit");
    } finally {
      setSaving(false);
    }
  };

  const saveEdit = async (
    creditId: Id<"credits">,
    next: { name: string; greatness: string; amount: number; kind: CreditKind; tier?: Tier; helpText?: string },
  ) => {
    try {
      await updateCredit({
        creditId,
        name: next.name,
        greatness: next.greatness,
        helpText: next.kind === "marketing" ? next.helpText : undefined,
        amount: next.kind === "tip" ? next.amount : undefined,
        kind: next.kind,
        tier: next.kind === "marketing" ? (next.tier ?? "standard") : undefined,
      });
      toast.success("Credit updated");
      setEditing(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Update failed");
    }
  };

  const drop = async (creditId: Id<"credits">) => {
    try {
      await removeCredit({ creditId });
      toast.success("Credit removed");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Remove failed");
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
          <h2 className="font-display text-lg font-semibold">Add a name to the credits</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Clients who tip land here automatically. Add a sponsor, partner or press mention by
            hand — with a donation amount if they gave one, or without. Either way the public wall
            shows only a first name and last initial.
          </p>
        </div>

        {/* With or without a donation amount */}
        <div className="flex gap-2">
          {(
            [
              { key: "tip" as const, label: "With donation amount", icon: HandCoins },
              { key: "marketing" as const, label: "Without donation amount", icon: Megaphone },
            ]
          ).map((option) => (
            <button
              key={option.key}
              type="button"
              onClick={() => setKind(option.key)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full px-3.5 py-2 text-xs font-semibold transition",
                kind === option.key
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "clay-sm text-muted-foreground hover:text-foreground",
              )}
            >
              <option.icon className="size-3.5" />
              {option.label}
            </button>
          ))}
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Name">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={kind === "tip" ? "Client or supporter name" : "Sponsor, partner or press"}
              className="clay-inset w-full rounded-xl px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/40"
            />
          </Field>
          <Field label="Greatness">
            <input
              value={greatness}
              onChange={(e) => setGreatness(e.target.value)}
              placeholder="Short description of their impact"
              className="clay-inset w-full rounded-xl px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/40"
            />
          </Field>
        </div>

        {/* Custom help text for marketing credits */}
        {kind === "marketing" && (
          <div className="sm:col-span-2">
            <Field label="What did they do? (optional)">
              <textarea
                value={helpText}
                onChange={(e) => setHelpText(e.target.value)}
                placeholder="e.g. Gave food supplies to the studio kitchen, sponsored our event, wrote a feature about us..."
                rows={2}
                className="clay-inset w-full rounded-xl px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/40 resize-none"
              />
              <p className="mt-1 text-[10px] text-muted-foreground">
                This describes what they contributed — shown publicly on the credits wall.
              </p>
            </Field>
          </div>
        )}

        <div className="flex flex-wrap items-end gap-3">
          {kind === "tip" ? (
            <>
              <Field label="Donation amount (drives the tier)">
                <input
                  type="number"
                  min={0}
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="clay-inset w-40 rounded-xl px-3.5 py-2.5 text-sm tabular-nums outline-none focus:ring-2 focus:ring-primary/40"
                />
              </Field>

              <motion.span
                key={previewTier.label}
                initial={{ scale: 0.9, opacity: 0.5 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: "spring", stiffness: 400, damping: 20 }}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold",
                  previewTier.chip,
                )}
              >
                <previewTier.icon className="size-3" />
                {previewTier.title}
              </motion.span>
            </>
          ) : (
            <Field label="Display tier (no amount behind it)">
              <div className="flex gap-1.5">
                {TIERS.map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setMarketingTier(t)}
                    className={cn(
                      "rounded-full px-3 py-1.5 text-xs font-semibold capitalize transition",
                      marketingTier === t ? tierMetaForTier(t).chip : "clay-sm text-muted-foreground",
                    )}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </Field>
          )}

          <button
            type="submit"
            disabled={saving}
            className="ml-auto inline-flex items-center gap-1.5 rounded-2xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-md transition hover:brightness-110 disabled:opacity-60"
          >
            {saving ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
            Add credit
          </button>
        </div>
      </motion.form>

      {credits === undefined ? (
        <div className="clay h-40 animate-pulse opacity-60" />
      ) : credits.length === 0 ? (
        <p className="clay p-8 text-center text-sm text-muted-foreground">
          No credits yet — add the first name above.
        </p>
      ) : (
        <ul className="space-y-2.5">
          <AnimatePresence initial={false}>
            {credits.map((credit, index) => {
              const isMarketing = credit.kind === "marketing";
              return (
                <motion.li
                  key={credit._id}
                  layout
                  initial={{ opacity: 0, y: 18, scale: 0.97 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.18 } }}
                  transition={{ type: "spring", stiffness: 260, damping: 26, delay: index * 0.03 }}
                  className={cn(
                    "clay flex flex-wrap items-center gap-3 p-4 ring-1",
                    tierMetaForTier(credit.tier).ring,
                  )}
                >
                  <span className="font-display w-7 text-sm font-semibold tabular-nums text-muted-foreground">
                    {String(index + 1).padStart(2, "0")}
                  </span>

                  {editing === credit._id ? (
                    <EditRow
                      credit={credit}
                      onSave={(next) => void saveEdit(credit._id, next)}
                      onCancel={() => setEditing(null)}
                    />
                  ) : (
                    <>
                      <div className="min-w-[160px] flex-1">
                        <p className="font-display flex items-center gap-1.5 text-base font-semibold">
                          {credit.name}
                          {isMarketing && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-secondary px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-secondary-foreground">
                              <Megaphone className="size-2.5" /> Marketing
                            </span>
                          )}
                          {credit.autoGranted && (
                            <span className="rounded-full bg-primary/12 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary">
                              Auto
                            </span>
                          )}
                        </p>
                        {credit.greatness && (
                          <p className="mt-0.5 text-xs text-muted-foreground">{credit.greatness}</p>
                        )}
                      </div>

                      {/* The donation amount is internal — the public wall never shows it. */}
                      {isMarketing ? (
                        <span className="text-xs italic text-muted-foreground/70">
                          No donation recorded
                        </span>
                      ) : (
                        <span className="text-sm font-medium tabular-nums text-muted-foreground">
                          {inr(credit.amount)}
                        </span>
                      )}

                      <TierChip tier={credit.tier} isMarketing={isMarketing} />

                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => setEditing(credit._id)}
                          className="clay-sm flex size-8 items-center justify-center text-muted-foreground hover:text-primary"
                          aria-label={`Edit ${credit.name}`}
                        >
                          <Pencil className="size-3.5" />
                        </button>
                        <button
                          onClick={() => void drop(credit._id)}
                          className="clay-sm flex size-8 items-center justify-center text-muted-foreground hover:text-destructive"
                          aria-label={`Remove ${credit.name}`}
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      </div>
                    </>
                  )}
                </motion.li>
              );
            })}
          </AnimatePresence>
        </ul>
      )}
    </div>
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

function TierChip({ tier, isMarketing }: { tier: string; isMarketing: boolean }) {
  const meta = tierMetaForTier(tier as Tier);
  if (isMarketing) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-secondary px-2.5 py-1 text-xs font-semibold text-secondary-foreground">
        <Megaphone className="size-3" />
        Marketing credit
      </span>
    );
  }
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold",
        meta.chip,
      )}
    >
      <meta.icon className="size-3" />
      {meta.title}
    </span>
  );
}

function EditRow({
  credit,
  onSave,
  onCancel,
}: {
  credit: { name: string; greatness?: string; amount: number; kind: "tip" | "marketing"; tier: string; helpText?: string };
  onSave: (next: {
    name: string;
    greatness: string;
    amount: number;
    kind: CreditKind;
    tier?: Tier;
    helpText?: string;
  }) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(credit.name);
  const [greatness, setGreatness] = useState(credit.greatness ?? "");
  const [helpText, setHelpText] = useState(credit.helpText ?? "");
  const [amount, setAmount] = useState(String(credit.amount));
  const [kind, setKind] = useState<CreditKind>(credit.kind);
  const [tier, setTier] = useState<Tier>((credit.tier as Tier) ?? "standard");

  return (
    <div className="flex w-full flex-wrap items-end gap-2">
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="clay-inset w-44 rounded-xl px-3 py-2 text-sm outline-none"
      />
      <input
        value={greatness}
        onChange={(e) => setGreatness(e.target.value)}
        placeholder="Greatness"
        className="clay-inset w-56 rounded-xl px-3 py-2 text-sm outline-none"
      />

      {kind === "marketing" && (
        <input
          value={helpText}
          onChange={(e) => setHelpText(e.target.value)}
          placeholder="What did they do?"
          className="clay-inset w-56 rounded-xl px-3 py-2 text-sm outline-none"
        />
      )}

      <select
        value={kind}
        onChange={(e) => setKind(e.target.value as CreditKind)}
        className="clay-inset rounded-xl px-3 py-2 text-sm outline-none"
      >
        <option value="tip">Tip</option>
        <option value="marketing">Marketing</option>
      </select>

      {kind === "tip" ? (
        <input
          type="number"
          min={0}
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="clay-inset w-28 rounded-xl px-3 py-2 text-sm tabular-nums outline-none"
        />
      ) : (
        <select
          value={tier}
          onChange={(e) => setTier(e.target.value as Tier)}
          className="clay-inset rounded-xl px-3 py-2 text-sm capitalize outline-none"
        >
          {TIERS.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      )}

      <button
        onClick={() =>
          onSave({ name, greatness, amount: Math.max(0, Number(amount) || 0), kind, tier, helpText: kind === "marketing" ? helpText : undefined })
        }
        className="inline-flex items-center gap-1 rounded-xl bg-primary px-3.5 py-2 text-xs font-semibold text-primary-foreground"
      >
        Save
      </button>
      <button
        onClick={onCancel}
        className="clay-sm inline-flex items-center gap-1 rounded-xl px-3 py-2 text-xs font-medium text-muted-foreground"
      >
        <X className="size-3.5" /> Cancel
      </button>
    </div>
  );
}