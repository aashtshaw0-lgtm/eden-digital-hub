import { useSettings } from "@/context/SettingsProvider";
import { OPEN_COOKIE_CONSENT_EVENT } from "@/components/eden/CookieConsent";
import { Instagram, Linkedin, Link2, Twitter } from "lucide-react";
import { Sprout } from "lucide-react";
import { Link } from "react-router";

export function SiteFooter() {
  const { socialLinks } = useSettings();

  const socials = [
    { key: "instagram", href: socialLinks.instagram, icon: Instagram, label: "Instagram" },
    { key: "twitter", href: socialLinks.twitter, icon: Twitter, label: "Twitter" },
    { key: "behance", href: socialLinks.behance, icon: Link2, label: "Behance" },
    { key: "linkedin", href: socialLinks.linkedin, icon: Linkedin, label: "LinkedIn" },
  ].filter((s) => s.href);

  return (
    <footer className="mt-20 border-t border-border/70 px-4 py-10 sm:px-6">
      <div className="mx-auto flex w-full max-w-6xl flex-col items-center justify-between gap-6 sm:flex-row">
        <div className="flex items-center gap-2">
          <span className="tint flex size-9 items-center justify-center rounded-xl">
            <Sprout className="size-5" />
          </span>
          <div>
            <p className="font-display text-base font-semibold leading-tight">Eden</p>
            <p className="text-xs text-muted-foreground">Digital design & management</p>
          </div>
        </div>

        <nav className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-sm text-muted-foreground">
          <Link to="/services" className="hover:text-foreground">Services</Link>
          <Link to="/portal" className="hover:text-foreground">Portal</Link>
          <Link to="/checkout" className="hover:text-foreground">Checkout</Link>
          <Link to="/legal?tab=privacy" className="hover:text-foreground">Privacy</Link>
          <Link to="/legal?tab=terms" className="hover:text-foreground">Terms</Link>
        </nav>

        <div className="flex items-center gap-3">
          {socials.map(({ key, href, icon: Icon, label }) => (
            <a
              key={key}
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={label}
              className="clay-sm flex size-9 items-center justify-center text-muted-foreground transition-colors hover:text-primary"
            >
              <Icon className="size-4" />
            </a>
          ))}
        </div>
      </div>
      <p className="mx-auto mt-8 w-full max-w-6xl text-center text-xs text-muted-foreground sm:text-left">
        © {new Date().getFullYear()} Eden. Crafted slowly, delivered fast.{" "}
        <Link to="/legal?tab=refunds" className="hover:text-foreground">
          Refund policy
        </Link>{" "}·{" "}
        <Link to="/legal?tab=cookies" className="hover:text-foreground">
          Cookie policy
        </Link>{" "}·{" "}
        <button
          type="button"
          onClick={() => window.dispatchEvent(new CustomEvent(OPEN_COOKIE_CONSENT_EVENT))}
          className="underline-offset-2 hover:text-foreground hover:underline"
        >
          Cookie settings
        </button>
      </p>
    </footer>
  );
}
