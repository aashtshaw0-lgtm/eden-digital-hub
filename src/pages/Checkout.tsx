import { useCart } from "@/context/CartProvider";
import { useSettings } from "@/context/SettingsProvider";
import { api } from "@/convex/_generated/api";
import {
  LEGENDARY_THRESHOLD,
  LEGENDARY_TIP_THRESHOLD,
  PREMIUM_THRESHOLD,
  PREMIUM_TIP_THRESHOLD,
} from "@/lib/credits";
import { inr } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useSeo } from "@/lib/seo";
import type { Id } from "@/convex/_generated/dataModel";
import { AnimatePresence, motion } from "framer-motion";
import { Check, Copy, HeartHandshake, Loader2, QrCode, Sparkles, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { useMutation } from "convex/react";
import { Link, useNavigate } from "react-router";
import { toast } from "sonner";

interface Req {
  clientName: string;
  clientEmail: string;
  clientWhatsapp: string;
}

/** Tip presets shown as quick-pick chips, plus a custom amount box. */
const TIP_PRESETS = [0, 100, 250, 500];

/** Mirrors the server-side tier gate so the copy matches what credits will do. */
function tipTierName(tip: number): string | null {
  if (tip >= LEGENDARY_THRESHOLD) return "Legendary";
  if (tip >= PREMIUM_THRESHOLD) return "Premium";
  return null;
}

export default function Checkout() {
  useSeo({ title: `Checkout | Eden - Digital Design & Management` });
  const { items, total, removeItem, clear } = useCart();
  const { upiId, qrImageUrl } = useSettings();
  const navigate = useNavigate();
  const createOrder = useMutation(api.orders.create);
  const recordTip = useMutation(api.orders.recordTip);
  const [paying, setPaying] = useState(false);
  const [copied, setCopied] = useState(false);
  const [tipAmount, setTipAmount] = useState(0);
  const [customTip, setCustomTip] = useState("");

  const tip = customTip.trim() === "" ? tipAmount : Math.max(0, Number(customTip) || 0);
  const grandTotal = total + tip;
  const tierLabel = useMemo(() => tipTierName(tip), [tip]);

  const copyUpi = async () => {
    try {
      await navigator.clipboard.writeText(upiId);
      setCopied(true);
      toast.success("UPI ID copied");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Couldn't copy — please select it manually.");
    }
  };

  const confirmPayment = async () => {
    setPaying(true);
    try {
      for (const item of items) {
        const r = item.requirements as unknown as Req;
        const orderId = await createOrder({
          serviceId: item.serviceId as Id<"services">,
          tierId: item.tierId as Id<"serviceTiers">,
          requirements: item.requirements,
          clientName: r.clientName,
          clientEmail: r.clientEmail,
          clientWhatsapp: r.clientWhatsapp,
        });
        // The tip rides along with the order so the admin board can alert on it.
        if (tip > 0) {
          await recordTip({ orderId, tipAmount: tip });
        }
      }
      clear();
      toast.success("Order received — we'll confirm on WhatsApp shortly.");
      navigate("/portal");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not place the order.");
    } finally {
      setPaying(false);
    }
  };

  if (items.length === 0) {
    return (
      <main className="mx-auto flex min-h-dvh w-full max-w-2xl flex-col items-center justify-center px-4 pt-20 text-center">
        <span className="tint flex size-14 items-center justify-center rounded-3xl">
          <QrCode className="size-7" />
        </span>
        <h1 className="font-display mt-5 text-2xl font-semibold">Your cart is empty</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Pick a service and a tier — the brief takes two minutes.
        </p>
        <Link
          to="/services"
          className="mt-6 rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground shadow-md"
        >
          Browse services
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-5xl px-4 pb-24 pt-28 sm:px-6 sm:pt-36">
      <h1 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">Checkout</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Pay by UPI, confirm, and we start immediately.
      </p>

      <div className="mt-10 grid gap-6 lg:grid-cols-[1fr_380px]">
        {/* Receipt */}
        <section className="space-y-4">
          {items.map((item, i) => (
            <motion.div key={`${item.tierId}-${i}`} layout className="clay flex items-start gap-4 p-5">
              <div className="flex-1">
                <p className="font-semibold">
                  {item.serviceName} <span className="text-primary">· {item.tierName}</span>
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {String((item.requirements as Record<string, unknown>).clientName ?? "")} ·{" "}
                  {String((item.requirements as Record<string, unknown>).clientWhatsapp ?? "")}
                </p>
                <p className="mt-2 font-display text-lg font-semibold">{inr(item.price)}</p>
              </div>
              <button
                onClick={() => removeItem(i)}
                className="clay-sm flex size-9 items-center justify-center text-muted-foreground hover:text-destructive"
                aria-label={`Remove ${item.serviceName}`}
              >
                <Trash2 className="size-4" />
              </button>
            </motion.div>
          ))}

          <div className="clay flex items-center justify-between p-5">
            <span className="text-sm font-medium text-muted-foreground">Subtotal</span>
            <span className="font-display text-lg font-semibold">{inr(total)}</span>
          </div>

          {/* Tip */}
          <motion.section
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.05 }}
            className="clay overflow-hidden p-5"
          >
            <div className="flex items-start gap-3">
              <span className="tint flex size-9 shrink-0 items-center justify-center rounded-xl">
                <HeartHandshake className="size-4" />
              </span>
              <div>
                <h2 className="font-display text-base font-semibold">Add a tip</h2>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Optional — tips above ₹{PREMIUM_TIP_THRESHOLD} earn a premium credit,
                  ₹{LEGENDARY_TIP_THRESHOLD} and above earns a legendary one.
                </p>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              {TIP_PRESETS.map((preset) => {
                const active = customTip.trim() === "" && tipAmount === preset;
                return (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => {
                      setTipAmount(preset);
                      setCustomTip("");
                    }}
                    className={cn(
                      "clay-sm rounded-full px-4 py-2 text-sm font-medium transition-colors",
                      active
                        ? "bg-primary text-primary-foreground ring-2 ring-primary/50"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {preset === 0 ? "No tip" : inr(preset)}
                  </button>
                );
              })}
            </div>

            <div className="clay-inset mt-3 flex items-center gap-2 rounded-xl px-3.5 py-2.5">
              <span className="text-sm font-medium text-muted-foreground">Custom</span>
              <input
                type="number"
                inputMode="numeric"
                min={0}
                value={customTip}
                onChange={(e) => setCustomTip(e.target.value)}
                placeholder={String(tipAmount)}
                className="w-full bg-transparent text-right text-sm font-medium outline-none placeholder:text-muted-foreground/60"
              />
              <span className="text-sm font-medium text-muted-foreground">INR</span>
            </div>

            <AnimatePresence>
              {tierLabel && (
                <motion.p
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="mt-3 flex items-center gap-2 text-xs font-medium text-primary"
                >
                  <Sparkles className="size-3.5" />
                  {tierLabel} credit unlocked — your name leads the credits wall.
                </motion.p>
              )}
            </AnimatePresence>
          </motion.section>

          <div className="clay flex items-center justify-between p-5">
            <span className="text-sm font-medium text-muted-foreground">
              Total payable
              {tip > 0 && (
                <span className="ml-2 text-xs text-primary">
                  incl. {inr(tip)} tip
                </span>
              )}
            </span>
            <motion.span
              key={grandTotal}
              initial={{ scale: 0.96, opacity: 0.6 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: "spring", stiffness: 320, damping: 22 }}
              className="font-display text-2xl font-semibold"
            >
              {inr(grandTotal)}
            </motion.span>
          </div>
        </section>

        {/* Payment */}
        <aside className="clay h-fit space-y-5 p-6">
          <div>
            <h2 className="font-display text-lg font-semibold">Scan & pay</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Any UPI app — GPay, PhonePe, Paytm.
            </p>
          </div>

          <div className="clay-inset mx-auto flex aspect-square w-52 items-center justify-center overflow-hidden rounded-2xl">
            {qrImageUrl ? (
              <img src={qrImageUrl} alt="UPI QR code" className="size-full object-contain p-2" />
            ) : (
              <div className="flex flex-col items-center gap-2 text-muted-foreground">
                <QrCode className="size-10" />
                <span className="px-6 text-center text-[11px] leading-snug">
                  QR not set yet — pay to the UPI ID below.
                </span>
              </div>
            )}
          </div>

          <div className="clay-inset flex items-center justify-between gap-2 rounded-xl px-3.5 py-2.5">
            <span className="truncate text-sm font-medium">{upiId}</span>
            <button
              onClick={copyUpi}
              className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-card text-muted-foreground shadow-sm hover:text-primary"
              aria-label="Copy UPI ID"
            >
              {copied ? <Check className="size-4 text-primary" /> : <Copy className="size-4" />}
            </button>
          </div>

          <button
            onClick={confirmPayment}
            disabled={paying}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-primary px-5 py-3.5 text-sm font-semibold text-primary-foreground shadow-md transition hover:brightness-110 disabled:opacity-60"
          >
            {paying && <Loader2 className="size-4 animate-spin" />}
            I Have Paid · {inr(grandTotal)}
          </button>
          <p className="text-center text-[11px] leading-snug text-muted-foreground">
            Your order lands in the studio queue instantly; a manager confirms
            receipt on WhatsApp.
          </p>
        </aside>
      </div>
    </main>
  );
}
