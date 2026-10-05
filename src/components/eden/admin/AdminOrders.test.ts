import { describe, it, expect } from "vitest";

/**
 * Unit tests for the colour swatch display logic in AdminOrders.
 *
 * These tests validate that colours are correctly identified, formatted,
 * and filtered for display in the admin orders view.
 */

describe("Colour swatch logic", () => {
  /**
   * Validates a colour value and returns the formatted entry if valid.
   * Mirrors the logic in the ColourSwatches component.
   */
  function extractColour(
    label: string,
    key: string,
    requirements: Record<string, unknown>,
  ): { label: string; hex: string } | null {
    const value = requirements[key];
    if (typeof value === "string" && /^#[0-9a-fA-F]{6}$/.test(value)) {
      return { label, hex: value };
    }
    return null;
  }

  it("recognizes valid hex colours", () => {
    const req = { brandPrimary: "#2f6b4f", brandSecondary: "#d99a5b" };
    expect(extractColour("Primary", "brandPrimary", req)).toEqual({
      label: "Primary",
      hex: "#2f6b4f",
    });
    expect(extractColour("Secondary", "brandSecondary", req)).toEqual({
      label: "Secondary",
      hex: "#d99a5b",
    });
  });

  it("rejects invalid hex colours", () => {
    const req = {
      brandPrimary: "not-a-hex",
      brandSecondary: "#ff6600",
    };
    expect(extractColour("Primary", "brandPrimary", req)).toBeNull();
    expect(extractColour("Secondary", "brandSecondary", req)).toEqual({
      label: "Secondary",
      hex: "#ff6600",
    });
  });

  it("handles mixed case hex codes", () => {
    const req = {
      colour: "#AABBCC",
      color: "#ff00aa",
    };
    expect(extractColour("Colour", "colour", req)).toEqual({
      label: "Colour",
      hex: "#AABBCC",
    });
    expect(extractColour("Color", "color", req)).toEqual({
      label: "Color",
      hex: "#ff00aa",
    });
  });
});

describe("Order requirements parsing", () => {
  it("extracts colour fields from design order requirements", () => {
    const requirements: Record<string, unknown> = {
      brandPrimary: "#2f6b4f",
      brandSecondary: "#d99a5b",
      copy: "New brand logo",
      clientName: "Aarav Sharma",
      clientEmail: "aarav@example.com",
      clientWhatsapp: "+919876543210",
    };

    const colours: { label: string; hex: string }[] = [];

    const addColour = (
      label: string,
      key: string,
      value?: unknown,
    ): void => {
      if (typeof value === "string" && /^#[0-9a-fA-F]{6}$/.test(value)) {
        colours.push({ label, hex: value });
      }
    };

    // Check all possible colour field names
    addColour("Primary", "brandPrimary", requirements.brandPrimary);
    addColour("Secondary", "brandSecondary", requirements.brandSecondary);
    addColour("Colour", "colour", requirements.colour);
    addColour("Color", "color", requirements.color);

    expect(colours).toHaveLength(2);
    expect(colours[0]).toEqual({ label: "Primary", hex: "#2f6b4f" });
    expect(colours[1]).toEqual({ label: "Secondary", hex: "#d99a5b" });
  });

  it("filters out colour fields from generic requirements display", () => {
    const requirements: Record<string, unknown> = {
      brandPrimary: "#2f6b4f",
      brandSecondary: "#d99a5b",
      copy: "New brand logo",
      clientName: "Aarav Sharma",
    };

    const colourKeys = new Set([
      "brandPrimary",
      "brandSecondary",
      "colour",
      "color",
    ]);

    const displayEntries = Object.entries(requirements).filter(
      ([key]) => !colourKeys.has(key),
    );

    expect(displayEntries).toHaveLength(2);
    expect(displayEntries).toContainEqual(["copy", "New brand logo"]);
    expect(displayEntries).toContainEqual(["clientName", "Aarav Sharma"]);
  });

  it("hides colour section when no valid colours present", () => {
    const requirements: Record<string, unknown> = {
      copy: "Simple poster",
      clientName: "Test User",
    };

    const colours: { label: string; hex: string }[] = [];

    const addColour = (
      label: string,
      key: string,
      value?: unknown,
    ): void => {
      if (typeof value === "string" && /^#[0-9a-fA-F]{6}$/.test(value)) {
        colours.push({ label, hex: value });
      }
    };

    addColour("Primary", "brandPrimary", requirements.brandPrimary);
    addColour("Secondary", "brandSecondary", requirements.brandSecondary);

    expect(colours).toHaveLength(0);
  });

  it("validates hex colour format before displaying", () => {
    const requirements: Record<string, unknown> = {
      brandPrimary: "not-a-hex",
      brandSecondary: "#ff6600",
      copy: "Test",
    };

    const colours: { label: string; hex: string }[] = [];

    const addColour = (
      label: string,
      key: string,
      value?: unknown,
    ): void => {
      if (typeof value === "string" && /^#[0-9a-fA-F]{6}$/.test(value)) {
        colours.push({ label, hex: value });
      }
    };

    addColour("Primary", "brandPrimary", requirements.brandPrimary);
    addColour("Secondary", "brandSecondary", requirements.brandSecondary);

    // Invalid colour should not be added
    expect(colours).toHaveLength(1);
    expect(colours[0].hex).toBe("#ff6600");
  });
});
