import { describe, expect, it } from "vitest";
import { buildMonthlyTrend, summarizeDashboard } from "@/features/analysis/dashboard";

describe("dashboard aggregations", () => {
  it("uses every filtered record rather than a recent-list limit", () => {
    expect(summarizeDashboard([
      { status: "EN_ANALISIS", _count: { _all: 240 } },
      { status: "CERRADO", _count: { _all: 65 } },
    ])).toEqual({ total: 305, open: 240, closed: 65 });
  });

  it("combines dates by month and keeps the latest eight months", () => {
    const groups = Array.from({ length: 10 }, (_, month) => ({ eventDate: new Date(Date.UTC(2026, month, 1)), _count: { _all: 1 } }));
    groups.push({ eventDate: new Date(Date.UTC(2026, 9, 15)), _count: { _all: 4 } });
    const trend = buildMonthlyTrend(groups);
    expect(trend).toHaveLength(8);
    expect(trend.at(-1)?.count).toBe(5);
  });
});
