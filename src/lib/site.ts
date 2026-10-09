/**
 * The studio's public address, in one place.
 *
 * Two very different callers need this: the SEO layer, which turns every route
 * into an absolute URL, and the handover export, which writes the studio's
 * domain into `sitemap.xml` / `robots.txt`. Keeping it here — pure, with no React
 * and no backend — means the two can never normalise a domain differently.
 */

/**
 * `"studio.example/"` → `"https://studio.example"`.
 *
 * A bare host is promoted to https because that is how a public site is
 * served. **An empty value stays empty** — callers fall back to the origin the
 * page is served from, which is the honest answer for a preview or a staging
 * copy, and the reason nothing in this build hardcodes a domain.
 */
export function siteOrigin(raw?: string | null): string {
  const trimmed = raw?.trim().replace(/\/+$/, "");
  if (!trimmed) return "";
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

/** Absolute URL for a route or asset path, given the site's base. */
export function absolute(base: string, path: string): string {
  if (!base) return path;
  return path.startsWith("/") ? `${base}${path}` : `${base}/${path}`;
}
