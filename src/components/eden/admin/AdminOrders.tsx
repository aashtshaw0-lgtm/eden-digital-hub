import { api } from "@/convex/_generated/api";
import { formatDate, inr, labelize } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useMutation, useQuery } from "convex/react";
import { AnimatePresence, motion } from "framer-motion";
import {
  BadgeCheck,
  Bot,
  CircleAlert,
  Gauge,
  HandCoins,
  ImageUp,
  Loader2,
  ScanLine,
} from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import type { Doc, Id } from "@/convex/_generated/dataModel";

type Order = Doc<"orders"> & {
  clientAccountEmail?: string;
  clientAccountName?: string;
  proof?: {
    _id: Id<"paymentProofs">;
    storageId: Id<"_storage">;
    uploadedAt: number;
  } | null;
  review?: {
    _id: Id<"paymentReviews">;
    summary?: string;
    stillNeeded?: string[];
    paidAmount?: number;
    expectedAmount?: number;
    tipAmount?: number;
    isSpeedPay?: boolean;
  } | null;
};

const STATUS_STYLES: Record<string, string> = {
  pending: "bg-secondary text-secondary-foreground",
  approved: "bg-sky-600/15 text-sky-700",
  completed: "bg-emerald-600/15 text-emerald-700",
};

export function AdminOrders() {
  const orders = useQuery(api.orders.listAll);
  const updateStatus = useMutation(api.orders.updateStatus);
  const reviewProof = useMutation(api.orders.reviewProof);
  const confirmPayment = useMutation(api.orders.confirmPayment);
  const generateProofUrl = useMutation(api.orders.generateProofUrl);
  const attachProof = useMutation(api.orders.attachProof);
  const [selected, setSelected] = useState<Order | null>(null);
  const [reviewing, setReviewing] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<string | null>(null);
  const [uploadingFor, setUploadingFor] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const uploadTargetRef = useRef<Order | null>(null);

  const setStatus = async (orderId: Id<"orders">, status: string) => {
    try {
      await updateStatus({
        orderId,
        status: status as "pending" | "approved" | "completed",
      });
      toast.success(`Order marked ${status}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Update failed");
    }
  };

  /** Queues the AI proof review; the board updates when the review row lands. */
  const runAiReview = async (proofId: Id<"paymentProofs">) => {
    setReviewing(proofId);
    try {
      const result = await reviewProof({ proofId });
      toast.success(
        result.queued
          ? "AI review queued — the row updates in a few seconds"
          : "This proof was already reviewed",
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "AI review failed");
    } finally {
      setReviewing(null);
    }
  };

  const runConfirm = async (order: Order) => {
    if (!order.proof || !order.review) return;
    setConfirming(order._id);
    try {
      const paid = order.review.paidAmount ?? order.review.expectedAmount ?? order.totalPrice;
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
      toast.success("Proof attached — run the AI review next.");
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

  const paidCount = orders.filter(
    (o) => o.status !== "pending" || (o.review?.paidAmount ?? 0) >= o.totalPrice,
  ).length;
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

      {/* Counts */}
      <div className="mb-5 grid gap-3 sm:grid-cols-3">
        <StatCard label="Total orders" value={String(orders.length)} icon={Bot} />
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

      <div className="clay overflow-x-auto">
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
                  />
                </td>

                {/* AI alerts */}
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
          className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/30 p-4 backdrop-blur-sm"
          onClick={() => setSelected(null)}
        >
          <div
            className="clay max-h-[80vh] w-full max-w-lg overflow-y-auto p-6"
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
              <ReviewPanel order={selected} />
            )}

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

function StatCard({
  label,
  value,
  icon: Icon,
  tone,
}: {
  label: string;
  value: string;
  icon: typeof Bot;
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
}: {
  order: Order;
  onPickProof: () => void;
  uploading: boolean;
  onReview: () => void;
  reviewing: boolean;
  onConfirm: () => void;
  confirming: boolean;
}) {
  const isPaid =
    order.status !== "pending" ||
    (order.review?.paidAmount ?? 0) >= order.totalPrice;

  return (
    <div className="flex items-center gap-2">
      <span
        className={cn(
          "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold",
          isPaid
            ? "bg-emerald-600/15 text-emerald-700"
            : "bg-amber-500/15 text-amber-700",
        )}
      >
        {isPaid ? <BadgeCheck className="size-3" /> : <CircleAlert className="size-3" />}
        {isPaid ? "Paid" : "Unpaid"}
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
          AI review
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
    </div>
  );
}

function AlertBadges({ order }: { order: Order }) {
  const review = order.review;
  if (!review) return <span className="text-xs text-muted-foreground">—</span>;

  const paidAmount = review.paidAmount ?? 0;
  const tip = review.tipAmount ?? 0;
  const shortBy = order.totalPrice + tip - paidAmount;
  const showSpeed = review.isSpeedPay === true;
  const showLowTip = paidAmount > 0 && shortBy > 0 && tip > 0;

  return (
    <div className="flex flex-wrap gap-1.5">
      <AnimatePresence>
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
            <HandCoins className="size-3" /> Paid below tip by {inr(shortBy)}
          </motion.span>
        )}
        {tip > 0 && !showLowTip && (
          <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">
            <HandCoins className="size-3" /> Tip {inr(tip)}
          </span>
        )}
        {!showSpeed && !showLowTip && tip === 0 && (
          <span className="text-xs text-muted-foreground">—</span>
        )}
      </AnimatePresence>
    </div>
  );
}

function ReviewPanel({ order }: { order: Order }) {
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
            className="max-h-56 w-full rounded-xl border border-border/60 object-contain"
          />
        </a>
      )}

      {review ? (
        <>
          <p className="text-sm">{review.summary}</p>
          {review.paidAmount != null && (
            <p className="text-xs text-muted-foreground">
              AI read <span className="font-semibold">{inr(review.paidAmount)}</span> against an
              expected <span className="font-semibold">{inr(review.expectedAmount ?? order.totalPrice)}</span>
              {review.tipAmount ? ` · tip ${inr(review.tipAmount)}` : ""}
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
          Proof attached — use “AI review” to read it.
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