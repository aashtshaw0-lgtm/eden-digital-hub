import { describe, expect, it } from "vitest";
import {
  buildDailySeries,
  compareWindows,
  orderStatus,
  orderTime,
  orderTotals,
  startOfDay,
  type OrderLike,
} from "./adminStats";

const DAY = 24 * 60 * 60 * 1000;

/** A fixed "now" so every expectation is deterministic: 15 Oct 2026, 14:30 local. */
const NOW = new Date(2026, 9, 15, 14, 30, 0, 0).getTime();
const day = (offset: number, hour = 12) => {
  const d = new Date(NOW);
  d.setDate(d.getDate() - offset);
  d.setHours(hour, 0, 0, 0);
  return d.getTime();
};

describe("orderTime", () => {
  it("prefers createdAt and falls back to Convex's _creationTime", () => {
    expect(orderTime({ createdAt: 1000, _creationTime: 5 })).toBe(1000);
    expect(orderTime({ _creationTime: 5 })).toBe(5);
    expect(orderTime({})).toBe(0);
  });
});

describe("orderStatus", () => {
  it("treats a missing status as pending, like the orders board does", () => {
    expect(orderStatus({})).toBe("pending");
    expect(orderStatus({ status: null })).toBe("pending");
    expect(orderStatus({ status: "approved" })).toBe("approved");
  });
});

describe("orderTotals", () => {
  const rows: OrderLike[] = [
    { status: undefined, totalPrice: 1000, paidAmount: 1000, createdAt: day(1) },
    { status: "approved", totalPrice: 2000, paidAmount: null, createdAt: day(2) },
    { status: "pending", totalPrice: 500, paidAmount: 400, createdAt: day(3) },
    { status: "rejected", totalPrice: 800, paidAmount: 0, createdAt: day(4) },
  ];

  it("counts orders and only the ones still awaiting a decision", () => {
    const totals = orderTotals(rows);
    expect(totals.total).toBe(4);
    // Row 1 has no status at all, so it is awaiting a decision too.
    expect(totals.pending).toBe(2);
  });

  it("books every agreed total but collects only amounts that resolved", () => {
    const totals = orderTotals(rows);
    expect(totals.booked).toBe(4300);
    // 1000 + 400 + an explicit 0. The unread proof is excluded, not counted as 0.
    expect(totals.collected).toBe(1400);
  });

  it("is all zeroes for an empty book", () => {
    expect(orderTotals([])).toEqual({ total: 0, pending: 0, collected: 0, booked: 0 });
  });
});

describe("buildDailySeries", () => {
  it("returns exactly one point per day, oldest first, ending today", () => {
    const series = buildDailySeries([], { days: 14, now: NOW });
    expect(series).toHaveLength(14);
    expect(series[13].day).toBe(startOfDay(NOW));
    expect(series[0].day).toBe(startOfDay(day(13)));
    for (let i = 1; i < series.length; i++) {
      expect(series[i].day).toBeGreaterThan(series[i - 1].day);
    }
    expect(series[13].label).toMatch(/\d/);
  });

  it("drops orders older than the window and counts the rest on their own day", () => {
    const series = buildDailySeries(
      [
        { totalPrice: 500, paidAmount: 500, createdAt: day(0, 9) },
        { totalPrice: 700, paidAmount: 700, createdAt: day(0, 23) },
        { totalPrice: 300, paidAmount: 300, createdAt: day(3) },
        { totalPrice: 999, paidAmount: 999, createdAt: day(20) },
      ],
      { days: 14, now: NOW },
    );

    const today = series[series.length - 1];
    expect(today.orders).toBe(2);
    expect(today.collected).toBe(1200);
    expect(today.booked).toBe(1200);

    expect(series[series.length - 4].collected).toBe(300);
    expect(series.reduce((n, p) => n + p.orders, 0)).toBe(3);
  });

  it("keeps a day with no orders in the series so the trend has no gaps", () => {
    const series = buildDailySeries([{ totalPrice: 100, paidAmount: 100, createdAt: day(0) }], {
      days: 5,
      now: NOW,
    });
    expect(series.filter((p) => p.orders === 0)).toHaveLength(4);
    expect(series.every((p) => Number.isFinite(p.day))).toBe(true);
  });
});

describe("compareWindows", () => {
  const series = buildDailySeries(
    [
      // Inside the recent 7-day window.
      { totalPrice: 1000, paidAmount: 1000, createdAt: day(1) },
      { totalPrice: 1000, paidAmount: 1000, createdAt: day(6) },
      // Inside the 7 days before that.
      { totalPrice: 500, paidAmount: 500, createdAt: day(8) },
      // Old enough to fall outside the 14-day window entirely.
      { totalPrice: 9000, paidAmount: 9000, createdAt: day(20) },
    ],
    { days: 14, now: NOW },
  );

  it("compares the newest window against the one before it", () => {
    const trend = compareWindows(series, { days: 7 });
    expect(trend.recent).toBe(2000);
    expect(trend.previous).toBe(500);
    expect(trend.deltaPct).toBe(300);
    expect(trend.recentOrders).toBe(2);
  });

  it("reports no comparison instead of Infinity when there is no baseline", () => {
    const empty = compareWindows(buildDailySeries([], { days: 14, now: NOW }), { days: 7 });
    expect(empty.deltaPct).toBeNull();

    const noPast = compareWindows(
      buildDailySeries(
        [{ totalPrice: 300, paidAmount: 300, createdAt: day(2) }],
        { days: 14, now: NOW },
      ),
      { days: 7 },
    );
    expect(noPast.previous).toBe(0);
    expect(noPast.deltaPct).toBeNull();
  });

  it("can measure booked value instead of collected cash", () => {
    const trend = compareWindows(series, { days: 7, field: "booked" });
    expect(trend.recent).toBe(2000);
    expect(trend.previous).toBe(500);
  });

  it("still works when the series is shorter than the window", () => {
    const short = buildDailySeries(
      [{ totalPrice: 100, paidAmount: 100, createdAt: NOW }],
      { days: 3, now: NOW },
    );
    const trend = compareWindows(short, { days: 7 });
    expect(trend.recent).toBe(100);
    expect(trend.previous).toBe(0);
  });
});

describe("startOfDay", () => {
  it("zeroes the time portion in local time", () => {
    const start = startOfDay(NOW);
    const d = new Date(start);
    expect([d.getHours(), d.getMinutes(), d.getSeconds(), d.getMilliseconds()]).toEqual([0, 0, 0, 0]);
    expect(NOW - start).toBeLessThan(DAY);
  });
});
