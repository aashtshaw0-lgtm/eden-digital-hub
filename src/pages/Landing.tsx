import { api } from "@/convex/_generated/api";
import { inr } from "@/lib/format";
import { useSeo, getOrganizationSchema, getWebSiteSchema } from "@/lib/seo";
import { useSettings } from "@/context/SettingsProvider";
import { serviceIcon } from "@/components/eden/serviceIcons";
import { Portfolio3D } from "@/components/eden/Portfolio3D";
import { ColorCombos } from "@/components/eden/ColorCombos";
import { EdenWordmark } from "@/components/eden/EdenWordmark";
import { Reveal } from "@/components/eden/Reveal";
import { FloatingOrb } from "@/components/eden/FloatingOrb";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, Sparkles } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "convex/react";
import { Link } from "react-router";

const ROTATING_FALLBACK = ["with Eden", "by hand", "for keeps", "that converts"];

export default function Landing() {
  useSeo({
    title: "Eden — Digital Design & Management Studio",
    description:
      "Logos, posters, commercial designs, thumbnails and event banners — plus event planning and social media management. Handcrafted work, three transparent tiers, checkout in minutes.",
    canonical: "/",
    ogImage: "https://eden.design/og-image.jpg",
    jsonLd: {
      "@context": "https://schema.org",
      "@graph": [
        getOrganizationSchema(),
        getWebSiteSchema(),
        {
          "@type": "WebApplication",
          "name": "Eden Studio",
          "applicationCategory": "BusinessApplication",
          "operatingSystem": "Web",
          "description": "Digital design & management studio with AI assistant and live manager chat.",
          "url": "https://eden.design",
          "screenshot": "https://eden.design/screenshot.jpg"
        }
      ]
    },
  });

  const services = useQuery(api.catalog.listPublic);
  const portfolio = useQuery(api.portfolio.list);
  const { heroLead, heroMode, heroAccent, heroAccentWords } = useSettings();
  const [wordIndex, setWordIndex] = useState(0);
  const [broken, setBroken] = useState<Set<string>>(new Set());

  const words = heroAccentWords.length > 0 ? heroAccentWords : ROTATING_FALLBACK;

  useEffect(() => {
    if (heroMode !== "rotating" || words.length < 2) return;
    const t = setInterval(() => setWordIndex((i) => (i + 1) % words.length), 2600);
    return () => clearInterval(t);
  }, [heroMode, words.length]);

  const featured = useMemo(() => (services ?? []).slice(0, 4), [services]);

  return (
    <main className="relative min-h-dvh overflow-hidden">
      {/* Ambient 3D orbs in background */}
      <FloatingOrb size={400} speed={20} opacity={0.15} />
      <FloatingOrb size={300} speed={25} opacity={0.12} className="right-0 top-20" />
      <FloatingOrb size={250} speed={18} opacity={0.1} className="left-10 bottom-20" />

      {/* ── Wordmark ────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.04 }}
        className="relative z-10 flex justify-center px-4 pt-28 sm:pt-36"
      >
        <EdenWordmark className="w-56 sm:w-72" />
      </motion.div>

      {/* ── Hero ─────────────────────────────────────────── */}
      <section className="relative z-10 mx-auto flex w-full max-w-6xl flex-col items-center px-4 pb-16 pt-32 text-center sm:px-6 sm:pt-40">
        <motion.span
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="clay-sm inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-medium text-muted-foreground"
        >
          <Sparkles className="size-3.5 text-primary" />
          Design & management studio
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
                  key={wordIndex}
                  initial={{ opacity: 0, y: 14, rotateX: -10 }}
                  animate={{ opacity: 1, y: 0, rotateX: 0 }}
                  exit={{ opacity: 0, y: -14, rotateX: 10 }}
                  transition={{ duration: 0.4, ease: "easeOut" }}
                  className="inline-block italic text-emerald-700 dark:text-emerald-400"
                >
                  {words[wordIndex]}
                </motion.span>
              </AnimatePresence>
            ) : (
              <span className="inline-block italic text-emerald-700 dark:text-emerald-400">{heroAccent}</span>
            )}
          </span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.16 }}
          className="mt-5 max-w-xl text-balance text-base leading-relaxed text-muted-foreground sm:text-lg"
        >
          One studio for logos, posters, thumbnails, banners and full event or
          social execution — every piece drawn by hand, with three honest tiers
          on each service and a real person one click away.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.24 }}
          className="mt-8 flex flex-wrap items-center justify-center gap-3"
        >
          <Link
            to="/services"
            className="rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground shadow-md transition hover:brightness-110 hover:shadow-lg hover:shadow-primary/20"
          >
            Explore services
          </Link>
          <a
            href="#portfolio"
            className="clay-sm rounded-full px-6 py-3 text-sm font-semibold transition hover:text-primary hover:shadow-md"
          >
            See our work
          </a>
          <Link
            to="/products"
            className="clay-sm rounded-full px-6 py-3 text-sm font-semibold transition hover:text-primary hover:shadow-md"
          >
            See handmade pieces
          </Link>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="mt-10 flex flex-wrap justify-center gap-2.5"
        >
          {["7 services", "3 transparent tiers", "UPI checkout", "Live manager chat", "Handmade shelf"].map((chip) => (
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
      </section>

      {/* ── Portfolio masonry ────────────────────────────── */}
      <section id="portfolio" className="relative z-10 mx-auto w-full max-w-6xl px-4 pb-8 sm:px-6">
        <div className="mb-8 flex items-end justify-between gap-4">
          <Reveal>
            <h2 className="font-display text-2xl font-semibold sm:text-3xl">Selected work</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              A few pieces that left the studio recently — drawn by hand, one brief at a time.
            </p>
          </Reveal>
        </div>

        <div className="columns-1 gap-4 sm:columns-2 lg:columns-3 [&>*]:mb-4">
          {(portfolio ?? []).map((item, i) => (
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

      {/* ── Services teaser with 3D cards ───────────────── */}
      <section className="relative z-10 mx-auto w-full max-w-6xl px-4 py-16 sm:px-6">
        <div className="mb-8 text-center">
          <Reveal>
            <h2 className="font-display text-2xl font-semibold sm:text-3xl">Everything we make & manage</h2>
            <p className="mt-1 text-sm text-muted-foreground">Pick a service, pick a tier, brief us in one form.</p>
          </Reveal>
        </div>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {featured.map((s, i) => {
            const Icon = serviceIcon(s.slug);
            const from = Math.min(...s.tiers.map((t) => t.basePrice));
            return (
              <motion.div
                key={s._id}
                initial={{ opacity: 0, y: 24, rotateX: 8 }}
                whileInView={{ opacity: 1, y: 0, rotateX: 0 }}
                viewport={{ once: true, margin: "-50px" }}
                transition={{ delay: i * 0.06, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
                style={{ perspective: "800px" }}
              >
                <Link
                  to="/services"
                  className="clay clay-press block h-full p-5 transition-shadow hover:shadow-xl"
                  style={{ transformStyle: "preserve-3d" }}
                >
                  <span className="tint flex size-11 items-center justify-center rounded-2xl shadow-inner">
                    <Icon className="size-5" />
                  </span>
                  <h3 className="mt-4 font-semibold">{s.name}</h3>
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{s.tagline}</p>
                  <p className="mt-3 text-sm font-semibold text-primary">from {inr(from)}</p>
                </Link>
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
              View all services <ArrowRight className="size-4" />
            </Link>
          </motion.div>
        </div>
      </section>

      {/* ── Colour combos showcase ─────────────────────────── */}
      <ColorCombos />
    </main>
  );
}
