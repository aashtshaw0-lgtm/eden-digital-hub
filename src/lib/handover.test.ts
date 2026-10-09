import { describe, expect, it } from "vitest";
import { PUBLIC_ROUTES, buildHandoverDoc, buildRobots, buildSitemap } from "./handover";

/** No real domain from the template must survive into anything we generate. */
const TEMPLATE_DOMAIN = "eden.design";

describe("buildSitemap", () => {
  it("lists every public route under the configured origin", () => {
    const xml = buildSitemap("https://studio.example");
    for (const route of PUBLIC_ROUTES) {
      expect(xml).toContain(`<loc>https://studio.example${route.path}</loc>`);
    }
    expect(xml).toContain('xmlns:xhtml="http://www.w3.org/1999/xhtml"');
  });

  it("never names the template's domain", () => {
    expect(buildSitemap("https://studio.example")).not.toContain(TEMPLATE_DOMAIN);
  });

  it("keeps private routes out of the index", () => {
    const xml = buildSitemap("https://studio.example");
    expect(xml).not.toContain("/admin");
    expect(xml).not.toContain("/checkout");
    expect(xml).not.toContain("/portal");
  });

  it("refuses to invent a domain", () => {
    expect(buildSitemap(undefined)).toBe("");
    expect(buildSitemap("")).toBe("");
  });
});

describe("buildRobots", () => {
  it("disallows the private routes and points at an absolute sitemap", () => {
    const txt = buildRobots("https://studio.example");
    expect(txt).toContain("Disallow: /admin");
    expect(txt).toContain("Disallow: /checkout");
    expect(txt).toContain("Disallow: /portal");
    expect(txt).toContain("Sitemap: https://studio.example/sitemap.xml");
  });

  it("falls back to a relative sitemap line with no domain configured", () => {
    expect(buildRobots(undefined)).toContain("Sitemap: /sitemap.xml");
  });
});

const INPUT = {
  brandName: "Kavi Studio",
  siteUrl: "studio.example",
  generatedAt: new Date(2026, 9, 9, 10, 0, 0, 0).getTime(),
  tabs: [
    { label: "Orders", body: "Every service order." },
    { label: "Roles", body: "Grant or remove manager access." },
  ],
  orderStates: [{ state: "pending", meaning: "Waiting on a human." }],
  tables: [{ name: "orders", holds: "Service orders." }],
  steps: ["Set the studio's real name.", "Point the site at your domain."],
};

describe("buildHandoverDoc", () => {
  it("names the studio, the date and the configured domain", () => {
    const doc = buildHandoverDoc(INPUT);
    expect(doc).toContain("# Kavi Studio — handover");
    expect(doc).toContain("Generated 2026-10-09");
    expect(doc).toContain("https://studio.example");
  });

  it("carries every tab, state, table and step it was given", () => {
    const doc = buildHandoverDoc(INPUT);
    for (const tab of INPUT.tabs) expect(doc).toContain(`### ${tab.label}`);
    expect(doc).toContain("Waiting on a human.");
    expect(doc).toContain("`orders` — Service orders.");
    expect(doc).toContain("1. Set the studio's real name.");
    expect(doc).toContain("2. Point the site at your domain.");
  });

  it("embeds the matching sitemap and robots files", () => {
    const doc = buildHandoverDoc(INPUT);
    expect(doc).toContain("<loc>https://studio.example/services</loc>");
    expect(doc).toContain("Sitemap: https://studio.example/sitemap.xml");
    expect(doc).not.toContain(TEMPLATE_DOMAIN);
  });

  it("says what to do when no domain has been set yet", () => {
    const doc = buildHandoverDoc({ ...INPUT, siteUrl: "" });
    expect(doc).toContain("No domain is configured yet");
    expect(doc).not.toContain("```xml");
    expect(doc).not.toContain(TEMPLATE_DOMAIN);
  });
});
