export const inr = (n: number) => `₹${n.toLocaleString("en-IN")}`;

export const formatDate = (ms?: number) =>
  ms
    ? new Date(ms).toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : "—";

/** Picks a readable foreground for a (possibly admin-chosen) brand color. */
export function readableOn(hex: string): string {
  const m = hex.replace("#", "");
  if (m.length < 6) return "#faf7f0";
  const r = parseInt(m.slice(0, 2), 16) / 255;
  const g = parseInt(m.slice(2, 4), 16) / 255;
  const b = parseInt(m.slice(4, 6), 16) / 255;
  const lin = (c: number) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
  const L = 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
  return L > 0.45 ? "#241f17" : "#faf7f0";
}

/** Prettifies camelCase intake-form keys into human labels. */
export function labelize(key: string) {
  return key
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (c) => c.toUpperCase())
    .trim();
}
