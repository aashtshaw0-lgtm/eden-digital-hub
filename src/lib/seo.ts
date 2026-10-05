import { useEffect } from "react";

const SITE_URL = "https://eden.design";

function setMeta(name: string, content: string, attr: "name" | "property" = "name") {
  let el = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${name}"]`);
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute(attr, name);
    document.head.appendChild(el);
  }
  el.setAttribute("content", content);
}

function setLink(rel: string, href: string, attr?: string) {
  const selector = attr ? `link[${attr}="${href}"]` : `link[href="${href}"]`;
  let el = document.head.querySelector<HTMLLinkElement>(selector);
  if (!el) {
    el = document.createElement("link");
    el.rel = rel;
    if (attr) el.setAttribute(attr, href);
    el.href = href;
    document.head.appendChild(el);
  }
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

  useEffect(() => {
    // Canonical URL
    if (canonical) {
      setLink("canonical", `${SITE_URL}${canonical}`);
    }

    // No-index for private pages
    const robotsEl = document.head.querySelector<HTMLMetaElement>('meta[name="robots"]');
    if (robotsEl) {
      robotsEl.setAttribute("content", noIndex ? "noindex, nofollow" : "index, follow");
    } else if (noIndex) {
      setMeta("robots", "noindex, nofollow");
    }

    if (title) {
      document.title = `${title} | Eden`;
      setMeta("og:title", title, "property");
      setMeta("twitter:title", title);
      setMeta("twitter:site", "@eden_design");
    }
    if (description) {
      setMeta("description", description);
      setMeta("og:description", description, "property");
      setMeta("twitter:description", description);
      setMeta("og:type", "website", "property");
      setMeta("og:url", canonical ? `${SITE_URL}${canonical}` : SITE_URL, "property");
    }
    if (ogImage) {
      setMeta("og:image", ogImage, "property");
      setMeta("twitter:image", ogImage);
      setMeta("twitter:card", "summary_large_image");
      setMeta("og:image:alt", title ?? "Eden - Digital Design & Management", "property");
    } else {
      setMeta("twitter:card", "summary_large_image");
    }
  }, [title, description, ogImage, canonical, noIndex]);

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
 */
export function getOrganizationSchema() {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    "name": "Eden",
    "url": SITE_URL,
    "logo": `${SITE_URL}/logo.svg`,
    "description": "Digital design & management studio selling one-off creative products and ongoing services.",
    "sameAs": [
      "https://instagram.com/eden_design",
      "https://twitter.com/eden_design",
      "https://behance.net/eden_design",
      "https://linkedin.com/company/eden-design"
    ],
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
export function getWebSiteSchema() {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "name": "Eden",
    "url": SITE_URL,
    "potentialAction": {
      "@type": "SearchAction",
      "target": {
        "@type": "EntryPoint",
        "urlTemplate": `${SITE_URL}/?q={search_term_string}`
      },
      "query-input": "required name=search_term_string"
    }
  };
}

/**
 * Service-level structured data (for the services page).
 */
export function getServiceSchema(serviceName: string, description: string, priceRange: string) {
  return {
    "@context": "https://schema.org",
    "@type": "Service",
    "serviceType": serviceName,
    "description": description,
    "provider": {
      "@type": "Organization",
      "name": "Eden"
    },
    "offers": {
      "@type": "Offer",
      "priceCurrency": "INR",
      "priceRange": priceRange
    }
  };
}
