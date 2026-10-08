import { api } from "@/convex/_generated/api";
import { readableOn } from "@/lib/format";
import { useQuery } from "convex/react";
import { createContext, useContext, useEffect, type ReactNode } from "react";

export interface EdenSettings {
  primaryColor: string;
  backgroundColor: string;
  upiId: string;
  qrImageUrl?: string;
  logoUrl?: string;
  logoDarkUrl?: string;
  /** "image" or "text" when the studio has chosen; unset means image wins. */
  logoMode?: "image" | "text";
  brandWord?: string;
  brandTagline?: string;
  logoLightColor?: string;
  logoDarkColor?: string;
  heroLead: string;
  heroMode: "rotating" | "static";
  heroAccent: string;
  heroAccentWords: string[];
  socialLinks: {
    instagram: string;
    twitter: string;
    behance: string;
    linkedin: string;
  };
}

const DEFAULTS: EdenSettings = {
  primaryColor: "#2f6b4f",
  backgroundColor: "#f6f2ea",
  upiId: "eden.payments@upi",
  heroLead: "Elevate your brand",
  heroMode: "rotating" as const,
  heroAccent: "by hand",
  heroAccentWords: ["by hand", "for keeps", "that converts"],
  socialLinks: { instagram: "", twitter: "", behance: "", linkedin: "" },
};

const SettingsContext = createContext<EdenSettings>(DEFAULTS);

/**
 * Global web customizer: streams the CMS settings row and applies the chosen
 * brand colors as CSS variables (--primary / --background) so the whole site
 * re-themes live, exactly like the admin panel intends.
 */
export function SettingsProvider({ children }: { children: ReactNode }) {
  const settings = useQuery(api.settings.get);

  const primaryColor = settings?.primaryColor;
  const backgroundColor = settings?.backgroundColor;
  const logoUrl = settings?.logoUrl;

  useEffect(() => {
    if (!primaryColor || !backgroundColor) return;
    const root = document.documentElement;
    root.style.setProperty("--primary", primaryColor);
    root.style.setProperty("--ring", primaryColor);
    root.style.setProperty("--primary-foreground", readableOn(primaryColor));
    root.style.setProperty("--background", backgroundColor);
  }, [primaryColor, backgroundColor]);

  // The browser-tab icon follows the uploaded logo, so the mark in the tab is
  // the studio's own — the shipped icon is only a placeholder.
  useEffect(() => {
    if (!logoUrl) return;
    let link = document.head.querySelector<HTMLLinkElement>('link[rel="icon"]');
    if (!link) {
      link = document.createElement("link");
      link.rel = "icon";
      document.head.appendChild(link);
    }
    link.href = logoUrl;
  }, [logoUrl]);

  const value: EdenSettings = settings
    ? {
        primaryColor: settings.primaryColor,
        backgroundColor: settings.backgroundColor,
        upiId: settings.upiId,
        qrImageUrl: settings.qrImageUrl ?? undefined,
        logoUrl: settings.logoUrl ?? undefined,
        logoDarkUrl: settings.logoDarkUrl ?? undefined,
        logoMode: settings.logoMode ?? undefined,
        brandWord: settings.brandWord ?? undefined,
        brandTagline: settings.brandTagline ?? undefined,
        logoLightColor: settings.logoLightColor ?? undefined,
        logoDarkColor: settings.logoDarkColor ?? undefined,
        heroLead: settings.heroLead,
        heroMode: settings.heroMode,
        heroAccent: settings.heroAccent,
        heroAccentWords: settings.heroAccentWords,
        socialLinks: settings.socialLinks,
      }
    : DEFAULTS;

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings() {
  return useContext(SettingsContext);
}