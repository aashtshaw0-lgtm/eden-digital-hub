import { useCart } from "@/context/CartProvider";
import { useContent } from "@/context/ContentProvider";
import { useSettings } from "@/context/SettingsProvider";
import { api } from "@/convex/_generated/api";
import { discountFor } from "@/convex/coupons";
import type { CouponCheck } from "@/convex/coupons";
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
import { Check, Copy, HeartHandshake, Loader2, QrCode, Sparkles, TicketPercent, Trash2, Upload, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useAction } from "convex/react";
import { uploadProofImage } from "@/lib/imageUpload";
import { Link } from "react-router";
import { toast } from "sonner";

interface CreatedOrder {
  orderId: Id<"orders">;
  label: string;
  amount: number;
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
  const { t } = useContent();
  useSeo({
    title: t("seo.checkout.title"),
    description: t("seo.checkout.description"),
    canonical: "/checkout",
    noIndex: false,
  });
  const { items, total, removeItem, clear } = useCart();
  const { upiId, qrImageUrl } = useSettings();
  const createCartWithProof = useMutation(api.orders.createCartWithProof);
  const generateProofUrl = useMutation(api.orders.generateUploadUrl);
  const storeProofBytes = useAction(api.orders.storeProofBytes);
  const [paying, setPaying] = useState(false);
  const [copied, setCopied] = useState(false);
  const [tipAmount, setTipAmount] = useState(0);
  const [customTip, setCustomTip] = useState("");
  const [couponInput, setCouponInput] = useState("");
  // Prefilled from ?coupon= so a shared link applies itself on arrival. Read
  // lazily rather than in an effect so the first render is already correct.
  const [appliedCode, setAppliedCode] = useState(
    () => new URLSearchParams(window.location.search).get("coupon")?.trim() ?? "",
  );
  // Proof details — the order cannot be submitted without them.
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [utr, setUtr] = useState("");
  const [txnId, setTxnId] = useState("");
  const proofInputRef = useRef<HTMLInputElement | null>(null);
  // Orders just created, so we can ask for proof before leaving the page.
  const [createdOrders, setCreatedOrders] = useState<CreatedOrder[] | null>(null);

  const tip = customTip.trim() === "" ? tipAmount : Math.max(0, Number(customTip) || 0);
  const subtotal = total + tip;

  // Coupon — validated server-side, priced here with the same helper the
  // server uses so the preview can never disagree with the real charge.
  // Coupon validation is a mutation (the probe budget is written
  // transactionally), so it runs on demand rather than reactively.
  const checkCouponCode = useMutation(api.coupons.validate);
  const [couponCheck, setCouponCheck] = useState<CouponCheck | null>(null);

  // A single monotonic token, bumped for every check. `validate` is rate limited
  // to 20 probes per 10 minutes, so one Apply click must cost exactly one
  // probe, and a slow reply for an abandoned code must never overwrite the
  // result of a newer one.
  const couponProbe = useRef(0);

  /**
   * Asks the server about a code and resolves with the verdict.
   *
   * Deliberately does not write state: callers apply the result, which keeps
   * the state update inside a promise callback rather than an effect body.
   * Resolves `null` when a newer probe has superseded this one.
   */
  const runCouponCheck = useCallback(
    (code: string): Promise<CouponCheck | null> => {
      const trimmed = code.trim();
      if (trimmed === "") return Promise.resolve(null);
      const probe = ++couponProbe.current;
      const failure: CouponCheck = {
        ok: false,
        discount: 0,
        code: "not_found",
        message: "That code couldn't be checked right now — try again.",
      };
      return checkCouponCode({ code: trimmed })
        .catch(() => failure)
        .then((result) => (probe === couponProbe.current ? result : null));
    },
    [checkCouponCode],
  );

  // Fires only when the applied code actually changes — which covers the code
  // arriving in the URL, and nothing else. Clicking Apply for a *different*
  // code changes `appliedCode` and is checked by this effect; clicking Apply
  // for the code already applied is handled inline by the button, so a single
  // click never costs two probes.
  useEffect(() => {
    if (appliedCode === "") return;
    let cancelled = false;
    void runCouponCheck(appliedCode).then((result) => {
      if (!cancelled && result) setCouponCheck(result);
    });
    return () => {
      cancelled = true;
    };
  }, [appliedCode, runCouponCheck]);
  const discount = couponCheck?.ok
    ? discountFor({ kind: couponCheck.kind ?? "percent", value: couponCheck.value ?? 0 }, subtotal)
    : 0;
  const grandTotal = Math.max(0, subtotal - discount);
  // The tier is judged on what is actually paid, so a coupon can't cost
  // someone their premium credit.
  const tierLabel = useMemo(() => tipTierName(tip), [tip]);
  // Screenshot + UTR are all a client is asked for; the studio reads the
  // amount and payer name from the screenshot itself.
  const proofReady = proofFile !== null && utr.trim().length >= 4;

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
    if (!proofFile || !proofReady) {
      toast.error("Attach your screenshot and enter the UTR first.");
      return;
    }
    setPaying(true);
    const created: CreatedOrder[] = [];
    try {
      // Upload the screenshot first; the order + proof are then created
      // together so no order can exist without evidence.
      const upload = await uploadProofImage(proofFile, {
        getUploadUrl: () => generateProofUrl({}),
        sendBytes: (bytes) => storeProofBytes({ bytes }),
      });
      if (!upload.ok) throw new Error(upload.reason);
      const storageId = upload.storageId as Id<"_storage">;

      // The whole cart is one transaction: the tip and the coupon are each
      // charged once and allocated across the lines server-side, so a bad line
      // or a spent coupon cannot leave a partial order behind. The server
      // returns the per-line totals it actually wrote, so the receipt below
      // cannot drift from the charge.
      const first = items[0].requirements as Record<string, unknown>;
      created.push(
        ...(await createCartWithProof({
          items: items.map((item) => ({
            serviceId: item.serviceId as Id<"services">,
            tierId: item.tierId as Id<"serviceTiers">,
            requirements: item.requirements,
          })),
          clientName: String(first.clientName ?? ""),
          clientEmail: String(first.clientEmail ?? ""),
          clientWhatsapp: String(first.clientWhatsapp ?? ""),
          tipAmount: tip,
          storageId,
          utr,
          txnId: txnId || undefined,
          // Only send a code that actually validated. Sending a bad one would
          // make the server throw and fail the whole order, after the client
          // had already paid and uploaded their proof. The server still
          // re-validates.
          couponCode: couponCheck?.ok ? appliedCode : undefined,
        })),
      );
      clear();
      toast.success("Order and proof received — we'll confirm shortly.");
      setCreatedOrders(created);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not place the order.");
    } finally {
      setPaying(false);
    }
  };

  /* After checkout: the order and its proof were submitted together. */
  if (createdOrders) {
    return (
      <main className="mx-auto w-full max-w-3xl px-4 pb-24 pt-28 sm:px-6 sm:pt-36">
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center"
        >
          <span className="tint mx-auto flex size-14 items-center justify-center rounded-3xl">
            <Check className="size-7" />
          </span>
          <h1 className="font-display mt-5 text-3xl font-semibold tracking-tight">
            {t("checkout.doneTitle")}
          </h1>
          <p className="mx-auto mt-2 max-w-lg text-sm text-muted-foreground">
            {t("checkout.doneBody")}
          </p>
        </motion.div>

        <ul className="mt-8 space-y-2.5">
          {createdOrders.map((o) => (
            <motion.li
              key={o.orderId}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              className="clay flex items-center justify-between gap-3 p-4"
            >
              <span className="text-sm font-medium">{o.label}</span>
              <span className="text-sm font-semibold tabular-nums">{inr(o.amount)}</span>
            </motion.li>
          ))}
        </ul>

        <div className="mt-8 flex justify-center">
          <Link
            to="/portal"
            className="text-sm font-semibold text-primary hover:underline"
          >
            Go to my orders
          </Link>
        </div>
      </main>
    );
  }

  if (items.length === 0) {
    return (
      <main className="mx-auto flex min-h-dvh w-full max-w-2xl flex-col items-center justify-center px-4 pt-20 text-center">
        <span className="tint flex size-14 items-center justify-center rounded-3xl">
          <QrCode className="size-7" />
        </span>
        <h1 className="font-display mt-5 text-2xl font-semibold">{t("checkout.emptyTitle")}</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {t("checkout.emptyBody")}
        </p>
        <Link
          to="/services"
          className="mt-6 rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground shadow-md"
        >
          {t("checkout.emptyCta")}
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-5xl px-4 pb-24 pt-28 sm:px-6 sm:pt-36">
      <h1 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">
        {t("checkout.title")}
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">{t("checkout.subtitle")}</p>

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
                <h2 className="font-display text-base font-semibold">{t("checkout.tipHeading")}</h2>
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

          {/* Coupon */}
          <div className="clay p-5">
            <label className="mb-2 flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
              <TicketPercent className="size-4" />
              Have a coupon?
            </label>

            {appliedCode && couponCheck?.ok ? (
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-display text-sm font-bold tracking-wider">
                    {appliedCode}
                  </p>
                  <p className="text-xs font-medium text-emerald-700 dark:text-emerald-400">
                    {couponCheck.message}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <motion.span
                    key={discount}
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ type: "spring", stiffness: 400, damping: 20 }}
                    className="font-display text-lg font-semibold tabular-nums text-emerald-700 dark:text-emerald-400"
                  >
                    −{inr(discount)}
                  </motion.span>
                  <button
                    onClick={() => {
                      setAppliedCode("");
                      setCouponInput("");
                      setCouponCheck(null);
                    }}
                    className="clay-sm flex size-7 items-center justify-center text-muted-foreground hover:text-foreground"
                    aria-label="Remove coupon"
                  >
                    <X className="size-3.5" />
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex gap-2">
                <input
                  value={couponInput}
                  onChange={(e) => setCouponInput(e.target.value.toUpperCase())}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      const code = couponInput.trim();
                      setCouponCheck(null);
                      // Re-applying the same code does not change `appliedCode`,
                      // so the effect will not fire — check it right here.
                      if (code === appliedCode) {
                        void runCouponCheck(code).then((result) => {
                          if (result) setCouponCheck(result);
                        });
                      } else {
                        setAppliedCode(code);
                      }
                    }
                  }}
                  placeholder="Enter code"
                  className="clay-inset min-w-0 flex-1 rounded-xl px-3.5 py-2.5 text-sm font-semibold uppercase tracking-wide outline-none focus:ring-2 focus:ring-primary/40"
                />
                <button
                  onClick={() => {
                    const code = couponInput.trim();
                    setCouponCheck(null);
                    // Same rule as Enter: a new code is picked up by the effect,
                    // a repeat of the applied code is checked inline. One
                    // click, one probe.
                    if (code === appliedCode) {
                      void runCouponCheck(code).then((result) => {
                        if (result) setCouponCheck(result);
                      });
                    } else {
                      setAppliedCode(code);
                    }
                  }}
                  disabled={couponInput.trim() === ""}
                  className="tap shrink-0 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition hover:brightness-110 disabled:opacity-50"
                >
                  Apply
                </button>
              </div>
            )}

            <AnimatePresence>
              {appliedCode && couponCheck && !couponCheck.ok && (
                <motion.p
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="mt-2 text-xs font-medium text-rose-600"
                >
                  {couponCheck.message}
                </motion.p>
              )}
            </AnimatePresence>
          </div>

          <div className="clay space-y-2 p-5">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium text-muted-foreground">Subtotal</span>
              <span className="tabular-nums">{inr(subtotal)}</span>
            </div>
            <AnimatePresence>
              {discount > 0 && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="flex items-center justify-between overflow-hidden text-sm font-medium text-emerald-700 dark:text-emerald-400"
                >
                  <span className="flex items-center gap-1.5">
                    <TicketPercent className="size-3.5" />
                    Coupon {appliedCode}
                  </span>
                  <span className="tabular-nums">−{inr(discount)}</span>
                </motion.div>
              )}
            </AnimatePresence>
            <div className="flex items-center justify-between border-t border-border/60 pt-2">
              <span className="text-sm font-medium text-muted-foreground">
                Total payable
                {tip > 0 && (
                  <span className="ml-2 text-xs text-primary">incl. {inr(tip)} tip</span>
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
          </div>
        </section>

        {/* Payment */}
        <aside className="clay h-fit space-y-5 p-6">
          <div>
            <h2 className="font-display text-lg font-semibold">{t("checkout.payHeading")}</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {t("checkout.payBody")}
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
            disabled={paying || !proofReady}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-primary px-5 py-3.5 text-sm font-semibold text-primary-foreground shadow-md transition hover:brightness-110 disabled:opacity-50"
          >
            {paying && <Loader2 className="size-4 animate-spin" />}
            I Have Paid · {inr(grandTotal)}
          </button>

          <p className="text-center text-[11px] leading-snug text-muted-foreground">
            {proofReady
              ? "Order and proof reach the studio together; a manager confirms on WhatsApp."
              : "Pay first, then attach the screenshot and UTR below to unlock this button."}
          </p>

          {/* Proof details — required before the order can be submitted */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-3 border-t border-border/60 pt-5"
          >
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              1 · Attach your payment screenshot
            </p>
            <input
              ref={proofInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => setProofFile(e.target.files?.[0] ?? null)}
            />
            <button
              onClick={() => proofInputRef.current?.click()}
              className="clay-inset flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-medium text-muted-foreground transition hover:text-primary"
            >
              <Upload className="size-4" />
              {proofFile ? proofFile.name : "Choose screenshot"}
            </button>

            <p className="pt-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              2 · Enter the payment references
            </p>
            <input
              value={utr}
              onChange={(e) => setUtr(e.target.value)}
              placeholder="UPI reference / UTR number"
              inputMode="numeric"
              className="clay-inset w-full rounded-xl px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/40"
            />
            <input
              value={txnId}
              onChange={(e) => setTxnId(e.target.value)}
              placeholder="Transaction ID (optional)"
              className="clay-inset w-full rounded-xl px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/40"
            />
            <p className="text-[11px] leading-snug text-muted-foreground">
              We read the amount, date and payer name straight from your screenshot — no need to
              type them.
            </p>
          </motion.div>
        </aside>
      </div>
    </main>
  );
}
