import { api } from "@/convex/_generated/api";
import { fillTokens, contentDefault } from "@/lib/content";
import { useQuery } from "convex/react";
import { createContext, useCallback, useContext, useMemo, type ReactNode } from "react";

/**
 * The site copy deck, live.
 *
 * Components read their wording with `t("home.work.title")`. If an admin has
 * saved an override for that key it wins; otherwise the shipped default from
 * `@/lib/content` is used — so the site is never blank, even before anyone
 * has opened the console.
 */
export interface EdenContent {
  /** Key → text for every key an admin has overridden. */
  overrides: Record<string, string>;
  /** Live wording for a key, with optional `{token}` substitution. */
  t: (key: string, tokens?: Record<string, string>) => string;
  /** True when this key has been overridden from the console. */
  isCustom: (key: string) => boolean;
  /** Company name, used for the browser tab and structured data. */
  brandName: string;
}

const FALLBACK: EdenContent = {
  overrides: {},
  t: (key, tokens) => {
    const text = contentDefault(key);
    return tokens ? fillTokens(text, tokens) : text;
  },
  isCustom: () => false,
  brandName: contentDefault("brand.name"),
};

const ContentContext = createContext<EdenContent>(FALLBACK);

export function ContentProvider({ children }: { children: ReactNode }) {
  const overrides = useQuery(api.content.list);

  const map = overrides ?? {};

  const t = useCallback(
    (key: string, tokens?: Record<string, string>) => {
      const stored = map[key];
      const text = stored && stored.trim() ? stored : contentDefault(key);
      return tokens ? fillTokens(text, tokens) : text;
    },
    [map],
  );

  const isCustom = useCallback((key: string) => Boolean(map[key]?.trim()), [map]);

  const value = useMemo<EdenContent>(
    () => ({
      overrides: map,
      t,
      isCustom,
      brandName: t("brand.name") || "The studio",
    }),
    [map, t, isCustom],
  );

  return <ContentContext.Provider value={value}>{children}</ContentContext.Provider>;
}

export function useContent() {
  return useContext(ContentContext);
}

/** Shorthand for the common case: just the wording for a key. */
export function useCopy(key: string, tokens?: Record<string, string>) {
  const { t } = useContent();
  return t(key, tokens);
}
