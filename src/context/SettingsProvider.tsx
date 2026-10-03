import { api } from "@/convex/_generated/api";
import { readableOn } from "@/lib/format";
import { useQuery } from "convex/react";
import { createContext, useContext, useEffect, type ReactNode } from "react";

export interface EdenSettings {
  primaryColor: string;
  backgroundColor: string;
  upiId: string;
  qrImageUrl?: string;
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

  useEffect(() => {
    if (!settings) return;
    const root = document.documentElement;
    root.style.setProperty("--primary", settings.primaryColor);
    root.style.setProperty("--ring", settings.primaryColor);
    root.style.setProperty("--primary-foreground", readableOn(settings.primaryColor));
    root.style.setProperty("--background", settings.backgroundColor);
  }, [settings]);

  const value: EdenSettings = settings
    ? {
        primaryColor: settings.primaryColor,
        backgroundColor: settings.backgroundColor,
        upiId: settings.upiId,
        qrImageUrl: settings.qrImageUrl ?? undefined,
        socialLinks: settings.socialLinks,
      }
    : DEFAULTS;

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings() {
  return useContext(SettingsContext);
}
