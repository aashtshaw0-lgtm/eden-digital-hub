/**
 * Where the money goes.
 *
 * Three parties can be owed from one sale:
 *
 *   1. the maker      — the collaborator who hand-made the product
 *   2. the studio     — Eden, for hosting, packaging and the customer relationship
 *   3. the web owner  — the site commission, on both products and services
 *
 * A product may name **at most one** collaborator. That is a structural limit,
 * not a UI preference: `products.collaboratorId` is a single optional id, and
 * `splitProductSale` takes a single percentage, so there is no code path that
 * can pay three people for one item.
 *
 * All rounding happens here so the three parts always sum to exactly `gross`.
 * The remainder is given to the studio, which is why the parts can never drift
 * apart by a rupee — the same rule the cart uses for tips and coupons.
 */

/** What the web owner takes from a service sale. */
export const DEFAULT_WEB_OWNER_PERCENT = 20;

/** What a collaborator takes from a product they make, unless overridden. */
export const DEFAULT_COLLABORATOR_PERCENT = 60;

/**
 * The studio must always keep something, so the two outside shares are capped
 * together. 90 leaves the studio 10% minimum.
 */
export const MAX_OUTSIDE_SHARE_PERCENT = 90;

export interface ProductSplit {
  /** Rupees owed to the maker. */
  collaboratorShare: number;
  /** Rupees the studio keeps. */
  studioShare: number;
  /** Rupees owed to the web owner. */
  webOwnerShare: number;
}

/**
 * Splits a product sale three ways.
 *
 * `collaboratorPercent` and `webOwnerPercent` are whole percentages. They are
 * clamped so their sum can never exceed `MAX_OUTSIDE_SHARE_PERCENT`, and each
 * share is floored — the studio takes the leftover rupees rather than having a
 * negative part appear on the last line.
 */
export function splitProductSale(
  gross: number,
  collaboratorPercent: number,
  webOwnerPercent: number,
): ProductSplit {
  const total = Math.max(0, Math.round(gross));

  let collaborator = clampPercent(collaboratorPercent);
  let webOwner = clampPercent(webOwnerPercent);

  // Too big a pair of cuts would leave the studio nothing. Scale both down
  // proportionally so the maker never silently loses a bigger slice than the
  // commission does.
  const combined = collaborator + webOwner;
  if (combined > MAX_OUTSIDE_SHARE_PERCENT) {
    const scale = MAX_OUTSIDE_SHARE_PERCENT / combined;
    collaborator = Math.floor(collaborator * scale);
    webOwner = Math.floor(webOwner * scale);
  }

  const collaboratorShare = Math.floor((total * collaborator) / 100);
  const webOwnerShare = Math.floor((total * webOwner) / 100);

  return {
    collaboratorShare,
    webOwnerShare,
    // The studio absorbs the rounding, so the three parts always add up to
    // exactly what the customer paid.
    studioShare: total - collaboratorShare - webOwnerShare,
  };
}

/**
 * Splits a service sale. There is no maker on a design service, so it is just
 * the studio and the web owner.
 */
export function splitServiceSale(
  gross: number,
  webOwnerPercent: number = DEFAULT_WEB_OWNER_PERCENT,
): { studioShare: number; webOwnerShare: number } {
  const total = Math.max(0, Math.round(gross));
  const webOwnerShare = Math.floor(
    (total * clampPercent(webOwnerPercent)) / 100,
  );
  return { studioShare: total - webOwnerShare, webOwnerShare };
}

/**
 * Validates a pair of percentages before they are saved onto a product.
 * Throws with a message the admin form can show as-is.
 */
export function assertValidShares(
  collaboratorPercent: number,
  webOwnerPercent: number,
): void {
  for (const [label, value] of [
    ["Their cut", collaboratorPercent],
    ["The site commission", webOwnerPercent],
  ] as const) {
    if (!Number.isFinite(value) || value < 0 || value > 100) {
      throw new Error(`${label} must be between 0 and 100%.`);
    }
  }
  if (
    collaboratorPercent + webOwnerPercent >
    MAX_OUTSIDE_SHARE_PERCENT
  ) {
    throw new Error(
      `Their cut and the site commission add up to more than ${MAX_OUTSIDE_SHARE_PERCENT}%, which would leave the studio nothing.`,
    );
  }
}

function clampPercent(value: number): number {
  if (!Number.isFinite(value) || value < 0) return 0;
  return Math.min(Math.round(value), 100);
}