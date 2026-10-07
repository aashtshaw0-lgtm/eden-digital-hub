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
  heroAccent: "with Eden",
  heroAccentWords: ["with Eden", "by hand", "for keeps", "that converts"],
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

  useEffect(() => {
    if (!primaryColor || !backgroundColor) return;
    const root = document.documentElement;
    root.style.setProperty("--primary", primaryColor);
    root.style.setProperty("--ring", primaryColor);
    root.style.setProperty("--primary-foreground", readableOn(primaryColor));
    root.style.setProperty("--background", backgroundColor);
  }, [primaryColor, backgroundColor]);

  const value: EdenSettings = settings
    ? {
        primaryColor: settings.primaryColor,
        backgroundColor: settings.backgroundColor,
        upiId: settings.upiId,
        qrImageUrl: settings.qrImageUrl ?? undefined,
        logoUrl: settings.logoUrl ?? undefined,
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