import { useCart } from "@/context/CartProvider";
import { useSettings } from "@/context/SettingsProvider";
import { api } from "@/convex/_generated/api";
import { inr } from "@/lib/format";
import { useSeo } from "@/lib/seo";
import type { Id } from "@/convex/_generated/dataModel";
import { motion } from "framer-motion";
import { Check, Copy, Loader2, QrCode, Trash2 } from "lucide-react";
import { useState } from "react";
import { useMutation } from "convex/react";
import { Link, useNavigate } from "react-router";
import { toast } from "sonner";

interface Req {
  clientName: string;
  clientEmail: string;
  clientWhatsapp: string;
}

export default function Checkout() {
  useSeo({ title: `Checkout | Eden - Digital Design & Management` });
  const { items, total, removeItem, clear } = useCart();
  const { upiId, qrImageUrl } = useSettings();
  const navigate = useNavigate();
  const createOrder = useMutation(api.orders.create);
  const [paying, setPaying] = useState(false);
  const [copied, setCopied] = useState(false);

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
        await createOrder({
          serviceId: item.serviceId as Id<"services">,
          tierId: item.tierId as Id<"serviceTiers">,
          requirements: item.requirements,
          clientName: r.clientName,
          clientEmail: r.clientEmail,
          clientWhatsapp: r.clientWhatsapp,
        });
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
            <span className="text-sm font-medium text-muted-foreground">Total payable</span>
            <span className="font-display text-2xl font-semibold">{inr(total)}</span>
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
            I Have Paid · {inr(total)}
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
