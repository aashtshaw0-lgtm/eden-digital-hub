import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";
import {
  CONTENT_DEFAULTS,
  CONTENT_FIELDS,
  contentDefault,
  fillTokens,
  resolveBrandName,
} from "./content";

const SRC = join(process.cwd(), "src");

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    if (!/\.(ts|tsx)$/.test(entry) || /\.test\.(ts|tsx)$/.test(entry)) return [];
    return [path];
  });
}

/**
 * Copy keys the UI asks for by name. Dynamic keys (e.g. `t(stat.key)`) cannot
 * be read statically, so only literal calls are collected — a literal that is
 * not in the deck is either a typo or a key someone deleted from the deck
 * while a component still asks for it. Both ship as blank text on the site.
 */
function literalKeysUsed(): Map<string, string> {
  const used = new Map<string, string>();
  for (const path of sourceFiles(SRC)) {
    const source = readFileSync(path, "utf8");
    const pattern = /\b(?:t|useCopy)\(\s*"([^"]+)"/g;
    for (const match of source.matchAll(pattern)) {
      used.set(match[1], relative(SRC, path));
    }
  }
  return used;
}

describe("content deck", () => {
  it("declares every key exactly once", () => {
    const seen = new Set<string>();
    const duplicates: string[] = [];
    for (const field of CONTENT_FIELDS) {
      if (seen.has(field.key)) duplicates.push(field.key);
      seen.add(field.key);
    }
    expect(duplicates).toEqual([]);
  });

  it("ships a non-empty default for every key the UI asks for by name", () => {
    const used = literalKeysUsed();
    // Guards against the scan silently matching nothing and passing vacuously.
    expect(used.size).toBeGreaterThan(50);
    const orphans = [...used].filter(([key]) => !(CONTENT_DEFAULTS[key] ?? "").trim());
    expect(
      orphans.map(([key, file]) => `${key} (used in ${file})`),
    ).toEqual([]);
  });

  it("returns empty text for an unknown key rather than inventing copy", () => {
    expect(contentDefault("home.section.that.was.removed")).toBe("");
  });

  it("ships no hardcoded studio name", () => {
    expect(CONTENT_DEFAULTS["brand.name"]).toBe("");
  });
});

describe("resolveBrandName", () => {
  it("uses the Brand kit word the studio chose", () => {
    expect(resolveBrandName("", "abhisto")).toBe("abhisto");
    expect(resolveBrandName(undefined, "  abhisto  ")).toBe("abhisto");
  });

  it("lets an explicit copy-deck override win over the kit word", () => {
    expect(resolveBrandName("Abhisto Studio", "abhisto")).toBe("Abhisto Studio");
    expect(resolveBrandName("  ", "abhisto")).toBe("abhisto");
  });

  it("falls back to neutral wording, never to a placeholder brand", () => {
    expect(resolveBrandName(undefined, undefined)).toBe("The studio");
    expect(resolveBrandName("", "")).toBe("The studio");
  });
});

describe("fillTokens", () => {
  it("substitutes the tokens it is given and leaves the rest alone", () => {
    expect(fillTokens("From {price} per piece", { price: "₹4,999" })).toBe(
      "From ₹4,999 per piece",
    );
    expect(fillTokens("From {price} per {unit}")).toBe("From {price} per {unit}");
    expect(fillTokens("{missing} stays", { price: "x" })).toBe("{missing} stays");
  });

  it("returns the text untouched without tokens", () => {
    expect(fillTokens("Plain {braces}")).toBe("Plain {braces}");
  });
});
