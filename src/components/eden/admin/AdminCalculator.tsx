import { api } from "@/convex/_generated/api";
import { inr } from "@/lib/format";
import { useQuery } from "convex/react";
import { useMemo, useState } from "react";

function firstOfMonth() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
}
function today() {
  return new Date().toISOString().slice(0, 10);
}

export function AdminCalculator() {
  const [from, setFrom] = useState(firstOfMonth());
  const [to, setTo] = useState(today());

  const range = useMemo(() => {
    const fromMs = new Date(`${from}T00:00:00`).getTime();
    const toMs = new Date(`${to}T23:59:59.999`).getTime();
    return Number.isFinite(fromMs) && Number.isFinite(toMs) && fromMs <= toMs ? { from: fromMs, to: toMs } : null;
  }, [from, to]);

  const stats = useQuery(api.orders.stats, range ?? "skip");

  const cards = [
    { label: "Total Volume", value: stats ? String(stats.volume) : "…", hint: "completed services sold" },
    { label: "Gross Revenue", value: stats ? inr(stats.revenue) : "…", hint: "sum of order totals" },
    { label: "Your Platform Cut", value: stats ? inr(stats.platformCut) : "…", hint: "20% of gross revenue" },
  ];

  return (
    <div className="space-y-5">
      <div className="clay flex flex-wrap items-end gap-4 p-5">
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium">Start date</span>
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="clay-inset rounded-xl px-3.5 py-2.5 text-sm outline-none"
          />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium">End date</span>
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="clay-inset rounded-xl px-3.5 py-2.5 text-sm outline-none"
          />
        </label>
        <p className="ml-auto text-xs text-muted-foreground">Counts completed orders in the window.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {cards.map((c) => (
          <div key={c.label} className="clay p-6 text-center">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{c.label}</p>
            <p className="font-display mt-2 text-3xl font-semibold text-primary">{c.value}</p>
            <p className="mt-1 text-xs text-muted-foreground">{c.hint}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
