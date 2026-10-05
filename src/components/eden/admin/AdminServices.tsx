import { api } from "@/convex/_generated/api";
import { useMutation, useQuery } from "convex/react";
import { motion } from "framer-motion";
import { Loader2, Plus, Save, Trash2, Check } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

const CATEGORIES = [
  { value: "design", label: "Design" },
  { value: "events", label: "Events" },
  { value: "management", label: "Management" },
] as const;

/** Admin pricing desk: edit tier prices live, or add a whole new service. */
export function AdminServices() {
  const services = useQuery(api.catalogAdmin.listForAdmin);
  const updateTier = useMutation(api.catalogAdmin.updateTier);
  const addService = useMutation(api.catalogAdmin.addService);

  const [showAdd, setShowAdd] = useState(false);
  const [name, setName] = useState("");
  const [category, setCategory] = useState<string>("design");
  const [tagline, setTagline] = useState("");
  const [saving, setSaving] = useState(false);

  if (services === undefined) {
    return <div className="clay h-64 animate-pulse opacity-60" />;
  }

  const savePrice = async (tierId: (typeof services)[number]["tiers"][number]["_id"], value: string) => {
    const next = Number(value);
    if (!Number.isFinite(next) || next < 0) {
      toast.error("Enter a valid price.");
      return;
    }
    try {
      await updateTier({ tierId, basePrice: next });
      toast.success("Price updated");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not update price");
    }
  };

  const saveDeliverables = async (
    tierId: (typeof services)[number]["tiers"][number]["_id"],
    value: string,
  ) => {
    const items = value
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);
    if (items.length === 0) {
      toast.error("Add at least one deliverable.");
      return;
    }
    try {
      await updateTier({ tierId, deliverables: items });
      toast.success("Deliverables updated");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not update deliverables");
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("Give the service a name.");
      return;
    }
    setSaving(true);
    try {
      // Every service starts with the same three transparent tiers.
      await addService({
        name,
        category,
        tagline: tagline || undefined,
        tiers: [
          { name: "Basic", basePrice: 999, deliverables: ["Core deliverable", "1 revision round"] },
          { name: "Pro", basePrice: 2499, deliverables: ["Core + extras", "3 revision rounds"] },
          { name: "Premium", basePrice: 4999, deliverables: ["Everything in Pro", "Unlimited revisions"] },
        ],
      });
      toast.success(`${name.trim()} added — edit the prices below`);
      setName("");
      setTagline("");
      setShowAdd(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not add service");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-lg font-semibold">Services & pricing</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Changes go live on the storefront immediately.
          </p>
        </div>
        <button
          onClick={() => setShowAdd((v) => !v)}
          className="inline-flex items-center gap-1.5 rounded-2xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-md transition hover:brightness-110"
        >
          {showAdd ? <Trash2 className="size-4" /> : <Plus className="size-4" />}
          {showAdd ? "Cancel" : "Add service"}
        </button>
      </div>

      {showAdd && (
        <motion.form
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          onSubmit={(e) => void submit(e)}
          className="clay space-y-4 p-5"
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Service name
              </span>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Wedding Photography"
                className="clay-inset w-full rounded-xl px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/40"
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Category
              </span>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="clay-inset w-full cursor-pointer rounded-xl px-3.5 py-2.5 text-sm outline-none"
              >
                {CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Tagline (optional)
            </span>
            <input
              value={tagline}
              onChange={(e) => setTagline(e.target.value)}
              placeholder="One line on the card"
              className="clay-inset w-full rounded-xl px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/40"
            />
          </label>

          <p className="text-xs text-muted-foreground">
            Starts with Basic / Pro / Premium — adjust every price on the next screen.
          </p>

          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-1.5 rounded-2xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition hover:brightness-110 disabled:opacity-60"
          >
            {saving && <Loader2 className="size-4 animate-spin" />}
            Create service
          </button>
        </motion.form>
      )}

      <div className="space-y-4">
        {services.map((service) => (
          <section key={service._id} className="clay p-5">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h3 className="font-display text-base font-semibold">{service.name}</h3>
              <span className="text-xs uppercase tracking-wide text-muted-foreground">
                {service.category}
              </span>
            </div>

            <div className="mt-3 space-y-2">
              {service.tiers
                .slice()
                .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
                .map((tier) => (
                  <TierRow
                    key={tier._id}
                    tierId={tier._id}
                    name={tier.name}
                    price={tier.basePrice}
                    deliverables={tier.deliverables}
                    onSavePrice={(v) => void savePrice(tier._id, v)}
                    onSaveDeliverables={(v) => void saveDeliverables(tier._id, v)}
                  />
                ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}

function TierRow({
  tierId,
  name,
  price,
  deliverables,
  onSavePrice,
  onSaveDeliverables,
}: {
  tierId: string;
  name: string;
  price: number;
  deliverables?: string[];
  onSavePrice: (value: string) => void;
  onSaveDeliverables: (value: string) => void;
}) {
  const [priceValue, setPriceValue] = useState(String(price));
  const [deliverablesValue, setDeliverablesValue] = useState(
    deliverables?.join("\n") ?? "",
  );
  const priceDirty = Number(priceValue) !== price;
  const deliverablesDirty = deliverablesValue !== (deliverables?.join("\n") ?? "");

  return (
    <div className="clay-inset rounded-xl p-3.5">
      <div className="flex items-center gap-2 pb-2">
        <span className="text-sm font-semibold">{name}</span>
        <span className="text-xs text-muted-foreground">— edit price and deliverables</span>
      </div>

      {/* Price editor */}
      <div className="clay-inset flex items-center gap-2 rounded-lg px-3 py-2 mb-3">
        <span className="text-sm text-muted-foreground">₹</span>
        <input
          type="number"
          min={0}
          value={priceValue}
          onChange={(e) => setPriceValue(e.target.value)}
          onBlur={() => priceDirty && onSavePrice(priceValue)}
          className="w-28 bg-transparent text-right text-sm font-medium tabular-nums outline-none"
        />
        <button
          onClick={() => onSavePrice(priceValue)}
          disabled={!priceDirty}
          className="clay-sm inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-primary transition hover:brightness-110 disabled:opacity-40"
        >
          <Save className="size-3" />
          Save
        </button>
      </div>

      {/* Deliverables editor */}
      <div className="space-y-1.5">
        <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Deliverables</p>
        <textarea
          value={deliverablesValue}
          onChange={(e) => setDeliverablesValue(e.target.value)}
          onBlur={() => deliverablesDirty && onSaveDeliverables(deliverablesValue)}
          placeholder="One per line, e.g.:\n3 logo concepts\nPNG + JPG exports\n2 revision rounds"
          className="clay-inset w-full min-h-[80px] resize-y rounded-lg px-3 py-2 text-sm outline-none placeholder:text-muted-foreground/60 focus:ring-2 focus:ring-primary/40"
        />
        <button
          onClick={() => onSaveDeliverables(deliverablesValue)}
          disabled={!deliverablesDirty}
          className="clay-sm inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-semibold text-primary transition hover:brightness-110 disabled:opacity-40"
        >
          <Save className="size-3" />
          Save deliverables
        </button>
      </div>
    </div>
  );
}