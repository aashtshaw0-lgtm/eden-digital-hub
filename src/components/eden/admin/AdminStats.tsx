import { CountUp } from "@/components/eden/motion";
import { api } from "@/convex/_generated/api";
import { cn } from "@/lib/utils";
import { useQuery } from "convex/react";
import { motion, useReducedMotion } from "framer-motion";
import { Hourglass, IndianRupee, PackageCheck, Users, type LucideIcon } from "lucide-react";

/**
 * The numbers a manager wants the moment the console opens.
 *
 * Every figure is derived from the same queries the boards themselves read
 * (`orders.listAll`, `users.listAll`) rather than a separate counter table, so a
 * stat can never drift from the list underneath it — and because Convex quotes
 * an identical subscription once, the strip adds no extra round-trips.
 */
export function AdminStats({ onJump }: { onJump?: (tab: string) => void }) {
  const orders = useQuery(api.orders.listAll);
  const clients = useQuery(api.users.listAll);
  const reduced = useReducedMotion();

  const rows = orders ?? [];
  const pending = rows.filter((o) => (o.status ?? "pending") === "pending").length;
  // Only amounts that actually resolved count as collected — an unread proof
  // reports null, and silently treating that as zero rupees would understate it.
  const collected = rows.reduce(
    (sum, o) => sum + (typeof o.paidAmount === "number" ? o.paidAmount : 0),
    0,
  );

  const stats: {
    key: string;
    label: string;
    hint: string;
    value: number;
    icon: LucideIcon;
    /** Tab this stat drills into, when one makes sense. */
    tab?: string;
    money?: boolean;
    /** Draws the eye when something is actually waiting on a human. */
    urgent?: boolean;
  }[] = [
    {
      key: "orders",
      label: "Orders",
      hint: "in the book",
      value: rows.length,
      icon: PackageCheck,
      tab: "orders",
    },
    {
      key: "pending",
      label: "Awaiting",
      hint: pending > 0 ? "need a decision" : "nothing waiting",
      value: pending,
      icon: Hourglass,
      tab: "orders",
      urgent: pending > 0,
    },
    {
      key: "collected",
      label: "Collected",
      hint: "read off receipts",
      value: collected,
      icon: IndianRupee,
      money: true,
    },
    {
      key: "clients",
      label: "Clients",
      hint: "signed-up accounts",
      value: clients?.length ?? 0,
      icon: Users,
      tab: "products",
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
              className={cn(
                "tint flex size-8 items-center justify-center rounded-xl",
                stat.urgent && "text-primary",
              )}
            >
              <Icon className="size-4" />
            </span>
            <p className="font-display mt-3 text-2xl font-semibold tabular-nums">
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
