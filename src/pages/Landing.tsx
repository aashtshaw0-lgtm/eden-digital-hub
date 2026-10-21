import {
  absolute,
  getOrganizationSchema,
  getWebSiteSchema,
  resolveSiteUrl,
  useSeo,
} from "@/lib/seo";
import { useContent } from "@/context/ContentProvider";
import { motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { Link } from "react-router";
import { Sparkles, Leaf, Grid3X3, User } from "lucide-react";
import "@/index.css";


export default function Landing() {
  const { t, brandName } = useContent();

  useSeo({
    title: t("seo.home.title"),
    description: t("seo.home.description"),
    canonical: "/",
    ogImage: "/og-image.png",
    jsonLd: {
      "@context": "https://schema.org",
      "@graph": [
        getOrganizationSchema(brandName, { siteUrl: undefined }),
        getWebSiteSchema(brandName, { siteUrl: undefined }),
        {
          "@type": "WebApplication",
          "name": `${brandName} Studio`,
          "applicationCategory": "BusinessApplication",
          "operatingSystem": "Web",
          "description": "Digital design & management studio with AI assistant and live manager chat.",
          "screenshot": absolute(resolveSiteUrl(undefined), "/screenshot.jpg")
        }
      ]
    },
  });

  const mounted = useRef(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      const t = setTimeout(() => setVisible(true), 80);
      return () => clearTimeout(t);
    }
    return undefined;
  }, []);

  return (
    <main className="relative flex min-h-dvh flex-col items-center justify-center bg-background px-4 py-12 text-center sm:px-6">
      {/* Nav pill: leaf / grid / profile */}
      <nav
        className="mb-12 flex w-fit items-center justify-center gap-2 rounded-full border border-border/40 bg-transparent/80 px-2 py-1.5 backdrop-blur-sm"
        aria-label="Primary navigation"
      >
        <button
          type="button"
          className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-primary-foreground transition-ring hover:scale-105"
          aria-label="Studio"
        >
          <Leaf className="size-4" />
        </button>
        <button
          type="button"
          className="flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground transition-ring hover:text-foreground"
          aria-label="Sections"
        >
          <Grid3X3 className="size-4" />
        </button>
        <button
          type="button"
          className="flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground transition-ring hover:text-foreground"
          aria-label="Account"
          onClick={() => (window.location.href = "/auth")}
        >
          <User className="size-4" />
        </button>
      </nav>

      {/* Brand name */}
      <motion.h1
        initial={{ opacity: 0, y: 12, filter: "blur(4px)" }}
        animate={visible ? { opacity: 1, y: 0, filter: "blur(0)" } : {}}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="font-display text-4xl font-semibold tracking-tight sm:text-5xl md:text-6xl"
      >
        {brandName}
      </motion.h1>

      {/* Tagline pill */}
      <motion.div
        initial={{ opacity: 0, y: 10, filter: "blur(4px)" }}
        animate={visible ? { opacity: 1, y: 0, filter: "blur(0)" } : {}}
        transition={{ duration: 0.5, delay: 0.1, ease: "easeOut" }}
        className="mt-3 flex w-fit items-center gap-1.5 rounded-full border border-border/60 bg-background/70 px-3.5 py-1.5 backdrop-blur-sm"
      >
        <Sparkles className="size-3.5 text-primary" />
        <span className="text-sm font-medium text-muted-foreground">
          {t("brand.tagline")}
        </span>
      </motion.div>

      {/* Hero headline */}
      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={visible ? { opacity: 1, y: 0 } : {}}
        transition={{ duration: 0.5, delay: 0.18, ease: "easeOut" }}
        className="mt-8 max-w-lg"
      >          <h2 className="font-display text-3xl font-semibold leading-tight text-foreground sm:text-4xl">
          Elevate your
          <br />
          <span className="eden-gradient-word">
            with Eden
          </span>
        </h2>

      </motion.div>

      {/* CTA row */}
      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={visible ? { opacity: 1, y: 0 } : {}}
        transition={{ duration: 0.5, delay: 0.26, ease: "easeOut" }}
        className="mt-8 flex flex-wrap items-center justify-center gap-3"
      >
        <Link
          to="/services"
          className="inline-flex h-10 w-full max-w-[200px] items-center justify-center rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground shadow transition hover:brightness-110 hover:shadow-lg hover:shadow-primary/20"
        >
          {t("home.hero.ctaServices")}
        </Link>
        <Link
          to="/services"
          className="inline-flex h-10 w-full max-w-[200px] items-center justify-center rounded-full border border-border/60 bg-transparent px-5 text-sm font-semibold text-foreground transition hover:bg-muted"
        >
          {t("home.hero.ctaWork")}
        </Link>
      </motion.div>

      {/* Secondary CTA */}
      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={visible ? { opacity: 1, y: 0 } : {}}
        transition={{ duration: 0.5, delay: 0.34, ease: "easeOut" }}
        className="mt-3"
      >
        <Link
          to="/products"
          className="inline-flex h-9 w-full max-w-[220px] items-center justify-center rounded-full border border-border/60 px-5 text-sm font-semibold text-foreground transition hover:bg-muted"
        >
          {t("home.hero.ctaProducts")}
        </Link>
      </motion.div>

      {/* Bottom chip row */}
      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={visible ? { opacity: 1, y: 0 } : {}}
        transition={{ duration: 0.5, delay: 0.42, ease: "easeOut" }}
        className="mt-12 flex w-full max-w-sm flex-wrap items-center justify-center gap-x-3 gap-y-2 rounded-2xl border border-border/40 bg-background/40 px-4 py-3 backdrop-blur-sm"
      >
        {[t("home.chip.1"), t("home.chip.2")].map((chip) => (
          <span
            key={chip}
            className="rounded-full bg-muted/60 px-3 py-1 text-xs font-medium text-muted-foreground"
          >
            {chip}
          </span>
        ))}
        <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
          {t("home.chip.3")}
        </span>
        <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
          {t("home.chip.4")}
        </span>
        <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
          {t("home.chip.5")}
        </span>
      </motion.div>
    </main>
  );
}
