import { Crown, Sparkles } from "lucide-react";

/**
 * Greatness tier thresholds — the same numbers the server uses to gate tiers,
 * mirrored here so the UI copy and styling always agree with the backend.
 */
export const PREMIUM_THRESHOLD = 100;
export const LEGENDARY_THRESHOLD = 500;

/** Checkout-facing aliases so tip copy reads naturally in its own context. */
export const PREMIUM_TIP_THRESHOLD = PREMIUM_THRESHOLD;
export const LEGENDARY_TIP_THRESHOLD = LEGENDARY_THRESHOLD;

export type CreditTierLabel = "standard" | "premium" | "legendary";

export interface TierMeta {
  label: CreditTierLabel;
  /** Capitalised label for display. */
  title: string;
  chip: string;
  ring: string;
  glow: string;
  icon: typeof Sparkles;
}

/** Maps a contribution amount to its greatness tier. */
export function tierLabelFor(amount: number): CreditTierLabel {
  if (amount >= LEGENDARY_THRESHOLD) return "legendary";
  if (amount >= PREMIUM_THRESHOLD) return "premium";
  return "standard";
}

/** Presentation metadata (badge colours, glow, icon) for a contribution amount. */
export function tierMeta(amount: number): TierMeta {
  if (amount >= LEGENDARY_THRESHOLD) {
    return {
      label: "legendary",
      title: "Legendary",
      chip: "bg-amber-500/15 text-amber-700",
      ring: "ring-amber-500/40",
      glow: "shadow-[0_0_40px_-12px] shadow-amber-500/40",
      icon: Crown,
    };
  }
  if (amount >= PREMIUM_THRESHOLD) {
    return {
      label: "premium",
      title: "Premium",
      chip: "bg-primary/12 text-primary",
      ring: "ring-primary/30",
      glow: "shadow-[0_0_40px_-14px] shadow-primary/40",
      icon: Sparkles,
    };
  }
  return {
    label: "standard",
    title: "Standard",
    chip: "bg-secondary text-secondary-foreground",
    ring: "ring-border",
    glow: "",
    icon: Sparkles,
  };
}