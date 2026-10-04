import { api } from "@/convex/_generated/api";
import { LEGENDARY_THRESHOLD, PREMIUM_THRESHOLD, tierMeta, tierMetaForTier } from "@/lib/credits";
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
    <main className="mx-auto w-full max-w-5xl px-4 pb-24 pt-28 sm:px-6 sm:pt-36">
      <header className="max-w-2xl">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          The people who carried us
        </p>
        <h1 className="font-display mt-2 text-4xl font-semibold tracking-tight sm:text-5xl">
          Credits
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          The studio runs on the people who back it. Tips of {inr(PREMIUM_THRESHOLD)} and above
          earn a premium credit, {inr(LEGENDARY_THRESHOLD)} and above earns legendary — and the
          bigger the contribution, the higher the name sits. Some names here are goodwill credits
          we owe our thanks to rather than payments.
        </p>
      </header>

      {credits !== undefined && credits.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, delay: 0.1 }}
          className="mt-10 flex flex-wrap gap-2.5"
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
              <span
                key={tier}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold",
                  meta.chip,
                )}
              >
                <Icon className="size-3" />
                {count} {meta.title}
              </span>
            );
          })}
        </motion.div>
      )}

      {credits === undefined ? (
        <div className="mt-12 space-y-3">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="clay h-24 animate-pulse opacity-60" />
          ))}
        </div>
      ) : credits.length === 0 ? (
        <div className="clay mt-12 flex flex-col items-center gap-3 p-12 text-center">
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
        </div>
      ) : (
        <ul className="mt-12 space-y-4">
          {credits.map((credit, index) => {
            // Marketing credits carry no contribution, so the tier the studio chose is
            // used directly rather than derived from an amount.
            const isMarketing = credit.kind === "marketing";
            const tier = tierMetaForTier(credit.tier);
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
                  "clay clay-press flex flex-wrap items-center gap-5 p-6 ring-1 transition-shadow",
                  tier.ring,
                  tier.glow,
                )}
              >
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