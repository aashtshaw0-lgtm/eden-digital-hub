import { api } from "@/convex/_generated/api";
import { formatDate, inr, labelize } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useMutation, useQuery } from "convex/react";
import { AnimatePresence, motion } from "framer-motion";
import {
  BadgeCheck,
  Receipt,
  CircleAlert,
  Gauge,
  HandCoins,
  ImageUp,
  Loader2,
  ScanLine,
  Undo2,
} from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import type { Doc, Id } from "@/convex/_generated/dataModel";

type Order = Doc<"orders"> & {
  clientAccountEmail?: string;
  clientAccountName?: string;
  mismatch?: "short" | "match" | "unknown";
  /**
   * Resolved server-side so the board, the paid pill, and the counts can never
   * disagree. `paidAmount: null` means "we do not know yet" — not zero.
   */
  paidAmount?: number | null;
  shortBy?: number | null;
  paidSource?: "ai" | "declared" | "unknown";
  proof?: {
    _id: Id<"paymentProofs">;
    storageId: Id<"_storage">;
    uploadedAt: number;
    utr?: string;
    txnId?: string;
    declaredAmount?: number;
    payerName?: string;
  } | null;
  review?: {
    _id: Id<"paymentReviews">;
    summary?: string;
    stillNeeded?: string[];
    paidAmount?: number;
    expectedAmount?: number;
    tipAmount?: number;
    isSpeedPay?: boolean;
    readFailed?: boolean;
  } | null;
};

/**
 * What the board is allowed to claim about a payment.
 *
 * `known` is false when nothing has been read yet, which is a different state
 * from "the client paid nothing" — collapsing the two is what made a receipt
 * the studio had not read show up as short by the entire order total.
 */
function paymentState(order: Order) {
  const paidAmount = order.paidAmount ?? null;
  const shortBy = order.shortBy ?? null;
  const settled = order.status !== "pending";
  return {
    paidAmount,
    shortBy,
    known: paidAmount !== null,
    short: shortBy !== null && shortBy > 0,
    paid: settled || (shortBy !== null && shortBy === 0),
  };
}

const STATUS_STYLES: Record<string, string> = {
  pending: "bg-secondary text-secondary-foreground",
  approved: "bg-sky-600/15 text-sky-700",
  completed: "bg-emerald-600/15 text-emerald-700",
  rejected: "bg-rose-600/15 text-rose-700",
};

export function AdminOrders() {
  const orders = useQuery(api.orders.listAll);
  const readiness = useQuery(api.orders.paymentReadiness);
  const updateStatus = useMutation(api.orders.updateStatus);
  const reviewProof = useMutation(api.orders.reviewProof);
  const confirmPayment = useMutation(api.orders.confirmPayment);
  const generateProofUrl = useMutation(api.orders.generateProofUrl);
  const attachProof = useMutation(api.orders.attachProof);
  const recordPaidAmount = useMutation(api.orders.recordPaidAmount);
  const [selected, setSelected] = useState<Order | null>(null);
  const [reviewing, setReviewing] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<string | null>(null);
  const [uploadingFor, setUploadingFor] = useState<string | null>(null);
  const [recording, setRecording] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const uploadTargetRef = useRef<Order | null>(null);

  const setStatus = async (orderId: Id<"orders">, status: string) => {
    try {
      await updateStatus({
        orderId,
        status: status as "pending" | "approved" | "completed" | "rejected",
      });
      toast.success(`Order marked ${status}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Update failed");
    }
  };

  /** Queues the receipt verification; the board updates when the review row lands. */
  const runAiReview = async (proofId: Id<"paymentProofs">) => {
    setReviewing(proofId);
    try {
      const result = await reviewProof({ proofId });
      toast.success(
        result.queued
          ? "Verifying the receipt — this row updates in a few seconds"
          : "This proof was already reviewed",
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Verify receipt failed");
    } finally {
      setReviewing(null);
    }
  };

  const runConfirm = async (order: Order) => {
    if (!order.proof || !order.review) return;
    // Confirming on a guess records the full order total as paid. Only the
    // amount actually read (or typed) may be written, otherwise the ledger
    // overstates what arrived.
    const paid = paymentState(order).paidAmount;
    if (paid === null) {
      toast.error("No amount has been read from this receipt yet — review it first.");
      return;
    }
    setConfirming(order._id);
    try {
      await confirmPayment({
        orderId: order._id,
        paidAmount: paid,
        reviewedProofId: order.proof._id,
      });
      toast.success(`Payment confirmed for ${order.clientName}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Confirm failed");
    } finally {
      setConfirming(null);
    }
  };

  /** Types in what the studio read off the screenshot, so a shortfall shows up. */
  const recordAmount = async (order: Order, raw: string) => {
    const value = Math.round(Number(raw));
    if (!Number.isFinite(value) || value < 0) {
      toast.error("Enter the amount printed on the receipt.");
      return;
    }
    setRecording(order._id);
    try {
      await recordPaidAmount({ orderId: order._id, paidAmount: value });
      const short = order.totalPrice - value;
      toast.success(
        short > 0
          ? `Recorded ${inr(value)} — ${inr(short)} still outstanding`
          : `Recorded ${inr(value)} — fully paid`,
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not record the amount");
    } finally {
      setRecording(null);
    }
  };

  /** Upload a proof image on behalf of the client (admin can request/attach it). */
  const pickProof = (order: Order) => {
    uploadTargetRef.current = order;
    setUploadingFor(order._id);
    fileInputRef.current?.click();
  };

  const onProofFile = async (file: File | undefined) => {
    const order = uploadTargetRef.current;
    if (!file || !order) return;
    try {
      const url = await generateProofUrl({ orderId: order._id });
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": file.type || "image/jpeg" },
        body: file,
      });
      if (!res.ok) throw new Error("Upload failed — try again.");
      const { storageId } = (await res.json()) as { storageId: Id<"_storage"> };
      await attachProof({ orderId: order._id, storageId });
      toast.success("Proof attached — run the verification next.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploadingFor(null);
      uploadTargetRef.current = null;
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  if (orders === undefined) {
    return <div className="clay h-64 animate-pulse opacity-60" />;
  }

  if (orders.length === 0) {
    return <p className="clay p-8 text-center text-sm text-muted-foreground">No orders yet.</p>;
  }

  const paidCount = orders.filter((o) => paymentState(o).paid).length;
  const unpaidCount = orders.length - paidCount;
  const tipTotal = orders.reduce((sum, o) => sum + (o.review?.tipAmount ?? 0), 0);

  return (
    <>
      {/* hidden input drives the proof upload */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => void onProofFile(e.target.files?.[0])}
      />

      {/* Payment readiness — clients cannot pay an account that does not exist */}
      <AnimatePresence>
        {readiness && !readiness.upiConfigured && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="mb-5 overflow-hidden"
          >
            <div className="flex flex-wrap items-center gap-3 rounded-2xl bg-amber-500/12 px-4 py-3.5 text-amber-900 ring-1 ring-amber-500/40 dark:text-amber-200">
              <CircleAlert className="size-5 shrink-0" />
              <div className="min-w-[220px] flex-1">
                <p className="text-sm font-semibold">No UPI ID configured yet</p>
                <p className="mt-0.5 text-xs">
                  Clients see a placeholder QR at checkout, so they cannot pay you. Set the UPI
                  ID (and ideally the QR image) under Website before taking orders.
                </p>
              </div>
              <a
                href="#website"
                className="clay-sm rounded-full px-3.5 py-2 text-xs font-semibold text-amber-900 hover:underline dark:text-amber-100"
              >
                Open Website settings
              </a>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {readiness && !readiness.aiConfigured && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="mb-5 overflow-hidden"
          >
            <div className="flex flex-wrap items-center gap-3 rounded-2xl bg-slate-500/10 px-4 py-3.5 ring-1 ring-slate-500/30">
              <ScanLine className="size-5 shrink-0 text-slate-600 dark:text-slate-300" />
              <div className="min-w-[220px] flex-1">
                <p className="text-sm font-semibold">Automatic receipt reading is off</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  No receipt-reading key is set, so amounts are never read from screenshots and
                  every order shows “Amount not read”. Add <code>GEMINI_API_KEY</code> in the Keys
                  tab to switch it on — or just type the amount into the Record box on any order,
                  which does the same job by hand.
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Counts */}
      <div className="mb-5 grid gap-3 sm:grid-cols-3">
        <StatCard label="Total orders" value={String(orders.length)} icon={Receipt} />
        <StatCard
          label="Paid"
          value={String(paidCount)}
          icon={BadgeCheck}
          tone="paid"
        />
        <StatCard
          label="Unpaid"
          value={String(unpaidCount)}
          icon={CircleAlert}
          tone="unpaid"
        />
      </div>

      {/* Mobile: stacked cards, no sideways scrolling. */}
      <ul className="space-y-3 lg:hidden">
        {orders.map((o) => (
          <li key={o._id} className="clay space-y-3 p-4">
            <button onClick={() => setSelected(o)} className="w-full text-left">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-semibold leading-tight">{o.serviceName}</p>
                  <p className="text-xs text-muted-foreground">{o.tierName}</p>
                </div>
                <span className="shrink-0 text-sm font-semibold tabular-nums">
                  {inr(o.totalPrice)}
                </span>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                {o.clientName} · {formatDate(o.createdAt)}
              </p>
            </button>

            <div className="flex flex-wrap items-center gap-2">
              <StatusPill status={o.status ?? "pending"} />
              <PaidPill order={o} />
            </div>

            <AlertBadges order={o} />

            {/* The mobile card used to stop at the status pill, so on a phone
                there was no way to read a receipt or type in what it said —
                those actions existed only in the desktop table. */}
            <div className="flex flex-wrap items-center gap-2">
              {!o.proof && (
                <button
                  onClick={() => pickProof(o)}
                  disabled={uploadingFor === o._id}
                  className="clay-sm inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium text-muted-foreground hover:text-primary"
                >
                  {uploadingFor === o._id ? (
                    <Loader2 className="size-3 animate-spin" />
                  ) : (
                    <ImageUp className="size-3" />
                  )}
                  Attach proof
                </button>
              )}
              {o.proof && !o.review && (
                <button
                  onClick={() => void runAiReview(o.proof!._id)}
                  disabled={reviewing === o.proof?._id}
                  className="clay-sm inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium text-primary hover:underline"
                >
                  {reviewing === o.proof?._id ? (
                    <Loader2 className="size-3 animate-spin" />
                  ) : (
                    <ScanLine className="size-3" />
                  )}
                  Verify receipt
                </button>
              )}
            </div>

            {/* Full width and labelled, because this is the one control that
                turns "we could not read it" into a real shortfall number. */}
            <RecordAmountBox
              order={o}
              onRecord={(v) => void recordAmount(o, v)}
              recording={recording === o._id}
              block
            />

            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setSelected(o)}
                className="clay-sm flex-1 rounded-xl px-3 py-2 text-xs font-semibold text-primary"
              >
                Open & decide
              </button>
              <button
                onClick={() => void setStatus(o._id, o.status === "approved" ? "pending" : "approved")}
                className="clay-sm rounded-xl px-3 py-2 text-xs font-medium text-muted-foreground"
              >
                {o.status === "approved" ? "Undo approve" : "Approve"}
              </button>
            </div>
          </li>
        ))}
      </ul>

      {/* Desktop: full table */}
      <div className="clay hidden overflow-x-auto lg:block">
        <table className="w-full min-w-[860px] text-sm">
          <thead>
            <tr className="border-b border-border/70 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <th className="px-5 py-3.5 font-medium">Order</th>
              <th className="px-5 py-3.5 font-medium">Client</th>
              <th className="px-5 py-3.5 font-medium">Placed</th>
              <th className="px-5 py-3.5 font-medium">Total</th>
              <th className="px-5 py-3.5 font-medium">Payment</th>
              <th className="px-5 py-3.5 font-medium">Alerts</th>
              <th className="px-5 py-3.5 text-right font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((o) => (
              <tr
                key={o._id}
                onClick={() => setSelected(o)}
                className="cursor-pointer border-b border-border/50 transition-colors last:border-0 hover:bg-secondary/40"
              >
                <td className="px-5 py-3.5">
                  <span className="font-medium">{o.serviceName}</span>
                  <span className="text-muted-foreground"> · {o.tierName}</span>
                </td>
                <td className="px-5 py-3.5 text-muted-foreground">
                  {o.clientName}
                  <span className="block text-xs text-muted-foreground/70">
                    {o.clientAccountEmail}
                  </span>
                </td>
                <td className="px-5 py-3.5 text-muted-foreground">
                  {formatDate(o.createdAt)}
                </td>
                <td className="px-5 py-3.5 font-medium tabular-nums">{inr(o.totalPrice)}</td>

                {/* Paid / unpaid + proof actions */}
                <td className="px-5 py-3.5" onClick={(e) => e.stopPropagation()}>
                  <PaidCell
                    order={o}
                    onPickProof={() => pickProof(o)}
                    uploading={uploadingFor === o._id}
                    onReview={() => void runAiReview(o.proof!._id)}
                    reviewing={reviewing === o.proof?._id}
                    onConfirm={() => void runConfirm(o)}
                    confirming={confirming === o._id}
                    onRecord={(value) => void recordAmount(o, value)}
                    recording={recording === o._id}
                  />
                </td>

                {/* alerts */}
                <td className="px-5 py-3.5">
                  <AlertBadges order={o} />
                </td>

                <td className="px-5 py-3.5 text-right" onClick={(e) => e.stopPropagation()}>
                  <select
                    value={o.status ?? "pending"}
                    onChange={(e) => void setStatus(o._id, e.target.value)}
                    className={cn(
                      "cursor-pointer rounded-full px-3 py-1.5 text-xs font-semibold capitalize outline-none",
                      STATUS_STYLES[o.status ?? "pending"],
                    )}
                  >
                    <option value="pending">Pending</option>
                    <option value="approved">Approved</option>
                    <option value="completed">Completed</option>
                    <option value="rejected">Rejected</option>
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="mt-4 text-xs text-muted-foreground">
        Tips captured on reviewed proofs: {inr(tipTotal)}
      </p>

      {/* Requirements + proof detail modal */}
      {selected && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-foreground/30 backdrop-blur-sm sm:items-center sm:p-4"
          onClick={() => setSelected(null)}
        >
          <div
            className="clay w-full max-h-[92dvh] overflow-y-auto rounded-b-none p-5 sm:max-h-[85vh] sm:max-w-lg sm:rounded-2xl sm:p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="font-display text-lg font-semibold">
                  {selected.serviceName} · {selected.tierName}
                </h3>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {selected.clientName} · {selected.clientEmail} ·{" "}
                  {selected.clientWhatsapp}
                </p>
              </div>
              <button
                onClick={() => setSelected(null)}
                className="clay-sm flex size-8 items-center justify-center text-muted-foreground"
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            {selected.proof && (
              <ReviewPanel
                order={selected}
                onRecord={(value) => void recordAmount(selected, value)}
                recording={recording === selected._id}
              />
            )}

            {selected.proof && <DecisionPanel order={selected} />}

            <dl className="mt-5 space-y-3">
              {Object.entries(
                selected.requirements as Record<string, unknown>,
              ).map(([key, value]) => {
                if (key === "referenceFiles" && Array.isArray(value)) {
                  return (
                    <div key={key}>
                      <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        {labelize(key)}
                      </dt>
                      <dd className="mt-1 space-y-1">
                        {value.length === 0 ? (
                          <span className="text-sm text-muted-foreground">None attached</span>
                        ) : (
                          (value as { storageId: Id<"_storage">; name: string }[]).map((f) => (
                            <FileLink key={f.storageId} storageId={f.storageId} name={f.name} />
                          ))
                        )}
                      </dd>
                    </div>
                  );
                }
                const display =
                  typeof value === "object" && value !== null
                    ? Array.isArray(value)
                      ? value.join(", ")
                      : JSON.stringify(value)
                    : String(value);
                if (!display) return null;
                return (
                  <div
                    key={key}
                    className="flex items-start justify-between gap-4 border-b border-border/50 pb-2.5"
                  >
                    <dt className="shrink-0 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      {labelize(key)}
                    </dt>
                    <dd className="text-right text-sm">{display}</dd>
                  </div>
                );
              })}
            </dl>
          </div>
        </div>
      )}
    </>
  );
}

function StatusPill({ status }: { status: string }) {
  return (
    <span
      className={cn(
        "rounded-full px-2.5 py-1 text-xs font-semibold capitalize",
        STATUS_STYLES[status] ?? STATUS_STYLES.pending,
      )}
    >
      {status}
    </span>
  );
}

function PaidPill({ order }: { order: Order }) {
  const { known, paid } = paymentState(order);
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold",
        paid
          ? "bg-emerald-600/15 text-emerald-700"
          : known
            ? "bg-amber-500/15 text-amber-700"
            : "bg-slate-600/15 text-slate-700 dark:text-slate-300",
      )}
    >
      {paid ? <BadgeCheck className="size-3" /> : <CircleAlert className="size-3" />}
      {paid ? "Paid" : known ? "Unpaid" : "Unverified"}
    </span>
  );
}

function StatCard({
  label,
  value,
  icon: Icon,
  tone,
}: {
  label: string;
  value: string;
  icon: typeof Receipt;
  tone?: "paid" | "unpaid";
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className="clay flex items-center gap-3 p-4"
    >
      <span
        className={cn(
          "tint flex size-9 items-center justify-center rounded-xl",
          tone === "paid" && "bg-emerald-600/15 text-emerald-700",
          tone === "unpaid" && "bg-amber-500/15 text-amber-700",
        )}
      >
        <Icon className="size-4" />
      </span>
      <div>
        <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className="font-display text-xl font-semibold tabular-nums">{value}</p>
      </div>
    </motion.div>
  );
}

function PaidCell({
  order,
  onPickProof,
  uploading,
  onReview,
  reviewing,
  onConfirm,
  confirming,
  onRecord,
  recording,
}: {
  order: Order;
  onPickProof: () => void;
  uploading: boolean;
  onReview: () => void;
  reviewing: boolean;
  onConfirm: () => void;
  confirming: boolean;
  onRecord: (value: string) => void;
  recording: boolean;
}) {
  const { known, paid: isPaid } = paymentState(order);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span
        className={cn(
          "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold",
          isPaid
            ? "bg-emerald-600/15 text-emerald-700"
            : known
              ? "bg-amber-500/15 text-amber-700"
              : "bg-slate-600/15 text-slate-700 dark:text-slate-300",
        )}
      >
        {isPaid ? <BadgeCheck className="size-3" /> : <CircleAlert className="size-3" />}
        {isPaid ? "Paid" : known ? "Unpaid" : "Unverified"}
      </span>

      {!order.proof && (
        <button
          onClick={onPickProof}
          disabled={uploading}
          className="clay-sm inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-muted-foreground hover:text-primary"
        >
          {uploading ? (
            <Loader2 className="size-3 animate-spin" />
          ) : (
            <ImageUp className="size-3" />
          )}
          Proof
        </button>
      )}

      {order.proof && !order.review && (
        <button
          onClick={onReview}
          disabled={reviewing}
          className="clay-sm inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-primary hover:underline"
        >
          {reviewing ? <Loader2 className="size-3 animate-spin" /> : <ScanLine className="size-3" />}
          Verify receipt
        </button>
      )}

      {order.proof && order.review && order.status === "pending" && (
        <button
          onClick={onConfirm}
          disabled={confirming}
          className="clay-sm inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-emerald-700 hover:underline"
        >
          {confirming ? <Loader2 className="size-3 animate-spin" /> : <BadgeCheck className="size-3" />}
          Confirm
        </button>
      )}

      {order.proof && !known && order.status === "pending" && (
        <RecordAmountBox order={order} onRecord={onRecord} recording={recording} />
      )}
    </div>
  );
}

/**
 * Lets the studio type what the receipt actually says.
 *
 * Shared by the desktop table, the mobile card and the proof panel — it used to
 * exist only in the table, which left phones with no way to record an amount at
 * all. Typing here is what turns "Amount not read" into a real
 * "Short ₹1,631 (₹55 of ₹1,686)" warning, which is the whole point of the
 * board: it must never say a paying client still owes money that arrived.
 */
function RecordAmountBox({
  order,
  onRecord,
  recording,
  block = false,
}: {
  order: Order;
  onRecord: (value: string) => void;
  recording: boolean;
  /** Full-width layout for the mobile card, where the inline one is too small. */
  block?: boolean;
}) {
  const { known } = paymentState(order);
  if (!order.proof || known || order.status !== "pending") return null;

  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const input = e.currentTarget.elements.namedItem("amount") as HTMLInputElement | null;
    if (input) onRecord(input.value);
  };

  const input = (
    <input
      name="amount"
      type="number"
      min={0}
      inputMode="numeric"
      placeholder={`₹ paid · order is ${inr(order.totalPrice)}`}
      aria-label={`Amount paid on the ${order.serviceName} order`}
      className={cn(
        "clay-inset rounded-lg px-3 py-2 text-sm tabular-nums outline-none focus:ring-2 focus:ring-primary/40",
        block ? "min-w-0 flex-1" : "w-24",
      )}
    />
  );

  const button = (
    <button
      type="submit"
      disabled={recording}
      className="clay-sm inline-flex shrink-0 items-center gap-1 rounded-lg bg-primary px-3.5 py-2 text-xs font-semibold text-primary-foreground transition hover:brightness-110 disabled:opacity-50"
    >
      {recording ? <Loader2 className="size-3 animate-spin" /> : <Receipt className="size-3" />}
      Record
    </button>
  );

  if (!block) {
    return (
      <form className="flex items-center gap-1.5" onSubmit={submit}>
        {input}
        {button}
      </form>
    );
  }

  return (
    <form
      className="space-y-2 rounded-xl bg-amber-500/10 p-3 ring-1 ring-amber-500/30"
      onSubmit={submit}
    >
      <p className="text-xs leading-snug text-amber-900 dark:text-amber-200">
        <strong className="font-semibold">Read the receipt yourself.</strong> Look at the
        screenshot under “Open &amp; decide”, then type the amount that was actually debited here.
        That turns this order into a real shortfall warning instead of “Amount not read”.
      </p>
      <div className="flex items-center gap-2">
        {input}
        {button}
      </div>
    </form>
  );
}

function AlertBadges({ order }: { order: Order }) {
  const review = order.review;
  const { paidAmount, shortBy, known, short } = paymentState(order);
  const showSpeed = review?.isSpeedPay === true;
  const tip = review?.tipAmount ?? 0;
  const showLowTip = known && short && tip > 0;
  // A proof with nothing readable yet is its own alert. Reporting a shortfall
  // here would be a guess dressed up as a number.
  const showUnread = order.proof !== null && !known && order.status === "pending";

  if (!review && !order.proof) {
    return <span className="text-xs text-muted-foreground">—</span>;
  }

  if (!short && !showSpeed && !showUnread && tip === 0) {
    return <span className="text-xs text-muted-foreground">—</span>;
  }

  return (
    <div className="flex flex-wrap gap-1.5">
      <AnimatePresence>
        {showUnread && (
          <motion.span
            initial={{ opacity: 0, scale: 0.85 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.85 }}
            className="inline-flex items-center gap-1 rounded-full bg-slate-600/15 px-2 py-0.5 text-[11px] font-semibold text-slate-700 dark:text-slate-300"
            title="No amount has been read from this receipt yet."
          >
            <ScanLine className="size-3" />
            {review?.readFailed ? "Could not read" : "Amount not read"}
          </motion.span>
        )}
        {short && shortBy !== null && (
          <motion.span
            initial={{ opacity: 0, scale: 0.85 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.85 }}
            className="inline-flex items-center gap-1 rounded-full bg-rose-600/15 px-2 py-0.5 text-[11px] font-semibold text-rose-700"
          >
            <CircleAlert className="size-3" />
            Short {inr(shortBy)}
            <span className="font-normal opacity-80">
              {" "}
              ({inr(paidAmount ?? 0)} of {inr(order.totalPrice)})
            </span>
          </motion.span>
        )}
        {showSpeed && (
          <motion.span
            initial={{ opacity: 0, scale: 0.85 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.85 }}
            className="inline-flex items-center gap-1 rounded-full bg-sky-600/15 px-2 py-0.5 text-[11px] font-semibold text-sky-700"
          >
            <Gauge className="size-3" /> Speed-pay
          </motion.span>
        )}
        {showLowTip && (
          <motion.span
            initial={{ opacity: 0, scale: 0.85 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.85 }}
            className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-[11px] font-semibold text-amber-700"
          >
            <HandCoins className="size-3" /> Tip {inr(tip)} not covered
          </motion.span>
        )}
        {tip > 0 && !showLowTip && (
          <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">
            <HandCoins className="size-3" /> Tip {inr(tip)}
          </span>
        )}
        {!showSpeed && !showLowTip && !short && !showUnread && tip === 0 && (
          <span className="text-xs text-muted-foreground">—</span>
        )}
      </AnimatePresence>
    </div>
  );
}

function DecisionPanel({ order }: { order: Order }) {
  const approveOrder = useMutation(api.orders.approve);
  const rejectOrder = useMutation(api.orders.reject);
  const refundOrder = useMutation(api.orders.markRefunded);
  const [reason, setReason] = useState(order.rejectionReason ?? "");
  const [busy, setBusy] = useState<"approve" | "reject" | "refund" | null>(null);

  const run = async (kind: "approve" | "reject" | "refund") => {
    setBusy(kind);
    try {
      if (kind === "approve") {
        await approveOrder({ orderId: order._id });
        toast.success(`Approved ${order.clientName}'s order`);
      } else if (kind === "reject") {
        if (!reason.trim()) {
          toast.error("Give the client a reason for declining.");
          return;
        }
        await rejectOrder({ orderId: order._id, reason });
        toast.success("Order declined — the client can see your reason");
      } else {
        await refundOrder({ orderId: order._id });
        toast.success("Marked as refunded");
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Action failed");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="mt-5 space-y-3 rounded-2xl bg-secondary/40 p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Contact & decide
      </p>

      {/* Client details, ready to copy or tap */}
      <div className="grid gap-1.5 text-xs">
        <p>
          <span className="text-muted-foreground">Name</span> ·{" "}
          <span className="font-medium">{order.clientName}</span>
        </p>
        <p className="flex items-center gap-1.5">
          <span className="text-muted-foreground">Email</span> ·{" "}
          <a
            href={`mailto:${order.clientAccountEmail ?? order.clientEmail}`}
            className="font-medium text-primary hover:underline"
          >
            {order.clientAccountEmail ?? order.clientEmail}
          </a>
        </p>
        <p className="flex items-center gap-1.5">
          <span className="text-muted-foreground">WhatsApp</span> ·{" "}
          <a
            href={`https://wa.me/91${order.clientWhatsapp.replace(/\D/g, "").slice(-10)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-primary hover:underline"
          >
            {order.clientWhatsapp}
          </a>
        </p>
      </div>

      {/* Declined with a reason, visible to the client */}
      {order.status === "rejected" && order.rejectionReason && (
        <p className="rounded-xl bg-rose-600/10 px-3 py-2 text-xs text-rose-700">
          Declined: {order.rejectionReason}
        </p>
      )}
      {order.refundedAt && (
        <p className="rounded-xl bg-emerald-600/10 px-3 py-2 text-xs text-emerald-700">
          Refunded {inr(order.refundedAmount ?? 0)} on{" "}
          {formatDate(order.refundedAt)}
        </p>
      )}

      {order.status !== "rejected" && order.status !== "completed" && (
        <>
          <input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Reason if declining — the client sees this"
            className="clay-inset w-full rounded-xl px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/40"
          />
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => void run("approve")}
              disabled={busy !== null || order.status === "approved"}
              className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-semibold text-white transition hover:brightness-110 disabled:opacity-50"
            >
              {busy === "approve" ? <Loader2 className="size-3.5 animate-spin" /> : <BadgeCheck className="size-3.5" />}
              Approve
            </button>
            <button
              onClick={() => void run("reject")}
              disabled={busy !== null}
              className="inline-flex items-center gap-1.5 rounded-xl bg-rose-600 px-4 py-2.5 text-xs font-semibold text-white transition hover:brightness-110 disabled:opacity-50"
            >
              {busy === "reject" ? <Loader2 className="size-3.5 animate-spin" /> : <CircleAlert className="size-3.5" />}
              Decline
            </button>
            <button
              onClick={() => void run("refund")}
              disabled={busy !== null || Boolean(order.refundedAt)}
              className="clay-sm inline-flex items-center gap-1.5 rounded-xl px-4 py-2.5 text-xs font-semibold text-muted-foreground transition hover:text-foreground disabled:opacity-50"
            >
              {busy === "refund" ? <Loader2 className="size-3.5 animate-spin" /> : <Undo2 className="size-3.5" />}
              Money sent back
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function ReviewPanel({
  order,
  onRecord,
  recording,
}: {
  order: Order;
  onRecord: (value: string) => void;
  recording: boolean;
}) {
  const url = useQuery(api.portfolio.fileUrl, { storageId: order.proof!.storageId });
  const review = order.review;

  return (
    <div className="mt-5 space-y-3">
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        <ScanLine className="size-3.5" /> Payment proof
      </div>

      {url && (
        <a href={url} target="_blank" rel="noopener noreferrer" className="block">
          <img
            src={url}
            alt="Payment proof"
            className="max-h-72 w-full rounded-xl border border-border/60 object-contain"
          />
        </a>
      )}

      {/* Directly under the screenshot, because that is where the number is. */}
      <RecordAmountBox
        order={order}
        onRecord={onRecord}
        recording={recording}
        block
      />

      {/* What the client claimed when they submitted */}
      <dl className="grid grid-cols-2 gap-2 text-xs">
        <div>
          <dt className="text-muted-foreground">UTR</dt>
          <dd className="font-medium tabular-nums">{order.proof?.utr ?? "—"}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Transaction ID</dt>
          <dd className="truncate font-medium">{order.proof?.txnId ?? "—"}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Declared amount</dt>
          <dd className="font-medium tabular-nums">
            {order.proof?.declaredAmount != null ? inr(order.proof.declaredAmount) : "—"}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Paid by</dt>
          <dd className="font-medium">{order.proof?.payerName ?? "—"}</dd>
        </div>
        <div className="col-span-2">
          <dt className="text-muted-foreground">Order total</dt>
          <dd className="font-medium tabular-nums">{inr(order.totalPrice)}</dd>
        </div>
      </dl>

      {review ? (
        <>
          <p className="text-sm">{review.summary}</p>
          {review.paidAmount != null && (
            <p className="text-xs text-muted-foreground">
              Studio read <span className="font-semibold">{inr(review.paidAmount)}</span> against an
              expected <span className="font-semibold">{inr(review.expectedAmount ?? order.totalPrice)}</span>
              {review.tipAmount ? ` · tip ${inr(review.tipAmount)}` : ""}
            </p>
          )}
          {review.readFailed && (
            <p className="text-xs font-medium text-amber-700 dark:text-amber-300">
              We could not read this receipt. Run “Verify receipt” again, or read the amount
              yourself from the screenshot — it has not been treated as unpaid.
            </p>
          )}
          {review.paidAmount == null && !review.readFailed && (
            <p className="text-xs text-muted-foreground">
              No amount was legible on the screenshot — check it manually before approving.
            </p>
          )}
          {review.stillNeeded && review.stillNeeded.length > 0 && (
            <div className="clay-inset space-y-1.5 rounded-xl p-3.5">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Still needed from the client
              </p>
              <ul className="space-y-1">
                {review.stillNeeded.map((need, i) => (
                  <li key={i} className="flex gap-2 text-xs text-muted-foreground">
                    <span aria-hidden>•</span>
                    <span>{need}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      ) : (
        <p className="text-xs text-muted-foreground">
          Proof attached — use “Verify receipt” to read it.
        </p>
      )}
    </div>
  );
}

function FileLink({ storageId, name }: { storageId: Id<"_storage">; name: string }) {
  const url = useQuery(api.portfolio.fileUrl, { storageId });
  return (
    <a
      href={url ?? undefined}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
    >
      {url ? name : <Loader2 className="size-3 animate-spin" />} ↗
    </a>
  );
}