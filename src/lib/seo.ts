import { useContent } from "@/context/ContentProvider";
import { useSettings } from "@/context/SettingsProvider";
import { absolute, siteOrigin } from "@/lib/site";
import { useEffect } from "react";

export { absolute };

/**
 * Where every absolute URL on the site comes from.
 *
 * The studio's domain is not hardcoded anywhere: it is set in the console
 * (Website tab) and read back here. When it is **not** set we use the origin the
 * page is actually served from — which keeps previews and staging pointing at
 * themselves rather than at a domain the studio may not own.
 */
export function resolveSiteUrl(configured?: string | null): string {
  return siteOrigin(configured) || (typeof window !== "undefined" ? window.location.origin : "");
}

/** `"studio"` / `"@studio"` → `"@studio"`; nothing configured stays nothing. */
export function normalizeHandle(raw?: string | null): string | undefined {
  const trimmed = raw?.trim().replace(/^@+/, "");
  return trimmed ? `@${trimmed}` : undefined;
}

function setMeta(name: string, content: string, attr: "name" | "property" = "name") {
  let el = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${name}"]`);
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute(attr, name);
    document.head.appendChild(el);
  }
  el.setAttribute("content", content);
}

/**
 * Sets (or creates) the one element for this `rel`.
 *
 * The shipped `index.html` deliberately carries no static `<link rel="canonical">`
 * (see the comment there), so the tag is usually created right here on first
 * use. Matched on `rel`, never on `href`: looking it up by URL would miss an
 * existing canonical pointing elsewhere and leave two competing canonicals in
 * the head — with the stale one winning.
 */
function setRelLink(rel: string, href: string) {
  let el = document.head.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`);
  if (!el) {
    el = document.createElement("link");
    el.rel = rel;
    document.head.appendChild(el);
  }
  el.href = href;
}

/**
 * Lightweight per-route SEO (the SPA equivalent of Next.js `generateMetadata`).
 * Updates the document title, description, OpenGraph tags, Twitter cards,
 * canonical URL, and injects route-scoped JSON-LD that is removed on unmount.
 */
export function useSeo(opts: {
  title?: string;
  description?: string;
  ogImage?: string;
  jsonLd?: Record<string, unknown> | null;
  canonical?: string;
  noIndex?: boolean;
}) {
  const { title, description, ogImage, jsonLd, canonical, noIndex } = opts;
  // The company name is editable from the console, so the tab title follows it —
  // as does the domain, which is stored alongside the rest of the branding.
  const { brandName } = useContent();
  const { siteUrl, twitterHandle } = useSettings();
  const base = resolveSiteUrl(siteUrl);
  const handle = normalizeHandle(twitterHandle);

  useEffect(() => {
    // Canonical URL — absolute, built from the studio's configured domain.
    if (canonical) {
      setRelLink("canonical", absolute(base, canonical));
    }

    // No-index for private pages
    const robotsEl = document.head.querySelector<HTMLMetaElement>('meta[name="robots"]');
    if (robotsEl) {
      robotsEl.setAttribute("content", noIndex ? "noindex, nofollow" : "index, follow");
    } else if (noIndex) {
      setMeta("robots", "noindex, nofollow");
    }

    if (title) {
      document.title = title.includes(brandName) ? title : `${title} | ${brandName}`;
      setMeta("og:site_name", brandName, "property");
      setMeta("og:title", title, "property");
      setMeta("twitter:title", title);
      // Only claim a handle the studio actually configured.
      if (handle) setMeta("twitter:site", handle);
    }
    if (description) {
      setMeta("description", description);
      setMeta("og:description", description, "property");
      setMeta("twitter:description", description);
      setMeta("og:type", "website", "property");
      setMeta("og:url", absolute(base, canonical ?? "/"), "property");
    }
    if (ogImage) {
      // Callers pass a route like "/og-image.png"; the domain is added here.
      const image = absolute(base, ogImage);
      setMeta("og:image", image, "property");
      setMeta("twitter:image", image);
      setMeta("twitter:card", "summary_large_image");
      setMeta("og:image:alt", title ?? brandName, "property");
    } else {
      setMeta("twitter:card", "summary_large_image");
    }
  }, [title, description, ogImage, canonical, noIndex, brandName, base, handle]);

  useEffect(() => {
    if (!jsonLd) return;
    const id = "route-jsonld";
    document.getElementById(id)?.remove();
    const script = document.createElement("script");
    script.id = id;
    script.type = "application/ld+json";
    script.textContent = JSON.stringify(jsonLd);
    document.head.appendChild(script);
    return () => {
      document.getElementById(id)?.remove();
    };
  }, [jsonLd]);
}

/**
 * Basic organization-level structured data (used on homepage).
 *
 * `socials` comes from the links the studio filled in — we never invent
 * profiles for accounts that may not be theirs.
 */
export function getOrganizationSchema(
  brandName = "Studio",
  { siteUrl, socials = [] }: { siteUrl?: string; socials?: string[] } = {},
) {
  const base = resolveSiteUrl(siteUrl);
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    "name": brandName,
    ...(base ? { "url": base, "logo": absolute(base, "/logo.svg") } : {}),
    "description": "Digital design & management studio selling one-off creative products and ongoing services.",
    ...(socials.length ? { sameAs: socials } : {}),
    "contactPoint": {
      "@type": "ContactPoint",
      "contactType": "customer service",
      "availableLanguage": "English"
    }
  };
}

/**
 * WebSite-level structured data with search action (helps Google understand
 * the site's search capability).
 */
export function getWebSiteSchema(
  brandName = "Studio",
  { siteUrl }: { siteUrl?: string } = {},
) {
  const base = resolveSiteUrl(siteUrl);
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "name": brandName,
    ...(base ? { "url": base } : {}),
    "potentialAction": {
      "@type": "SearchAction",
      "target": {
        "@type": "EntryPoint",
        "urlTemplate": absolute(base, "/?q={search_term_string}")
      },
      "query-input": "required name=search_term_string"
    }
  };
}

/**
 * Service-level structured data (for the services page).
 */
export function getServiceSchema(
  serviceName: string,
  description: string,
  priceRange: string,
  brandName = "Studio",
) {
  return {
    "@context": "https://schema.org",
    "@type": "Service",
    "serviceType": serviceName,
    "description": description,
    "provider": {
      "@type": "Organization",
      "name": brandName
    },
    "offers": {
      "@type": "Offer",
      "priceCurrency": "INR",
      "priceRange": priceRange
    }
  };
}
