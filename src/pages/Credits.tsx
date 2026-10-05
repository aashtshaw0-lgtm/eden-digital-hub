import { api } from "@/convex/_generated/api";
import { LEGENDARY_THRESHOLD, PREMIUM_THRESHOLD, tierMeta, tierMetaForTier } from "@/lib/credits";
import type { CreditTierLabel } from "@/lib/credits";
import { inr } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useSeo } from "@/lib/seo";
import { useQuery } from "convex/react";
import { motion } from "framer-motion";
import { Megaphone, Sparkles } from "lucide-react";
import { Link } from "react-router";

export default function Credits() {
  useSeo({ title: `Credits | Eden - Digital Design & Management` });
  const credits = useQuery(api.credits.listAll);

  return (
    <main className="relative mx-auto w-full max-w-5xl px-4 pb-24 pt-28 sm:px-6 sm:pt-36 overflow-hidden">
      {/* Background ornament */}
      <div className="absolute -top-40 -right-40 h-80 w-80 rounded-full bg-primary/5 blur-3xl" />
      <div className="absolute -bottom-40 -left-40 h-80 w-80 rounded-full bg-accent/5 blur-3xl" />

      <header className="relative max-w-2xl">
        <motion.p
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-xs font-semibold uppercase tracking-wider text-muted-foreground"
        >
          The people who carried us
        </motion.p>
        <motion.h1
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.08 }}
          className="font-display mt-2 text-4xl font-semibold tracking-tight sm:text-5xl"
        >
          Credits
        </motion.h1>
        <motion.p
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.16 }}
          className="mt-3 text-sm leading-relaxed text-muted-foreground"
        >
          The studio runs on the people who back it. Tips of {inr(PREMIUM_THRESHOLD)} and above
          earn a premium credit, {inr(LEGENDARY_THRESHOLD)} and above earns legendary — and the
          bigger the contribution, the higher the name sits. Names are shown as a first name and
          last initial, and the amounts stay with us. Some entries here are goodwill credits we
          owe our thanks to rather than payments.
        </motion.p>
      </header>

      {credits !== undefined && credits.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, delay: 0.1 }}
          className="relative mt-10 flex flex-wrap gap-2.5"
        >
          <span className="clay-sm rounded-full px-3.5 py-1.5 text-xs font-medium text-muted-foreground">
            {credits.length} {credits.length === 1 ? "name" : "names"}
          </span>
          {(["legendary", "premium", "standard"] as const).map((tier) => {
            const count = credits.filter((c) => c.tier === tier).length;
            if (count === 0) return null;
            const meta = tierMeta(tier === "standard" ? 0 : tier === "premium" ? PREMIUM_THRESHOLD : LEGENDARY_THRESHOLD);
            const Icon = meta.icon;
            return (
              <motion.span
                key={tier}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.25 }}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold",
                  meta.chip,
                )}
              >
                <Icon className="size-3" />
                {count} {meta.title}
              </motion.span>
            );
          })}
        </motion.div>
      )}

      {credits === undefined ? (
        <div className="relative mt-12 space-y-3">
          {[0, 1, 2, 3].map((i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.6 }}
              className="clay h-24 animate-pulse"
            />
          ))}
        </div>
      ) : credits.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative clay mt-12 flex flex-col items-center gap-3 p-12 text-center"
        >
          <span className="tint flex size-12 items-center justify-center rounded-2xl">
            <Sparkles className="size-6" />
          </span>
          <p className="text-sm text-muted-foreground">
            No credits yet — the first tip above {inr(PREMIUM_THRESHOLD)} claims the wall.
          </p>
          <Link
            to="/services"
            className="text-sm font-semibold text-primary hover:underline"
          >
            Start a brief
          </Link>
        </motion.div>
      ) : (
        <ul className="relative mt-12 space-y-4">
          {credits.map((credit, index) => {
            // Marketing credits carry no contribution, so the tier the studio chose is
            // used directly rather than derived from an amount.
            const isMarketing = credit.kind === "marketing";
            const tier = tierMetaForTier((credit.tier ?? "standard") as CreditTierLabel);
            const Icon = tier.icon;
            return (
              <motion.li
                key={credit._id}
                initial={{ opacity: 0, y: 26, filter: "blur(6px)" }}
                animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                transition={{
                  type: "spring",
                  stiffness: 120,
                  damping: 20,
                  delay: Math.min(index * 0.12, 1.2),
                }}
                className={cn(
                  "relative clay clay-press flex flex-wrap items-center gap-5 p-6 ring-1 transition-shadow hover:shadow-lg",
                  tier.ring,
                  tier.glow,
                )}
              >
                {/* Decorative glow */}
                {tier.label === "legendary" && (
                  <span className="absolute -inset-10 -z-10 rounded-full bg-amber-500/10 blur-2xl" />
                )}
                {tier.label === "premium" && (
                  <span className="absolute -inset-6 -z-10 rounded-full bg-primary/5 blur-xl" />
                )}

                <span className="font-display w-10 text-xl font-semibold tabular-nums text-muted-foreground/70">
                  {String(index + 1).padStart(2, "0")}
                </span>

                <div className="min-w-[200px] flex-1">
                  {/* the name itself slides in from a blur for a reveal */}
                  <motion.h2
                    initial={{ opacity: 0, x: -14 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{
                      type: "spring",
                      stiffness: 160,
                      damping: 22,
                      delay: Math.min(index * 0.12 + 0.08, 1.3),
                    }}
                    className="font-display text-2xl font-semibold tracking-tight sm:text-3xl"
                  >
                    {credit.name}
                  </motion.h2>
                  {credit.greatness && (
                    <motion.p
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ duration: 0.5, delay: Math.min(index * 0.12 + 0.24, 1.5) }}
                      className="mt-1 text-sm text-muted-foreground"
                    >
                      {credit.greatness}
                    </motion.p>
                  )}
                  {credit.helpText && (
                    <motion.p
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ duration: 0.5, delay: Math.min(index * 0.12 + 0.32, 1.5) }}
                      className="mt-1.5 text-xs italic text-muted-foreground/80"
                    >
                      {credit.helpText}
                    </motion.p>
                  )}
                </div>

                <div className="flex flex-col items-end gap-2">
                  <span
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold",
                      tier.chip,
                    )}
                  >
                    {isMarketing ? <Megaphone className="size-3.5" /> : <Icon className="size-3.5" />}
                    {isMarketing ? "Marketing credit" : tier.title}
                  </span>
                </div>
              </motion.li>
            );
          })}
        </ul>
      )}
    </main>
  );
}