import { api } from "@/convex/_generated/api";
import { formatDate, inr, labelize } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useMutation, useQuery } from "convex/react";
import { Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import type { Doc, Id } from "@/convex/_generated/dataModel";

type Order = Doc<"orders"> & { clientAccountEmail?: string; clientAccountName?: string };

const STATUS_STYLES: Record<string, string> = {
  pending: "bg-secondary text-secondary-foreground",
  approved: "bg-sky-600/15 text-sky-700",
  completed: "bg-emerald-600/15 text-emerald-700",
};

export function AdminOrders() {
  const orders = useQuery(api.orders.listAll);
  const updateStatus = useMutation(api.orders.updateStatus);
  const [selected, setSelected] = useState<Order | null>(null);

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

  if (orders === undefined) {
    return <div className="clay h-64 animate-pulse opacity-60" />;
  }

  if (orders.length === 0) {
    return <p className="clay p-8 text-center text-sm text-muted-foreground">No orders yet.</p>;
  }

  return (
    <>
      <div className="clay overflow-x-auto">
        <table className="w-full min-w-[720px] text-sm">
          <thead>
            <tr className="border-b border-border/70 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <th className="px-5 py-3.5 font-medium">Order</th>
              <th className="px-5 py-3.5 font-medium">Client</th>
              <th className="px-5 py-3.5 font-medium">Placed</th>
              <th className="px-5 py-3.5 font-medium">Total</th>
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
                  <span className="block text-xs text-muted-foreground/70">{o.clientAccountEmail}</span>
                </td>
                <td className="px-5 py-3.5 text-muted-foreground">{formatDate(o.createdAt)}</td>
                <td className="px-5 py-3.5 font-medium tabular-nums">{inr(o.totalPrice)}</td>
                <td className="px-5 py-3.5 text-right" onClick={(e) => e.stopPropagation()}>
                  <select
                    value={o.status}
                    onChange={(e) => setStatus(o._id, e.target.value)}
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

      {/* Requirements modal */}
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
                  {selected.clientName} · {selected.clientEmail} · {selected.clientWhatsapp}
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
                  <div key={key} className="flex items-start justify-between gap-4 border-b border-border/50 pb-2.5">
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
