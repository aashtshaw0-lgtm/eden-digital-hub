import { Portfolio3D } from "@/components/eden/Portfolio3D";
import { Reveal } from "@/components/eden/Reveal";
import {
  AuroraBackground,
  CountUp,
  Magnetic,
  Marquee,
  ShimmerText,
  TiltCard,
} from "@/components/eden/motion";
import { serviceIcon } from "@/components/eden/serviceIcons";
import { SiteLogo } from "@/components/eden/SiteLogo";
import { api } from "@/convex/_generated/api";
import { useContent } from "@/context/ContentProvider";
import { useSettings } from "@/context/SettingsProvider";
import { inr } from "@/lib/format";
import {
  absolute,
  getOrganizationSchema,
  getWebSiteSchema,
  resolveSiteUrl,
  useSeo,
} from "@/lib/seo";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, Sparkles } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import { useQuery } from "convex/react";

const FALLBACK_ACCENTS = ["by hand", "for keeps", "that converts"];

export default function Landing() {
  const { t, brandName } = useContent();
  const { heroLead, heroMode, heroAccent, heroAccentWords, siteUrl, socialLinks } = useSettings();

  const socials = useMemo(
    () => Object.values(socialLinks).filter((link) => link?.trim()),
    [socialLinks],
  );

  useSeo({
    title: t("seo.home.title"),
    description: t("seo.home.description"),
    canonical: "/",
    ogImage: "/og-image.png",
    jsonLd: {
      "@context": "https://schema.org",
      "@graph": [
        getOrganizationSchema(brandName, { siteUrl, socials }),
        getWebSiteSchema(brandName, { siteUrl }),
        {
          "@type": "WebApplication",
          "name": `${brandName} Studio`,
          "applicationCategory": "BusinessApplication",
          "operatingSystem": "Web",
          "description": "Digital design & management studio with AI assistant and live manager chat.",
          screenshot: absolute(resolveSiteUrl(siteUrl), "/screenshot.jpg"),
        },
      ],
    },
  });

  const services = useQuery(api.catalog.listPublic);
  const work = useQuery(api.portfolio.list);

  const [accentIndex, setAccentIndex] = useState(0);
  const [broken, setBroken] = useState<Set<string>>(new Set());

  const accentWords =
    heroAccentWords.length > 0
      ? heroAccentWords
      : [`with ${brandName}`, ...FALLBACK_ACCENTS];

  useEffect(() => {
    if (heroMode !== "rotating" || accentWords.length < 2) return;
    const id = setInterval(() => {
      setAccentIndex((i) => (i + 1) % accentWords.length);
    }, 2600);
    return () => clearInterval(id);
  }, [heroMode, accentWords.length]);

  const showcaseServices = useMemo(() => (services ?? []).slice(0, 4), [services]);

  const chips = [
    t("home.chip.1"),
    t("home.chip.2"),
    t("home.chip.3"),
    t("home.chip.4"),
    t("home.chip.5"),
  ];

  return (
    <main className="relative min-h-dvh overflow-hidden">
      <AuroraBackground />

      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.04 }}
        className="relative z-10 flex justify-center px-4 pt-28 sm:pt-36"
      >
        <SiteLogo variant="light" size="lg" className="w-56 sm:w-72" />
      </motion.div>

      <section className="relative z-10 mx-auto flex w-full max-w-6xl flex-col items-center px-4 pb-16 pt-10 text-center sm:px-6 sm:pt-12">
        <motion.span
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="clay-sm inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-medium text-muted-foreground"
        >
          <Sparkles className="size-3.5 text-primary" />
          {t("brand.heroBadge")}
        </motion.span>

        <motion.h1
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.08 }}
          className="font-display mt-6 max-w-3xl text-balance text-4xl font-semibold leading-[1.08] tracking-tight sm:text-6xl"
        >
          {heroLead}{" "}
          <span className="relative inline-block">
            {heroMode === "rotating" ? (
              <AnimatePresence mode="wait" initial={false}>
                <motion.span
                  key={accentIndex}
                  initial={{ opacity: 0, y: 14, rotateX: -10 }}
                  animate={{ opacity: 1, y: 0, rotateX: 0 }}
                  exit={{ opacity: 0, y: -14, rotateX: 10 }}
                  transition={{ duration: 0.4, ease: "easeOut" }}
                  className="inline-block italic"
                >
                  <ShimmerText>{accentWords[accentIndex]}</ShimmerText>
                </motion.span>
              </AnimatePresence>
            ) : (
              <span className="inline-block italic">
                <ShimmerText>{heroAccent}</ShimmerText>
              </span>
            )}
          </span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.16 }}
          className="mt-5 max-w-xl text-balance text-base leading-relaxed text-muted-foreground sm:text-lg"
        >
          {t("home.heroSubtitle")}
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.24 }}
          className="mt-8 flex flex-wrap items-center justify-center gap-3"
        >
          <Magnetic>
            <Link
              to="/services"
              className="rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground shadow-md transition hover:brightness-110 hover:shadow-lg hover:shadow-primary/20"
            >
              {t("home.hero.ctaServices")}
            </Link>
          </Magnetic>
          <a
            href="#portfolio"
            className="clay-sm rounded-full px-6 py-3 text-sm font-semibold transition hover:text-primary hover:shadow-md"
          >
            {t("home.hero.ctaWork")}
          </a>
          <Link
            to="/products"
            className="clay-sm rounded-full px-6 py-3 text-sm font-semibold transition hover:text-primary hover:shadow-md"
          >
            {t("home.hero.ctaProducts")}
          </Link>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="mt-10 flex flex-wrap justify-center gap-2.5"
        >
          {chips.map((chip) => (
            <motion.span
              key={chip}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.55 }}
              className="clay-sm rounded-full px-3.5 py-1.5 text-xs text-muted-foreground"
            >
              {chip}
            </motion.span>
          ))}
        </motion.div>

        <div className="mt-12 grid w-full max-w-xl grid-cols-3 gap-3">
          {[
            { key: "home.stat.1", value: services?.length ?? 0 },
            { key: "home.stat.2", value: work?.length ?? 0 },
            { key: "home.stat.3", value: 3 },
          ].map((stat, i) => (
            <motion.div
              key={stat.key}
              initial={{ opacity: 0, y: 16, rotateX: 12 }}
              animate={{ opacity: 1, y: 0, rotateX: 0 }}
              transition={{ delay: 0.6 + i * 0.08, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
              className="clay-sm rounded-2xl px-3 py-4 text-center"
              style={{ transformPerspective: 700 }}
            >
              <p className="font-display text-2xl font-semibold tabular-nums text-primary sm:text-3xl">
                <CountUp to={stat.value} />
              </p>
              <p className="mt-1 text-[11px] leading-snug text-muted-foreground">{t(stat.key)}</p>
            </motion.div>
          ))}
        </div>
      </section>

      <section className="relative z-10 border-y border-border/50 bg-card/30 py-5">
        <Marquee seconds={46}>
          {(services ?? []).map((service) => (
            <span key={service._id} className="flex items-center gap-3">
              <span className="font-display text-sm font-semibold">{service.name}</span>
              <span className="text-xs text-muted-foreground">
                {t("services.from")} {inr(Math.min(...service.tiers.map((tier) => tier.basePrice)))}
              </span>
              <span aria-hidden className="text-primary/40">
                ✦
              </span>
            </span>
          ))}
        </Marquee>
      </section>

      <section id="portfolio" className="relative z-10 mx-auto w-full max-w-6xl px-4 pb-8 sm:px-6">
        <div className="mb-8 flex items-end justify-between gap-4">
          <Reveal>
            <h2 className="font-display text-2xl font-semibold sm:text-3xl">{t("home.work.title")}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{t("home.work.subtitle")}</p>
          </Reveal>
        </div>

        <div className="columns-1 gap-4 sm:columns-2 lg:columns-3 [&>*]:mb-4">
          {(work ?? []).map((item, i) => (
            <div key={item._id} className="mb-4 break-inside-avoid">
              <Portfolio3D
                url={broken.has(item._id) ? undefined : item.url}
                title={item.title}
                onBroken={() => setBroken((prev) => new Set(prev).add(item._id))}
                index={i}
              />
            </div>
          ))}
        </div>
      </section>

      <section className="relative z-10 mx-auto w-full max-w-6xl px-4 py-16 sm:px-6">
        <div className="mb-8 text-center">
          <Reveal>
            <h2 className="font-display text-2xl font-semibold sm:text-3xl">
              {t("home.services.title")}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">{t("home.services.subtitle")}</p>
          </Reveal>
        </div>

        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {showcaseServices.map((service, i) => {
            const Icon = serviceIcon(service.slug);
            const from = Math.min(...service.tiers.map((tier) => tier.basePrice));
            return (
              <motion.div
                key={service._id}
                initial={{ opacity: 0, y: 24, rotateX: 8 }}
                whileInView={{ opacity: 1, y: 0, rotateX: 0 }}
                viewport={{ once: true, margin: "-50px" }}
                transition={{ delay: i * 0.06, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
                style={{ perspective: "800px" }}
              >
                <TiltCard className="h-full rounded-[1.35rem]" intensity={7}>
                  <Link
                    to="/services"
                    className="clay clay-press block h-full p-5 transition-shadow hover:shadow-xl"
                  >
                    <span className="tint flex size-11 items-center justify-center rounded-2xl shadow-inner">
                      <Icon className="size-5" />
                    </span>
                    <h3 className="mt-4 font-semibold">{service.name}</h3>
                    <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                      {service.tagline}
                    </p>
                    <p className="mt-3 text-sm font-semibold text-primary">
                      {t("services.from")} {inr(from)}
                    </p>
                  </Link>
                </TiltCard>
              </motion.div>
            );
          })}
        </div>

        <div className="mt-8 text-center">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <Link
              to="/services"
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline"
            >
              {t("home.services.cta")} <ArrowRight className="size-4" />
            </Link>
          </motion.div>
        </div>
      </section>
    </main>
  );
}
