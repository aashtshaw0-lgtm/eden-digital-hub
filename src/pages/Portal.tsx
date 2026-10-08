import { useAuth } from "@/hooks/use-auth";
import { api } from "@/convex/_generated/api";
import { useContent } from "@/context/ContentProvider";
import { ProofRequest } from "@/components/eden/ProofRequest";
import { formatDate, inr } from "@/lib/format";
import { useSeo } from "@/lib/seo";
import { cn } from "@/lib/utils";
import { useMutation, useQuery } from "convex/react";
import { ArrowUpRight, CheckCircle2, LogOut, PackageOpen, ReceiptIndianRupee, ShieldCheck } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router";

const STATUS_STYLES: Record<string, string> = {
  pending: "bg-secondary text-secondary-foreground", // gray
  approved: "bg-sky-600/15 text-sky-700", // blue
  completed: "bg-emerald-600/15 text-emerald-700", // green
  rejected: "bg-rose-600/15 text-rose-700", // red
};

export default function Portal() {
  const { t } = useContent();
  useSeo({
    title: t("seo.portal.title"),
    description: t("seo.portal.description"),
    canonical: "/portal",
    noIndex: false,
  });
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const orders = useQuery(api.orders.listMine);
  const syncRole = useMutation(api.users.syncUserRole);
  const role = useQuery(api.users.myRole);
  // Which pending order is showing its proof request inline.
  const [proofFor, setProofFor] = useState<string | null>(null);

  useEffect(() => {
    void syncRole();
  }, [syncRole]);

  return (
    <main className="mx-auto w-full max-w-5xl px-4 pb-24 pt-28 sm:px-6 sm:pt-36">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm text-muted-foreground">{t("portal.welcome")}</p>
          <h1 className="font-display mt-1 text-3xl font-semibold tracking-tight">
            {user?.name || user?.email}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">{user?.email}</p>
        </div>
        <div className="flex items-center gap-2">
          {(role === "manager" || role === "super_owner") && (
            <Link
              to="/admin"
              className="clay-sm inline-flex items-center gap-1.5 rounded-full px-4 py-2.5 text-sm font-semibold text-primary"
            >
              <ShieldCheck className="size-4" /> {t("portal.adminLink")}
            </Link>
          )}
          <button
            onClick={async () => {
              await signOut();
              navigate("/");
            }}
            className="clay-sm inline-flex items-center gap-1.5 rounded-full px-4 py-2.5 text-sm font-medium text-muted-foreground hover:text-foreground"
          >
            <LogOut className="size-4" /> {t("portal.signOut")}
          </button>
        </div>
      </header>

      <section className="mt-10">
        <h2 className="font-display text-xl font-semibold">{t("portal.ordersTitle")}</h2>
        {orders === undefined ? (
          <div className="mt-4 space-y-2">
            {[0, 1, 2].map((i) => (
              <div key={i} className="clay h-16 animate-pulse opacity-60" />
            ))}
          </div>
        ) : orders.length === 0 ? (
          <div className="clay mt-4 flex flex-col items-center gap-3 p-10 text-center">
            <span className="tint flex size-12 items-center justify-center rounded-2xl">
              <PackageOpen className="size-6" />
            </span>
            <p className="text-sm text-muted-foreground">
              {t("portal.empty")}
            </p>
            <Link
              to="/services"
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline"
            >
              {t("portal.emptyCta")} <ArrowUpRight className="size-4" />
            </Link>
          </div>
        ) : (
          <div className="clay mt-4 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/70 text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="px-5 py-3.5 font-medium">Service</th>
                  <th className="px-5 py-3.5 font-medium">Placed</th>
                  <th className="px-5 py-3.5 font-medium">Total</th>
                  <th className="px-5 py-3.5 text-right font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((o) => (
                  <tr key={o._id} className="border-b border-border/50 last:border-0">
                    <td className="px-5 py-3.5">
                      <span className="font-medium">{o.serviceName}</span>
                      <span className="text-muted-foreground"> · {o.tierName}</span>
                    </td>
                    <td className="px-5 py-3.5 text-muted-foreground">{formatDate(o.createdAt)}</td>
                    <td className="px-5 py-3.5 font-medium tabular-nums">{inr(o.totalPrice)}</td>
                    <td className="px-5 py-3.5 text-right">
                      <span
                        className={cn(
                          "inline-block rounded-full px-3 py-1 text-xs font-semibold capitalize",
                          STATUS_STYLES[o.status ?? "pending"],
                        )}
                      >
                        {o.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Proof requests — one per order still waiting on money */}
      {orders
        ?.filter((o) => o.status === "pending")
        .map((o) => {
            const open = proofFor === o._id;
            if (o.hasProof) {
              return (
                <section key={o._id} className="mt-6">
                  <div className="clay flex items-center gap-4 p-5">
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-emerald-600/12">
                      <CheckCircle2 className="size-5 text-emerald-700" />
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold">
                        Proof received for {o.serviceName} · {o.tierName}
                      </p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        We're checking it now — you'll get a WhatsApp update shortly.
                      </p>
                    </div>
                  </div>
                </section>
              );
            }
            return (
              <section key={o._id} className="mt-6">
                {open ? (
                <ProofRequest
                  orderId={o._id}
                  amountDue={o.totalPrice}
                  serviceLabel={`${o.serviceName} · ${o.tierName}`}
                />
              ) : (
                <button
                  onClick={() => setProofFor(o._id)}
                  className="clay clay-press flex w-full items-center gap-4 p-5 text-left"
                >
                  <span className="tint flex size-10 shrink-0 items-center justify-center rounded-xl">
                    <ReceiptIndianRupee className="size-5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold">
                      Send proof for {o.serviceName} · {o.tierName}
                    </span>
                    <span className="mt-0.5 block text-xs text-muted-foreground">
                      {inr(o.totalPrice)} due — upload your UPI screenshot so we can confirm your
                      order.
                    </span>
                  </span>
                  <ArrowUpRight className="size-4 shrink-0 text-muted-foreground" />
                </button>
              )}
            </section>
          );
        })}
    </main>
  );
}
