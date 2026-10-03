import { api } from "@/convex/_generated/api";
import { inr } from "@/lib/format";
import { useSeo } from "@/lib/seo";
import { serviceIcon } from "@/components/eden/serviceIcons";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, Sparkles } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "convex/react";
import { Link } from "react-router";

const ROTATING = ["with Eden", "by hand", "for keeps", "that converts"];

export default function Landing() {
  useSeo({
    title: "Eden — Digital Design & Management Studio",
    description:
      "Logos, posters, commercial designs, thumbnails and event banners — plus event planning and social media management. Handcrafted work, three transparent tiers, checkout in minutes.",
  });

  const services = useQuery(api.catalog.listPublic);
  const portfolio = useQuery(api.portfolio.list);
  const [wordIndex, setWordIndex] = useState(0);
  const [broken, setBroken] = useState<Set<string>>(new Set());

  useEffect(() => {
    const t = setInterval(() => setWordIndex((i) => (i + 1) % ROTATING.length), 2600);
    return () => clearInterval(t);
  }, []);

  const featured = useMemo(() => (services ?? []).slice(0, 4), [services]);

  return (
    <main className="min-h-dvh">
      {/* ── Hero ─────────────────────────────────────────── */}
      <section className="mx-auto flex w-full max-w-6xl flex-col items-center px-4 pb-16 pt-32 text-center sm:px-6 sm:pt-40">
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
          Elevate your brand{" "}
          <span className="relative inline-block text-primary">
            <AnimatePresence mode="wait" initial={false}>
              <motion.span
                key={wordIndex}
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -14 }}
                transition={{ duration: 0.35 }}
                className="inline-block italic"
              >
                {ROTATING[wordIndex]}
              </motion.span>
            </AnimatePresence>
          </span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.16 }}
          className="mt-5 max-w-xl text-balance text-base leading-relaxed text-muted-foreground sm:text-lg"
        >
          One studio for logos, posters, thumbnails, banners and full event or
          social execution — with three honest tiers on every service and a
          human (or a very good AI) one click away.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.24 }}
          className="mt-8 flex flex-wrap items-center justify-center gap-3"
        >
          <Link
            to="/services"
            className="rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground shadow-md transition hover:brightness-110"
          >
            Explore services
          </Link>
          <a
            href="#portfolio"
            className="clay-sm rounded-full px-6 py-3 text-sm font-semibold transition hover:text-primary"
          >
            See our work
          </a>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="mt-10 flex flex-wrap justify-center gap-2.5"
        >
          {["7 services", "3 transparent tiers", "UPI checkout", "Live manager chat"].map((chip) => (
            <span key={chip} className="clay-sm rounded-full px-3.5 py-1.5 text-xs text-muted-foreground">
              {chip}
            </span>
          ))}
        </motion.div>
      </section>

      {/* ── Portfolio masonry ────────────────────────────── */}
      <section id="portfolio" className="mx-auto w-full max-w-6xl px-4 pb-8 sm:px-6">
        <div className="mb-8 flex items-end justify-between gap-4">
          <div>
            <h2 className="font-display text-2xl font-semibold sm:text-3xl">Selected work</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              A few pieces that left the studio recently.
            </p>
          </div>
        </div>

        <div className="columns-1 gap-4 sm:columns-2 lg:columns-3 [&>*]:mb-4">
          {(portfolio ?? []).map((item, i) => (
            <motion.figure
              key={item._id}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-40px" }}
              transition={{ delay: (i % 3) * 0.06 }}
              className="clay group relative break-inside-avoid overflow-hidden"
            >
              {item.url && !broken.has(item._id) ? (
                <img
                  src={item.url}
                  alt={item.title}
                  loading="lazy"
                  onError={() => setBroken((prev) => new Set(prev).add(item._id))}
                  className="w-full object-cover transition duration-500 group-hover:scale-[1.03]"
                />
              ) : (
                <div className="clay-inset flex aspect-[4/3] items-center justify-center rounded-none border-0">
                  <span className="font-display text-lg text-muted-foreground">{item.title}</span>
                </div>
              )}
              <figcaption className="pointer-events-none absolute inset-x-0 bottom-0 translate-y-2 bg-gradient-to-t from-black/70 to-transparent p-4 opacity-0 transition duration-300 group-hover:translate-y-0 group-hover:opacity-100">
                <span className="text-sm font-medium text-white">{item.title}</span>
              </figcaption>
            </motion.figure>
          ))}
        </div>
      </section>

      {/* ── Services teaser ──────────────────────────────── */}
      <section className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6">
        <div className="mb-8 text-center">
          <h2 className="font-display text-2xl font-semibold sm:text-3xl">Everything we make & manage</h2>
          <p className="mt-1 text-sm text-muted-foreground">Pick a service, pick a tier, brief us in one form.</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {featured.map((s, i) => {
            const Icon = serviceIcon(s.slug);
            const from = Math.min(...s.tiers.map((t) => t.basePrice));
            return (
              <motion.div
                key={s._id}
                initial={{ opacity: 0, y: 18 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.05 }}
              >
                <Link to="/services" className="clay clay-press block h-full p-5">
                  <span className="tint flex size-11 items-center justify-center rounded-2xl">
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
          <Link
            to="/services"
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline"
          >
            View all services <ArrowRight className="size-4" />
          </Link>
        </div>
      </section>
    </main>
  );
}
