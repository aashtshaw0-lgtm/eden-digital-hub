import { api } from "@/convex/_generated/api";
import { LEGENDARY_THRESHOLD, PREMIUM_THRESHOLD, tierMeta } from "@/lib/credits";
import { inr } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useMutation, useQuery } from "convex/react";
import { AnimatePresence, motion } from "framer-motion";
import { Loader2, Pencil, Plus, Trash2, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import type { Id } from "@/convex/_generated/dataModel";

export function AdminCredits() {
  const credits = useQuery(api.credits.listAll);
  const addCredit = useMutation(api.credits.add);
  const updateCredit = useMutation(api.credits.update);
  const removeCredit = useMutation(api.credits.remove);

  const [name, setName] = useState("");
  const [greatness, setGreatness] = useState("");
  const [amount, setAmount] = useState("0");
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState<Id<"credits"> | null>(null);

  const numericAmount = Math.max(0, Number(amount) || 0);
  const previewTier = tierMeta(numericAmount);

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
        amount: numericAmount,
      });
      toast.success(`Added ${name.trim()} to the ledger`);
      setName("");
      setGreatness("");
      setAmount("0");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not add credit");
    } finally {
      setSaving(false);
    }
  };

  const saveEdit = async (
    creditId: Id<"credits">,
    next: { name: string; greatness: string; amount: number },
  ) => {
    try {
      await updateCredit({ creditId, ...next });
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
      {/* Add form */}
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
            A tip above {inr(PREMIUM_THRESHOLD)} becomes a premium credit, {inr(LEGENDARY_THRESHOLD)}
            and above becomes legendary — bigger influence sorts higher automatically.
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Name">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Client or supporter name"
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

        <div className="flex flex-wrap items-end gap-3">
          <Field label="Amount (drives the tier)">
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

      {/* Ledger */}
      {credits === undefined ? (
        <div className="clay h-40 animate-pulse opacity-60" />
      ) : credits.length === 0 ? (
        <p className="clay p-8 text-center text-sm text-muted-foreground">
          No credits yet — add the first name above.
        </p>
      ) : (
        <ul className="space-y-2.5">
          <AnimatePresence initial={false}>
            {credits.map((credit, index) => (
              <motion.li
                key={credit._id}
                layout
                initial={{ opacity: 0, y: 18, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.18 } }}
                transition={{ type: "spring", stiffness: 260, damping: 26, delay: index * 0.03 }}
                className={cn(
                  "clay flex flex-wrap items-center gap-3 p-4 ring-1",
                  tierMeta(credit.amount).ring,
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
                      <p className="font-display text-base font-semibold">{credit.name}</p>
                      {credit.greatness && (
                        <p className="mt-0.5 text-xs text-muted-foreground">{credit.greatness}</p>
                      )}
                    </div>

                    <span className="text-sm font-medium tabular-nums text-muted-foreground">
                      {inr(credit.amount)}
                    </span>

                    <TierChip amount={credit.amount} />

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
            ))}
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

function TierChip({ amount }: { amount: number }) {
  const tier = tierMeta(amount);
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold",
        tier.chip,
      )}
    >
      <tier.icon className="size-3" />
      {tier.title}
    </span>
  );
}

function EditRow({
  credit,
  onSave,
  onCancel,
}: {
  credit: { name: string; greatness?: string; amount: number };
  onSave: (next: { name: string; greatness: string; amount: number }) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(credit.name);
  const [greatness, setGreatness] = useState(credit.greatness ?? "");
  const [amount, setAmount] = useState(String(credit.amount));

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
      <input
        type="number"
        min={0}
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        className="clay-inset w-28 rounded-xl px-3 py-2 text-sm tabular-nums outline-none"
      />
      <button
        onClick={() =>
          onSave({ name, greatness, amount: Math.max(0, Number(amount) || 0) })
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