import { useAuth } from "@/hooks/use-auth";
import { api } from "@/convex/_generated/api";
import { formatDate, inr } from "@/lib/format";
import { useSeo } from "@/lib/seo";
import { cn } from "@/lib/utils";
import { useMutation, useQuery } from "convex/react";
import { ArrowUpRight, LogOut, PackageOpen, ShieldCheck } from "lucide-react";
import { useEffect } from "react";
import { Link, useNavigate } from "react-router";

const STATUS_STYLES: Record<string, string> = {
  pending: "bg-secondary text-secondary-foreground", // gray
  approved: "bg-sky-600/15 text-sky-700", // blue
  completed: "bg-emerald-600/15 text-emerald-700", // green
};

export default function Portal() {
  useSeo({ title: `Your Portal | Eden - Digital Design & Management` });
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const orders = useQuery(api.orders.listMine);
  const syncRole = useMutation(api.users.syncUserRole);
  const role = useQuery(api.users.myRole);

  useEffect(() => {
    void syncRole();
  }, [syncRole]);

  return (
    <main className="mx-auto w-full max-w-5xl px-4 pb-24 pt-28 sm:px-6 sm:pt-36">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm text-muted-foreground">Welcome back</p>
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
              <ShieldCheck className="size-4" /> Admin console
            </Link>
          )}
          <button
            onClick={async () => {
              await signOut();
              navigate("/");
            }}
            className="clay-sm inline-flex items-center gap-1.5 rounded-full px-4 py-2.5 text-sm font-medium text-muted-foreground hover:text-foreground"
          >
            <LogOut className="size-4" /> Sign out
          </button>
        </div>
      </header>

      <section className="mt-10">
        <h2 className="font-display text-xl font-semibold">Order history</h2>
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
              No orders yet — your briefs will live here once you check out.
            </p>
            <Link
              to="/services"
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline"
            >
              Start a first brief <ArrowUpRight className="size-4" />
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
    </main>
  );
}
