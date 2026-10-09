import { ServiceSheet } from "@/components/eden/ServiceSheet";
import { AuroraBackground, TiltCard } from "@/components/eden/motion";
import { api } from "@/convex/_generated/api";
import { useContent } from "@/context/ContentProvider";
import { inr } from "@/lib/format";
import { useSeo } from "@/lib/seo";
import { serviceIcon } from "@/components/eden/serviceIcons";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import { useMemo, useState } from "react";
import { useQuery } from "convex/react";
import type { Doc } from "@/convex/_generated/dataModel";

type Service = Doc<"services"> & { tiers: Doc<"serviceTiers">[] };

const CATEGORIES = [
  { key: "all", labelKey: "services.cat.all" },
  { key: "design", labelKey: "services.cat.design" },
  { key: "events", labelKey: "services.cat.events" },
  { key: "management", labelKey: "services.cat.management" },
] as const;

export default function Services() {
  const { t, brandName } = useContent();
  const services = useQuery(api.catalog.listPublic);
  const [category, setCategory] = useState<(typeof CATEGORIES)[number]["key"]>("all");
  const [active, setActive] = useState<Service | null>(null);

  const filtered = useMemo(
    () => (services ?? []).filter((s) => category === "all" || s.category === category),
    [services, category],
  );

  useSeo({
    title: t("seo.services.title"),
    description: t("seo.services.description"),
    canonical: "/services",
    jsonLd:
      services === undefined
        ? null
        : {
            "@context": "https://schema.org",
            "@type": "ItemList",
            itemListElement: services.map((s, i) => ({
              "@type": "ListItem",
              position: i + 1,
              item: {
                "@type": "Service",
                name: s.name,
                description: s.tagline ?? `${s.name} by the studio`,
                provider: {
                  "@type": "Organization",
                  "name": brandName,
                  // The page's own address: JSON-LD resolves a relative IRI
                  // against the document, so no domain is hardcoded here.
                  "url": "/"
                },
                offers: {
                  "@type": "AggregateOffer",
                  priceCurrency: "INR",
                  lowPrice: Math.min(...s.tiers.map((t) => t.basePrice)),
                  highPrice: Math.max(...s.tiers.map((t) => t.basePrice)),
                  offerCount: s.tiers.length,
                },
              },
            })),
          },
  });

  return (
    <main className="relative mx-auto min-h-dvh w-full max-w-6xl px-4 pb-24 pt-28 sm:px-6 sm:pt-36">
      <AuroraBackground className="opacity-70" />
      <header className="relative mb-8">
        <h1 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">
          {t("services.title")}
        </h1>
        <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted-foreground">
          {t("services.subtitle")}
        </p>
      </header>

      <div className="mb-8 flex flex-wrap gap-2">
        {CATEGORIES.map((c) => (
          <button
            key={c.key}
            onClick={() => setCategory(c.key)}
            className={cn(
              "clay-sm rounded-full px-4 py-2 text-sm font-medium transition-colors",
              category === c.key && "bg-primary text-primary-foreground ring-2 ring-primary/50",
            )}
          >
            {t(c.labelKey)}
          </button>
        ))}
      </div>

      {services === undefined ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="clay h-48 animate-pulse opacity-60" />
          ))}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((s, i) => {
            const Icon = serviceIcon(s.slug);
            const from = Math.min(...s.tiers.map((t) => t.basePrice));
            return (
              <motion.div
                key={s._id}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
                className="relative"
              >
              <TiltCard className="h-full rounded-[1.35rem]" intensity={8}>
              <motion.button
                whileTap={{ scale: 0.98 }}
                onClick={() => setActive(s)}
                className="clay clay-press flex h-full w-full flex-col items-start p-6 text-left"
              >
                <span className="tint flex size-12 items-center justify-center rounded-2xl">
                  <Icon className="size-6" />
                </span>
                <h2 className="mt-4 font-display text-xl font-semibold">{s.name}</h2>
                <p className="mt-1.5 flex-1 text-sm leading-relaxed text-muted-foreground">
                  {s.tagline}
                </p>
                <div className="mt-4 flex w-full items-center justify-between">
                  <span className="text-sm font-semibold text-primary">
                    {t("services.from")} {inr(from)}
                  </span>
                  <span className="rounded-full bg-secondary px-3 py-1 text-xs font-medium text-secondary-foreground">
                    {t("services.tiersBadge")}
                  </span>
                </div>
              </motion.button>
              </TiltCard>
              </motion.div>
            );
          })}
        </div>
      )}

      <ServiceSheet service={active} open={active !== null} onOpenChange={(o) => !o && setActive(null)} />
    </main>
  );
}
