import { useContent } from "@/context/ContentProvider";
import { motion } from "framer-motion";
import { Compass, Home, LayoutGrid } from "lucide-react";
import { Link } from "react-router";
import { useSeo } from "@/lib/seo";

export default function NotFound() {
  const { t } = useContent();
  useSeo({ title: "Page not found" });

  return (
    <motion.main
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="flex min-h-dvh flex-col items-center justify-center px-4 pb-24 pt-28 text-center"
    >
      <span className="tint flex size-14 items-center justify-center rounded-2xl">
        <Compass className="size-7 text-primary" />
      </span>
      <p className="font-display mt-6 text-7xl font-semibold tracking-tight text-primary sm:text-8xl">
        404
      </p>
      <h1 className="font-display mt-2 text-2xl font-semibold sm:text-3xl">
        {t("notFound.title")}
      </h1>
      <p className="mt-3 max-w-md text-sm leading-relaxed text-muted-foreground">
        {t("notFound.body")}
      </p>
      <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
        <Link
          to="/"
          className="clay-sm inline-flex items-center gap-1.5 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm transition-opacity hover:opacity-90"
        >
          <Home className="size-4" /> {t("notFound.home")}
        </Link>
        <Link
          to="/services"
          className="clay-sm inline-flex items-center gap-1.5 rounded-full px-5 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          <LayoutGrid className="size-4" /> {t("notFound.services")}
        </Link>
      </div>
    </motion.main>
  );
}
