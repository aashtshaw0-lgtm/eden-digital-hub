import { useEffect } from "react";

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
 * Lightweight per-route SEO (the SPA equivalent of Next.js `generateMetadata`).
 * Updates the document title, description, OpenGraph tags and injects a
 * route-scoped JSON-LD script that is removed on unmount.
 */
export function useSeo(opts: {
  title?: string;
  description?: string;
  ogImage?: string;
  jsonLd?: Record<string, unknown> | null;
}) {
  const { title, description, ogImage, jsonLd } = opts;
  useEffect(() => {
    if (title) {
      document.title = title;
      setMeta("og:title", title, "property");
      setMeta("twitter:title", title);
    }
    if (description) {
      setMeta("description", description);
      setMeta("og:description", description, "property");
      setMeta("twitter:description", description);
    }
    if (ogImage) {
      setMeta("og:image", ogImage, "property");
      setMeta("twitter:image", ogImage);
    }
  }, [title, description, ogImage]);

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
  }, [JSON.stringify(jsonLd)]);
}
