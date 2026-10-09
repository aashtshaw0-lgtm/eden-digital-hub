import { CountUp } from "@/components/eden/motion";
import { api } from "@/convex/_generated/api";
import { orderTotals } from "@/lib/adminStats";
import { cn } from "@/lib/utils";
import { useQuery } from "convex/react";
import { motion, useReducedMotion } from "framer-motion";
import { Hourglass, IndianRupee, PackageCheck, Users, type LucideIcon } from "lucide-react";

/**
 * The numbers a manager wants the moment the console opens.
 *
 * Every figure comes from the same queries the boards below read
 * (`orders.listAll`, `users.listAll`) rather than its own counter table, so a
 * stat can never drift from the list underneath it — and because Convex quotes
 * an identical subscription once, the strip adds no extra round-trips.
 *
 * The accents are mixed from the theme's own `--primary`, so a studio that
 * re-colours the site from the Website tab re-colours its console too.
 */
export function AdminStats({ onJump }: { onJump?: (tab: string) => void }) {
  const orders = useQuery(api.orders.listAll);
  const clients = useQuery(api.users.listAll);
  const reduced = useReducedMotion();

  const totals = orderTotals(orders ?? []);

  /** A wash of the live brand colour; the strength separates the cards. */
  const tint = (percent: number) => ({
    background: `color-mix(in oklab, var(--primary) ${percent}%, transparent)`,
    color: "var(--primary)",
  });
  const alert = {
    background: "color-mix(in oklab, var(--destructive) 14%, transparent)",
    color: "var(--destructive)",
  };

  const stats: {
    key: string;
    label: string;
    hint: string;
    value: number;
    icon: LucideIcon;
    /** Tab this stat drills into, when one makes sense. */
    tab?: string;
    money?: boolean;
    /** Percent of the brand colour behind the icon. */
    tone: number;
    /** Draws the eye when something is actually waiting on a human. */
    urgent?: boolean;
  }[] = [
    {
      key: "orders",
      label: "Orders",
      hint: "in the book",
      value: totals.total,
      icon: PackageCheck,
      tab: "orders",
      tone: 12,
    },
    {
      key: "pending",
      label: "Awaiting",
      hint: totals.pending > 0 ? "need a decision" : "nothing waiting",
      value: totals.pending,
      icon: Hourglass,
      tab: "orders",
      tone: 22,
      urgent: totals.pending > 0,
    },
    {
      key: "collected",
      label: "Collected",
      hint: "read off receipts",
      value: totals.collected,
      icon: IndianRupee,
      money: true,
      tone: 28,
    },
    {
      key: "clients",
      label: "Clients",
      hint: "signed-up accounts",
      value: clients?.length ?? 0,
      icon: Users,
      tab: "products",
      tone: 16,
    },
  ];

  return (
    <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
      {stats.map((stat, i) => {
        const Icon = stat.icon;
        const className = cn(
          "clay-sm w-full rounded-2xl px-3.5 py-4 text-left transition",
          stat.urgent && "ring-1 ring-primary/40",
          stat.tab && "hover:-translate-y-0.5 hover:shadow-md",
        );

        const inner = (
          <>
            <span
              className="flex size-8 items-center justify-center rounded-xl"
              style={stat.urgent ? alert : tint(stat.tone)}
            >
              <Icon className="size-4" />
            </span>
            <p
              className={cn(
                "font-display mt-3 text-2xl font-semibold tabular-nums",
                stat.key === "collected" && "text-primary",
              )}
            >
              <CountUp to={stat.value} prefix={stat.money ? "₹" : ""} />
            </p>
            <p className="mt-0.5 text-xs font-medium">{stat.label}</p>
            <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">
              {stat.hint}
            </p>
          </>
        );

        // Reduced motion gets the finished state at once — no travelling
        // numbers, no cards rotating in.
        if (reduced) {
          return stat.tab ? (
            <button
              key={stat.key}
              type="button"
              onClick={() => onJump?.(stat.tab!)}
              className={className}
            >
              {inner}
            </button>
          ) : (
            <div key={stat.key} className={className}>
              {inner}
            </div>
          );
        }

        const entrance = {
          initial: { opacity: 0, y: 14, rotateX: 10 },
          animate: { opacity: 1, y: 0, rotateX: 0 },
          transition: { delay: i * 0.06, duration: 0.45, ease: [0.22, 1, 0.36, 1] as const },
        };

        return stat.tab ? (
          <motion.button
            key={stat.key}
            type="button"
            onClick={() => onJump?.(stat.tab!)}
            {...entrance}
            style={{ transformPerspective: 700 }}
            className={className}
          >
            {inner}
          </motion.button>
        ) : (
          <motion.div
            key={stat.key}
            {...entrance}
            style={{ transformPerspective: 700 }}
            className={className}
          >
            {inner}
          </motion.div>
        );
      })}
    </div>
  );
}
