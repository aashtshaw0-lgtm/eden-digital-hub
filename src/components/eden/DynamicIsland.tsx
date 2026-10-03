import { useCart } from "@/context/CartProvider";
import { useAuth } from "@/hooks/use-auth";
import { api } from "@/convex/_generated/api";
import { inr } from "@/lib/format";
import { useQuery } from "convex/react";
import { AnimatePresence, motion } from "framer-motion";
import { CircleUserRound, LayoutGrid, ShieldCheck, ShoppingBag, Sprout } from "lucide-react";
import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router";
import { cn } from "@/lib/utils";

const LINKS = [
  { to: "/", label: "Home", icon: Sprout },
  { to: "/services", label: "Services", icon: LayoutGrid },
  { to: "/portal", label: "Portal", icon: CircleUserRound },
] as const;

export function DynamicIsland() {
  const location = useLocation();
  const navigate = useNavigate();
  const { items, total, lastAddedAt } = useCart();
  const { isAuthenticated } = useAuth();
  const role = useQuery(api.users.myRole, isAuthenticated ? {} : "skip");

  // Derived cart pulse — driven purely by external data (lastAddedAt), no local state.
  const isRecent = typeof lastAddedAt === "number" && Date.now() - lastAddedAt < 2400;

  const isAdmin = role === "manager" || role === "super_owner";

  return (
    <motion.nav
      layout
      transition={{ type: "spring", stiffness: 380, damping: 32 }}
      className="glass fixed left-1/2 top-3 z-50 flex -translate-x-1/2 items-center gap-0.5 rounded-full p-1.5 sm:top-5"
      aria-label="Primary"
    >
      {LINKS.map(({ to, label, icon: Icon }) => {
        const active = to === "/" ? location.pathname === "/" : location.pathname.startsWith(to);
        return (
          <Link
            key={to}
            to={to}
            className={cn(
              "relative flex items-center gap-1.5 rounded-full px-3 py-2 text-sm transition-colors sm:px-3.5",
              active ? "text-primary-foreground" : "text-foreground/70 hover:text-foreground",
            )}
          >
            {active && (
              <motion.span
                layoutId="eden-island-pill"
                className="absolute inset-0 rounded-full bg-primary"
                transition={{ type: "spring", stiffness: 400, damping: 34 }}
              />
            )}
            <Icon className="relative z-10 size-4" />
            <span className={cn("relative z-10 hidden font-medium sm:inline", active && "inline")}>
              {label}
            </span>
          </Link>
        );
      })}

      {isAdmin && (
        <Link
          to="/admin"
          className={cn(
            "relative flex items-center gap-1.5 rounded-full px-3 py-2 text-sm transition-colors sm:px-3.5",
            location.pathname.startsWith("/admin")
              ? "text-primary-foreground"
              : "text-foreground/70 hover:text-foreground",
          )}
          title="Admin console"
        >
          {location.pathname.startsWith("/admin") && (
            <motion.span
              layoutId="eden-island-pill"
              className="absolute inset-0 rounded-full bg-primary"
              transition={{ type: "spring", stiffness: 400, damping: 34 }}
            />
          )}
          <ShieldCheck className="relative z-10 size-4" />
          <span className="relative z-10 hidden font-medium md:inline">Admin</span>
        </Link>
      )}

      <AnimatePresence>
        {items.length > 0 && (
          <motion.button
            key="cart"
            initial={{ width: 0, opacity: 0, marginLeft: 0 }}
            animate={{ width: "auto", opacity: 1, marginLeft: 6 }}
            exit={{ width: 0, opacity: 0, marginLeft: 0 }}
            transition={{ type: "spring", stiffness: 380, damping: 32 }}
            onClick={() => navigate("/checkout")}
            className="relative z-10 flex items-center gap-1.5 overflow-hidden rounded-full bg-primary px-3 py-2 text-sm font-medium text-primary-foreground"
            title="Go to checkout"
          >
            <span
              className={cn(
                "size-2 rounded-full transition-colors",
                isRecent
                  ? "bg-emerald-300 shadow-[0_0_8px_2px_rgba(110,231,183,0.8)]"
                  : "bg-primary-foreground/60",
              )}
            />
            <span className="whitespace-nowrap tabular-nums">{inr(total)}</span>
          </motion.button>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isRecent && (
          <motion.span
            key="cart-added"
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -8 }}
            className="pointer-events-none absolute -bottom-8 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-emerald-600 px-3 py-1 text-xs font-medium text-white shadow-lg"            >
            <ShoppingBag className="mr-1 inline size-3" /> Added to cart
          </motion.span>
        )}
      </AnimatePresence>
    </motion.nav>
  );
}
