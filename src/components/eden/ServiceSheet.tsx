import { api } from "@/convex/_generated/api";
import { useCart, type CartItem } from "@/context/CartProvider";
import { useAuth } from "@/hooks/use-auth";
import { inr } from "@/lib/format";
import { cn } from "@/lib/utils";
import { zodResolver } from "@hookform/resolvers/zod";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, ArrowRight, Check, CloudUpload, Loader2, X } from "lucide-react";
import { useRef, useState } from "react";
import { useForm, type UseFormReturn, type FieldValues, type Path } from "react-hook-form";
import { useMutation } from "convex/react";
import { useNavigate } from "react-router";
import { toast } from "sonner";
import { z } from "zod";
import type { Doc } from "@/convex/_generated/dataModel";

type Service = Doc<"services"> & { tiers: Doc<"serviceTiers">[] };
type Tier = Doc<"serviceTiers">;

/* ── Schemas ─────────────────────────────────────────────────────────── */

const contactSchema = {
  clientName: z.string().min(2, "Tell us your name"),
  clientEmail: z.email("Enter a valid email"),
  clientWhatsapp: z
    .string()
    .regex(/^\+?[0-9][0-9\s-]{7,14}$/, "Enter a valid WhatsApp number"),
};

const designSchema = z.object({
  ...contactSchema,
  brandPrimary: z.string().min(4),
  brandSecondary: z.string().min(4),
  copy: z.string().min(3, "Add the text your design should carry").max(2000),
  notes: z.string().max(1000).optional(),
});

const eventsSchema = z.object({
  ...contactSchema,
  eventDate: z.string().min(1, "Pick a date"),
  venue: z.string().min(3, "Where is it happening?"),
  audienceSize: z.enum(["Under 50", "50–200", "200–500", "500+"]),
  notes: z.string().max(1000).optional(),
});

const managementSchema = z.object({
  ...contactSchema,
  platforms: z.array(z.string()).min(1, "Pick at least one platform"),
  cadence: z.enum(["8 posts / month", "16 posts / month", "30 posts / month"]),
  notes: z.string().max(1000).optional(),
});

/* ── Sheet shell ─────────────────────────────────────────────────────── */

export function ServiceSheet({
  service,
  open,
  onOpenChange,
}: {
  service: Service | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [tier, setTier] = useState<Tier | null>(null);
  const navigate = useNavigate();
  const { addItem } = useCart();

  const close = () => {
    onOpenChange(false);
    setTimeout(() => setTier(null), 300);
  };

  const handleComplete = (requirements: Record<string, unknown>) => {
    if (!service || !tier) return;
    const item: CartItem = {
      serviceId: service._id,
      tierId: tier._id,
      serviceName: service.name,
      tierName: tier.name,
      price: tier.basePrice,
      category: service.category,
      requirements,
    };
    addItem(item);
    close();
    toast.success(`${service.name} · ${tier.name} added to cart`, {
      description: "Head to checkout when you're ready.",
      action: { label: "Checkout", onClick: () => navigate("/checkout") },
    });
    navigate("/checkout");
  };

  return (
    <AnimatePresence>
      {open && service && (
        <>
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={close}
            className="fixed inset-0 z-50 bg-foreground/25 backdrop-blur-[3px]"
          />
          <motion.aside
            key="panel"
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", stiffness: 300, damping: 34 }}
            className="fixed inset-y-0 right-0 z-50 flex w-full max-w-xl flex-col overflow-hidden rounded-l-[2rem] border border-border/60 bg-card shadow-2xl"
            role="dialog"
            aria-modal="true"
          >
            <header className="flex items-start justify-between gap-4 border-b border-border/60 px-6 py-5">
              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  {tier ? "Intake · tell us everything" : "Choose your tier"}
                </p>
                <h2 className="font-display mt-1 text-2xl font-semibold">
                  {service.name}
                  {tier && <span className="text-primary"> · {tier.name}</span>}
                </h2>
                {!tier && <p className="mt-1 text-sm text-muted-foreground">{service.tagline}</p>}
              </div>
              <button
                onClick={close}
                className="clay-sm flex size-9 shrink-0 items-center justify-center text-muted-foreground hover:text-foreground"
                aria-label="Close"
              >
                <X className="size-4" />
              </button>
            </header>

            <div className="flex-1 overflow-y-auto px-6 py-6">
              <AnimatePresence mode="wait" initial={false}>
                {!tier ? (
                  <motion.div
                    key="tiers"
                    initial={{ opacity: 0, x: 24 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -24 }}
                    transition={{ duration: 0.22 }}
                  >
                    <TierColumns
                      service={service}
                      onSelect={(t) => setTier(t)}
                    />
                  </motion.div>
                ) : (
                  <motion.div
                    key="intake"
                    initial={{ opacity: 0, x: 24 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -24 }}
                    transition={{ duration: 0.22 }}
                  >
                    <button
                      onClick={() => setTier(null)}
                      className="mb-5 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
                    >
                      <ArrowLeft className="size-3.5" /> Back to tiers
                    </button>
                    {service.category === "design" && (
                      <DesignForm tier={tier} onComplete={handleComplete} />
                    )}
                    {service.category === "events" && (
                      <EventsForm tier={tier} onComplete={handleComplete} />
                    )}
                    {service.category === "management" && (
                      <ManagementForm tier={tier} onComplete={handleComplete} />
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}

/* ── Tier columns ────────────────────────────────────────────────────── */

function TierColumns({ service, onSelect }: { service: Service; onSelect: (t: Tier) => void }) {
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      {service.tiers.map((t, i) => {
        const popular = i === 1;
        return (
          <motion.button
            key={t._id}
            whileTap={{ scale: 0.98 }}
            onClick={() => onSelect(t)}
            className={cn(
              "clay-sm clay-press relative flex flex-col p-4 text-left",
              popular && "ring-2 ring-primary/70",
            )}
          >
            {popular && (
              <span className="absolute -top-2.5 left-3 rounded-full bg-primary px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary-foreground">
                Popular
              </span>
            )}
            <p className="text-sm font-semibold">{t.name}</p>
            <p className="font-display mt-1 text-2xl font-semibold text-primary">
              {inr(t.basePrice)}
            </p>
            <ul className="mt-3 flex-1 space-y-1.5">
              {t.deliverables.map((d) => (
                <li key={d} className="flex items-start gap-1.5 text-xs leading-snug text-muted-foreground">
                  <Check className="mt-0.5 size-3 shrink-0 text-primary" />
                  {d}
                </li>
              ))}
            </ul>
            <span className="mt-4 inline-flex items-center gap-1 text-xs font-semibold text-primary">
              Select <ArrowRight className="size-3" />
            </span>
          </motion.button>
        );
      })}
    </div>
  );
}

/* ── Shared field primitives ─────────────────────────────────────────── */

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium">{label}</span>
      {children}
      {error && <span className="mt-1 block text-xs text-destructive">{error}</span>}
    </label>
  );
}

const inputCls =
  "clay-inset w-full rounded-xl px-3.5 py-2.5 text-sm outline-none placeholder:text-muted-foreground/60 focus:ring-2 focus:ring-ring/40";

function ContactFields<T extends FieldValues>({ form }: { form: UseFormReturn<T> }) {
  const errors = form.formState.errors as Record<string, { message?: string }>;
  return (
    <section className="space-y-3">
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Contact</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Your name" error={errors.clientName?.message}>
          <input {...form.register("clientName" as Path<T>)} className={inputCls} placeholder="Aarav Sharma" />
        </Field>
        <Field label="Email" error={errors.clientEmail?.message}>
          <input {...form.register("clientEmail" as Path<T>)} className={inputCls} placeholder="you@brand.com" />
        </Field>
      </div>
      <Field label="WhatsApp number" error={errors.clientWhatsapp?.message}>
        <input
          {...form.register("clientWhatsapp" as Path<T>)}
          className={inputCls}
          placeholder="+91 98765 43210"
        />
      </Field>
    </section>
  );
}

/* ── Design intake ───────────────────────────────────────────────────── */

type DesignValues = z.infer<typeof designSchema>;

function DesignForm({ tier, onComplete }: { tier: Tier; onComplete: (r: Record<string, unknown>) => void }) {
  const form = useForm<DesignValues>({
    resolver: zodResolver(designSchema),
    mode: "onChange",
    defaultValues: { brandPrimary: "#2f6b4f", brandSecondary: "#d99a5b", copy: "", notes: "", clientName: "", clientEmail: "", clientWhatsapp: "" },
  });
  const { register, formState, handleSubmit, watch } = form;
  const { isAuthenticated } = useAuth();
  const uploadUrl = useMutation(api.orders.generateUploadUrl);
  const [files, setFiles] = useState<{ name: string; size: number; type: string; status: "uploading" | "done" | "error"; storageId?: string }[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const startUpload = async (list: FileList | null) => {
    if (!list) return;
    for (const file of Array.from(list).slice(0, 5)) {
      setFiles((prev) => [...prev, { name: file.name, size: file.size, type: file.type, status: "uploading" }]);
      try {
        const url = await uploadUrl();
        const res = await fetch(url, { method: "POST", headers: { "Content-Type": file.type }, body: file });
        const { storageId } = (await res.json()) as { storageId: string };
        setFiles((prev) => prev.map((f) => (f.name === file.name && f.status === "uploading" ? { ...f, status: "done", storageId } : f)));
      } catch {
        setFiles((prev) => prev.map((f) => (f.name === file.name && f.status === "uploading" ? { ...f, status: "error" } : f)));
      }
    }
  };

  const onSubmit = (values: DesignValues) => {
    onComplete({
      ...values,
      referenceFiles: files.filter((f) => f.status === "done" && f.storageId).map((f) => ({ storageId: f.storageId, name: f.name, size: f.size, type: f.type })),
    });
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <section className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Design brief</p>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Primary brand colour">
            <div className="flex items-center gap-2">
              <input type="color" {...register("brandPrimary")} className="h-11 w-14 cursor-pointer rounded-xl border border-border bg-transparent p-1" />
              <span className="text-xs text-muted-foreground">{form.watch("brandPrimary")}</span>
            </div>
          </Field>
          <Field label="Secondary colour">
            <div className="flex items-center gap-2">
              <input type="color" {...register("brandSecondary")} className="h-11 w-14 cursor-pointer rounded-xl border border-border bg-transparent p-1" />
              <span className="text-xs text-muted-foreground">{form.watch("brandSecondary")}</span>
            </div>
          </Field>
        </div>
        <Field label="Copy / text for the design" error={formState.errors.copy?.message}>
          <textarea {...register("copy")} rows={3} className={inputCls} placeholder="Headline, subtext, contact line…" />
        </Field>
      </section>

      <section className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">References (optional)</p>
        <button
          type="button"
          disabled={!isAuthenticated}
          onClick={() => fileInputRef.current?.click()}
          className="clay-inset flex w-full flex-col items-center gap-1.5 rounded-2xl px-4 py-6 text-center text-sm text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50"
        >
          <CloudUpload className="size-5 text-primary" />
          {isAuthenticated ? "Drop or click to upload images (max 5)" : "Sign in to attach reference files"}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,application/pdf"
          multiple
          hidden
          onChange={(e) => startUpload(e.target.files)}
        />
        {files.map((f) => (
          <div key={f.name} className="flex items-center gap-2 text-xs text-muted-foreground">
            {f.status === "uploading" ? (
              <Loader2 className="size-3 animate-spin" />
            ) : f.status === "error" ? (
              <X className="size-3 text-destructive" />
            ) : (
              <Check className="size-3 text-primary" />
            )}
            <span className="truncate">{f.name}</span>
          </div>
        ))}
      </section>

      <Field label="Anything else?" error={formState.errors.notes?.message}>
        <textarea {...register("notes")} rows={2} className={inputCls} placeholder="Style, deadlines, links…" />
      </Field>

      <ContactFields form={form} />

      <SubmitBar price={tier.basePrice} disabled={!formState.isValid} submitting={formState.isSubmitting} />
    </form>
  );
}

/* ── Events intake ───────────────────────────────────────────────────── */

type EventsValues = z.infer<typeof eventsSchema>;

function EventsForm({ tier, onComplete }: { tier: Tier; onComplete: (r: Record<string, unknown>) => void }) {
  const form = useForm<EventsValues>({
    resolver: zodResolver(eventsSchema),
    mode: "onChange",
    defaultValues: { eventDate: "", venue: "", audienceSize: undefined, notes: "", clientName: "", clientEmail: "", clientWhatsapp: "" } as unknown as EventsValues,
  });
  const { register, formState, handleSubmit } = form;

  return (
    <form onSubmit={handleSubmit((v) => onComplete({ ...v }))} className="space-y-6">
      <section className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Event details</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Event date" error={formState.errors.eventDate?.message}>
            <input type="date" {...register("eventDate")} className={inputCls} />
          </Field>
          <Field label="Audience size" error={formState.errors.audienceSize?.message}>
            <select {...register("audienceSize")} className={inputCls}>
              <option value="">Select…</option>
              <option>Under 50</option>
              <option>50–200</option>
              <option>200–500</option>
              <option>500+</option>
            </select>
          </Field>
        </div>
        <Field label="Venue / location" error={formState.errors.venue?.message}>
          <input {...register("venue")} className={inputCls} placeholder="The Warehouse, Indiranagar, Bengaluru" />
        </Field>
        <Field label="Notes" error={formState.errors.notes?.message}>
          <textarea {...register("notes")} rows={2} className={inputCls} placeholder="Vibe, theme, must-haves…" />
        </Field>
      </section>
      <ContactFields form={form} />
      <SubmitBar price={tier.basePrice} disabled={!formState.isValid} submitting={formState.isSubmitting} />
    </form>
  );
}

/* ── Management intake ───────────────────────────────────────────────── */

type ManagementValues = z.infer<typeof managementSchema>;

const PLATFORMS = ["Instagram", "Twitter / X", "LinkedIn", "YouTube"];

function ManagementForm({ tier, onComplete }: { tier: Tier; onComplete: (r: Record<string, unknown>) => void }) {
  const form = useForm<ManagementValues>({
    resolver: zodResolver(managementSchema),
    mode: "onChange",
    defaultValues: { platforms: [], cadence: undefined, notes: "", clientName: "", clientEmail: "", clientWhatsapp: "" } as unknown as ManagementValues,
  });
  const { register, watch, setValue, formState, handleSubmit } = form;
  const platforms = form.watch("platforms") ?? [];

  const togglePlatform = (p: string) => {
    const next = platforms.includes(p) ? platforms.filter((x) => x !== p) : [...platforms, p];
    setValue("platforms", next, { shouldValidate: true });
  };

  return (
    <form onSubmit={handleSubmit((v) => onComplete({ ...v }))} className="space-y-6">
      <section className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Channels</p>
        <div className="flex flex-wrap gap-2">
          {PLATFORMS.map((p) => (
            <button
              type="button"
              key={p}
              onClick={() => togglePlatform(p)}
              className={cn(
                "clay-sm px-3.5 py-2 text-sm transition-colors",
                platforms.includes(p) && "bg-primary text-primary-foreground ring-2 ring-primary/60",
              )}
            >
              {p}
            </button>
          ))}
        </div>
        {formState.errors.platforms && (
          <span className="text-xs text-destructive">{formState.errors.platforms.message}</span>
        )}
        <Field label="Posting cadence" error={formState.errors.cadence?.message}>
          <select {...register("cadence")} className={inputCls}>
            <option value="">Select…</option>
            <option>8 posts / month</option>
            <option>16 posts / month</option>
            <option>30 posts / month</option>
          </select>
        </Field>
        <Field label="Notes" error={formState.errors.notes?.message}>
          <textarea {...register("notes")} rows={2} className={inputCls} placeholder="Brand voice, goals, current handles…" />
        </Field>
      </section>
      <ContactFields form={form} />
      <SubmitBar price={tier.basePrice} disabled={!formState.isValid} submitting={formState.isSubmitting} />
    </form>
  );
}

/* ── Locked submit ───────────────────────────────────────────────────── */

function SubmitBar({ price, disabled, submitting }: { price: number; disabled: boolean; submitting: boolean }) {
  return (
    <button
      type="submit"
      disabled={disabled || submitting}
      className={cn(
        "flex w-full items-center justify-center gap-2 rounded-2xl px-5 py-3.5 text-sm font-semibold transition-all",
        disabled
          ? "cursor-not-allowed bg-muted text-muted-foreground"
          : "bg-primary text-primary-foreground shadow-md hover:brightness-110",
      )}
    >
      {submitting ? <Loader2 className="size-4 animate-spin" /> : null}
      Add to cart · {inr(price)}
    </button>
  );
}
