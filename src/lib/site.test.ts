import { describe, expect, it } from "vitest";
import { resolveSiteUrl } from "./seo";
import { absolute, siteOrigin } from "./site";

describe("siteOrigin", () => {
  it("promotes a bare host to https and drops trailing slashes", () => {
    expect(siteOrigin("studio.example")).toBe("https://studio.example");
    expect(siteOrigin("studio.example/")).toBe("https://studio.example");
    expect(siteOrigin("https://studio.example///")).toBe("https://studio.example");
    expect(siteOrigin("  http://localhost:5173/ ")).toBe("http://localhost:5173");
  });

  it("returns nothing rather than guessing when unset", () => {
    expect(siteOrigin(undefined)).toBe("");
    expect(siteOrigin(null)).toBe("");
    expect(siteOrigin("   ")).toBe("");
  });
});

describe("absolute", () => {
  it("joins the base to a route without doubling slashes", () => {
    expect(absolute("https://studio.example", "/services")).toBe(
      "https://studio.example/services",
    );
    expect(absolute("https://studio.example", "og-image.jpg")).toBe(
      "https://studio.example/og-image.jpg",
    );
  });

  it("leaves the path alone when there is no base", () => {
    expect(absolute("", "/services")).toBe("/services");
  });
});

describe("resolveSiteUrl", () => {
  it("prefers the configured domain", () => {
    expect(resolveSiteUrl("studio.example")).toBe("https://studio.example");
  });

  it("falls back to the origin the page is served from when unset", () => {
    // No `window` in this environment: the fallback is the empty string, which
    // callers treat as \"relative only\" rather than inventing a domain.
    expect(resolveSiteUrl(undefined)).toBe("");
    expect(resolveSiteUrl("")).toBe("");
  });
});
