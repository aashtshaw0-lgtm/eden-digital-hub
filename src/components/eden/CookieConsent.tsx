import { AnimatePresence, motion } from "framer-motion";
import { Cookie } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router";

const STORAGE_KEY = "eden.cookie-consent.v1";
export const OPEN_COOKIE_CONSENT_EVENT = "eden:open-cookie-consent";

type Consent = "all" | "necessary";

function storedChoice(): Consent | null {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    return value === "all" || value === "necessary" ? value : null;
  } catch {
    return null;
  }
}

/**
 * Minimal, honest cookie banner. Eden only uses essential storage (session,
 * cart) plus this consent preference itself — the banner says exactly that.
 * Reopens via the OPEN_COOKIE_CONSENT_EVENT dispatched by the footer's
 * "Cookie settings" link.
 */
export function CookieConsent() {
  const { pathname } = useLocation();
  const [dismissed, setDismissed] = useState(false);
  const [forcedOpen, setForcedOpen] = useState(false);

  useEffect(() => {
    // Subscription callback — setState here is the recommended pattern.
    const reopen = () => setForcedOpen(true);
    window.addEventListener(OPEN_COOKIE_CONSENT_EVENT, reopen);
    return () => window.removeEventListener(OPEN_COOKIE_CONSENT_EVENT, reopen);
  }, []);

  const consented = storedChoice();
  const visible =
    (!consented && !dismissed && pathname !== "/auth") || forcedOpen;

  const choose = (choice: Consent) => {
    try {
      localStorage.setItem(STORAGE_KEY, choice);
    } catch {
      // Private mode may block storage — hiding the banner is still fine.
    }
    setDismissed(true);
    setForcedOpen(false);
  };

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          key="cookie-consent"
          role="dialog"
          aria-label="Cookie consent"
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 24 }}
          transition={{ type: "spring", stiffness: 320, damping: 30 }}
          className="glass fixed bottom-3 left-1/2 z-[60] w-[min(94vw,560px)] -translate-x-1/2 rounded-2xl p-4 sm:bottom-5"
        >
          <div className="flex items-start gap-3">
            <span className="tint hidden size-9 shrink-0 items-center justify-center rounded-xl sm:flex">
              <Cookie className="size-4" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium leading-snug">
                Only the essential cookies here
              </p>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                We use local storage for your sign-in and cart — no ad trackers, no analytics
                pixels. Details in the{" "}
                <Link
                  to="/legal?tab=cookies"
                  onClick={() => setDismissed(true)}
                  className="font-medium text-primary hover:underline"
                >
                  Cookie Policy
                </Link>
                .
              </p>
              <div className="mt-3 flex items-center gap-2">
                <button
                  onClick={() => choose("all")}
                  className="rounded-full bg-primary px-4 py-1.5 text-xs font-semibold text-primary-foreground shadow-sm transition-opacity hover:opacity-90"
                >
                  Accept all
                </button>
                <button
                  onClick={() => choose("necessary")}
                  className="clay-sm rounded-full px-4 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
                >
                  Necessary only
                </button>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
