interface StatusCount {
  status: string;
  _count: { _all: number };
}

interface EventDateCount {
  eventDate: Date;
  _count: { _all: number };
}

export interface DashboardSummary {
  total: number;
  open: number;
  closed: number;
}

export interface TrendEntry {
  label: string;
  count: number;
}

export function summarizeDashboard(statusGroups: StatusCount[]): DashboardSummary {
  const total = statusGroups.reduce((sum, group) => sum + group._count._all, 0);
  const closed = statusGroups.find(({ status }) => status === "CERRADO")?._count._all ?? 0;
  return { total, open: total - closed, closed };
}

export function buildMonthlyTrend(groups: EventDateCount[], limit = 8): TrendEntry[] {
  const months = new Map<string, number>();
  for (const group of groups) {
    const key = group.eventDate.toISOString().slice(0, 7);
    months.set(key, (months.get(key) ?? 0) + group._count._all);
  }

  return Array.from(months.entries()).sort(([left], [right]) => left.localeCompare(right)).slice(-limit).map(([key, count]) => ({
    label: new Intl.DateTimeFormat("es-CO", { month: "short", year: "2-digit", timeZone: "UTC" }).format(new Date(`${key}-01T00:00:00.000Z`)),
    count,
  }));
}
