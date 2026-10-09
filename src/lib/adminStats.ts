/**
 * Pure maths behind the console home.
 *
 * The stats strip and the revenue trend both read the same `orders.listAll`
 * rows, so the arithmetic lives here — out of the components — where it can be
 * tested without a browser or a Convex backend.
 */

/** The slice of an order row these helpers need, so tests can pass plain objects. */
export interface OrderLike {
  status?: string | null;
  /** What the client agreed to pay. */
  totalPrice?: number;
  /**
   * What the receipts resolved to. `null` means a proof exists but no amount
   * could be read from it — deliberately different from "paid nothing".
   */
  paidAmount?: number | null;
  createdAt?: number;
  /** Convex stamps every document with this. */
  _creationTime?: number;
}

export interface OrderTotals {
  /** Orders in the book. */
  total: number;
  /** Orders still waiting on a decision. */
  pending: number;
  /** Rupees read off receipts (unknown amounts excluded). */
  collected: number;
  /** Rupees clients agreed to pay, regardless of whether a receipt arrived. */
  booked: number;
}

export function orderTime(order: OrderLike): number {
  return order.createdAt ?? order._creationTime ?? 0;
}

/** Missing status means the order has not been touched, which is `pending`. */
export function orderStatus(order: OrderLike): string {
  return order.status ?? "pending";
}

export function orderTotals(orders: readonly OrderLike[]): OrderTotals {
  let pending = 0;
  let collected = 0;
  let booked = 0;

  for (const order of orders) {
    if (orderStatus(order) === "pending") pending += 1;
    if (typeof order.totalPrice === "number") booked += order.totalPrice;
    // Only a resolved amount counts: adding `null` as 0 would quietly understate
    // what the studio has actually taken.
    if (typeof order.paidAmount === "number") collected += order.paidAmount;
  }

  return { total: orders.length, pending, collected, booked };
}

export interface DayPoint {
  /** Midnight-aligned local timestamp for the day. */
  day: number;
  /** Short label for the axis, e.g. "5 Oct". */
  label: string;
  collected: number;
  booked: number;
  orders: number;
}

/** Midnight in local time, so buckets line up with the studio's own day. */
export function startOfDay(ms: number): number {
  const d = new Date(ms);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/**
 * One point per calendar day, oldest first, ending on the day `now` falls in.
 *
 * Days are stepped with `setDate` rather than by adding 24h, so a daylight
 * saving change can't shift or duplicate a bucket.
 */
export function buildDailySeries(
  orders: readonly OrderLike[],
  { days = 14, now }: { days?: number; now: number },
): DayPoint[] {
  const today = startOfDay(now);
  const buckets = new Map<number, DayPoint>();

  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const day = d.getTime();
    buckets.set(day, {
      day,
      label: d.toLocaleDateString("en-IN", { day: "numeric", month: "short" }),
      collected: 0,
      booked: 0,
      orders: 0,
    });
  }

  for (const order of orders) {
    const bucket = buckets.get(startOfDay(orderTime(order)));
    if (!bucket) continue; // outside the window, or dated in the future
    bucket.orders += 1;
    if (typeof order.totalPrice === "number") bucket.booked += order.totalPrice;
    if (typeof order.paidAmount === "number") bucket.collected += order.paidAmount;
  }

  return [...buckets.values()];
}

export interface TrendSummary {
  /** Rupees in the most recent window. */
  recent: number;
  /** Rupees in the window immediately before it. */
  previous: number;
  /** Percent change, or `null` when there is no previous window to compare to. */
  deltaPct: number | null;
  /** Orders placed in the most recent window. */
  recentOrders: number;
}

/**
 * Builds both halves of the trend panel: the points to chart, and the summary
 * compared against the window immediately before them.
 *
 * The series is built **twice as long** as it is displayed so a short range can
 * still be compared with the equally short period before it. Charting only the
 * visible window would leave `compareWindows` with nothing behind it, and every
 * 7-day view would read as "no earlier window to compare" — which is the bug
 * this helper exists to prevent.
 */
export function buildTrend(
  orders: readonly OrderLike[],
  {
    days,
    now,
    field = "collected",
  }: { days: number; now: number; field?: "collected" | "booked" },
): { series: DayPoint[]; trend: TrendSummary } {
  const full = buildDailySeries(orders, { days: days * 2, now });
  return { series: full.slice(-days), trend: compareWindows(full, { days, field }) };
}

/**
 * Compares the newest `days` points of a series against the `days` before them.
 *
 * A zero baseline yields `null` rather than Infinity or 100% — "up 100% from
 * nothing" is not a number anyone can act on, so callers show it as no
 * comparison instead.
 */
export function compareWindows(
  series: readonly DayPoint[],
  { days = 7, field = "collected" }: { days?: number; field?: "collected" | "booked" } = {},
): TrendSummary {
  const recentPoints = series.slice(-days);
  const previousPoints = series.slice(-days * 2, -days);

  const sum = (points: readonly DayPoint[]) =>
    points.reduce((total, point) => total + point[field], 0);
  const recent = sum(recentPoints);
  const previous = sum(previousPoints);

  return {
    recent,
    previous,
    deltaPct: previous > 0 ? ((recent - previous) / previous) * 100 : null,
    recentOrders: recentPoints.reduce((total, point) => total + point.orders, 0),
  };
}
