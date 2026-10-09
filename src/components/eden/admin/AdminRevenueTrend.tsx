import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { api } from "@/convex/_generated/api";
import { buildDailySeries, compareWindows } from "@/lib/adminStats";
import { inr } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useQuery } from "convex/react";
import { TrendingDown, TrendingUp } from "lucide-react";
import { useMemo } from "react";
import { Area, AreaChart, CartesianGrid, Line, XAxis, YAxis } from "recharts";

const TREND_DAYS = 14;
const COMPARE_DAYS = 7;

// Colours resolve through the chart wrapper's own CSS variables, which are set
// from the theme's tokens — so the trend follows the studio's brand colour.
const config = {
  collected: { label: "Collected", color: "var(--primary)" },
  booked: { label: "Booked", color: "var(--muted-foreground)" },
} satisfies ChartConfig;

/**
 * Where the money has actually been going.
 *
 * Two series on purpose: **booked** is what clients agreed to pay, **collected**
 * is what receipts have actually resolved to. The gap between them is the
 * studio's real outstanding work, and hiding either one would misrepresent it.
 */
export function AdminRevenueTrend() {
  const orders = useQuery(api.orders.listAll);

  const series = useMemo(
    // One `now` for the whole pass, so every point agrees on which day is today.
    () => buildDailySeries(orders ?? [], { days: TREND_DAYS, now: Date.now() }),
    [orders],
  );
  const trend = compareWindows(series, { days: COMPARE_DAYS });

  const up = (trend.deltaPct ?? 0) >= 0;

  return (
    <section className="clay mb-6 overflow-hidden rounded-[1.35rem]">
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-border/60 px-5 py-4">
        <div>
          <h2 className="font-display text-lg font-semibold">Revenue trend</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Last {TREND_DAYS} days · collected against booked
          </p>
        </div>

        <div className="text-right">
          <p className="font-display text-2xl font-semibold tabular-nums text-primary">
            {inr(trend.recent)}
          </p>
          <div className="mt-0.5 flex items-center justify-end gap-1.5 text-xs">
            {trend.deltaPct === null ? (
              <span className="text-muted-foreground">
                no earlier week to compare
              </span>
            ) : (
              <span
                className={cn(
                  "inline-flex items-center gap-1 font-semibold",
                  up ? "text-primary" : "text-destructive",
                )}
              >
                {up ? <TrendingUp className="size-3.5" /> : <TrendingDown className="size-3.5" />}
                {up ? "+" : ""}
                {Math.round(trend.deltaPct)}%
              </span>
            )}
            <span className="text-muted-foreground">
              vs previous {COMPARE_DAYS} days · {trend.recentOrders}{" "}
              {trend.recentOrders === 1 ? "order" : "orders"}
            </span>
          </div>
        </div>
      </div>

      {orders === undefined ? (
        <div className="h-56 animate-pulse px-5 py-4">
          <div className="clay-inset h-full rounded-xl" />
        </div>
      ) : (
        <ChartContainer config={config} className="h-56 w-full aspect-auto px-2 py-4">
          <AreaChart data={series} margin={{ left: 4, right: 12, top: 8, bottom: 0 }}>
            <defs>
              <linearGradient id="trend-collected" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--color-collected)" stopOpacity={0.35} />
                <stop offset="100%" stopColor="var(--color-collected)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} strokeDasharray="3 3" />
            <XAxis
              dataKey="label"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              minTickGap={18}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              width={52}
              tickFormatter={(value: number) => (value >= 1000 ? `${Math.round(value / 1000)}k` : `${value}`)}
            />
            <ChartTooltip
              content={
                <ChartTooltipContent
                  indicator="line"
                  formatter={(value) => inr(Number(value))}
                />
              }
            />
            <Area
              type="monotone"
              dataKey="collected"
              stroke="var(--color-collected)"
              strokeWidth={2}
              fill="url(#trend-collected)"
            />
            <Line
              type="monotone"
              dataKey="booked"
              stroke="var(--color-booked)"
              strokeWidth={1.5}
              strokeDasharray="4 4"
              dot={false}
            />
          </AreaChart>
        </ChartContainer>
      )}

      <p className="border-t border-border/60 px-5 py-3 text-[11px] leading-relaxed text-muted-foreground">
        Collected counts only receipts that resolved to an amount; an unread
        screenshot is left out rather than treated as zero. Booked is what
        clients agreed to pay, whether or not the proof has arrived yet.
      </p>
    </section>
  );
}
