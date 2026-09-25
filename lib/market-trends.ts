export type MarketMetric = "count" | "valueGhs";
export const marketPeriods = { "7D": 7, "30D": 30, "3M": 90, "6M": 180, "1Y": 365, ALL: 0 } as const;
export type MarketPeriod = keyof typeof marketPeriods;
export type MarketDay = { date: string; count: number; valueGhs: number; valuedCount: number };

const dateKey = (date: Date) => date.toISOString().slice(0, 10);
function startOfPeriod(days: number, now: Date) {
  const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  date.setUTCDate(date.getUTCDate() - days + 1);
  return date;
}

export function percentageChange(current: number, previous: number) {
  return previous > 0 ? ((current - previous) / previous) * 100 : null;
}

export function buildMarketTrend(series: MarketDay[], period: MarketPeriod, metric: MarketMetric, now = new Date()) {
  if (!series.length) return { chart: [] as MarketDay[], current: 0, previous: 0, currentCoverage: 0 };
  const span = marketPeriods[period];
  const earliest = series.reduce((date, point) => point.date < date ? point.date : date, series[0].date);
  const first = period === "ALL" ? new Date(`${earliest}T00:00:00Z`) : startOfPeriod(span, now);
  const byDay = new Map(series.map(point => [point.date, point]));
  const daily: MarketDay[] = [];
  for (let day = new Date(first); day <= now; day.setUTCDate(day.getUTCDate() + 1)) {
    const date = dateKey(day);
    daily.push(byDay.get(date) || { date, count: 0, valueGhs: 0, valuedCount: 0 });
  }
  const current = daily.reduce((sum, point) => sum + point[metric], 0);
  const currentCoverage = daily.reduce((sum, point) => sum + point.valuedCount, 0);
  const previousStart = period === "ALL" ? null : startOfPeriod(span * 2, now);
  const previousEnd = period === "ALL" ? null : startOfPeriod(span, now);
  const previous = previousStart && previousEnd
    ? series.filter(point => point.date >= dateKey(previousStart) && point.date < dateKey(previousEnd)).reduce((sum, point) => sum + point[metric], 0)
    : 0;
  if (period !== "ALL") return { chart: daily, current, previous, currentCoverage };
  const monthly = new Map<string, MarketDay>();
  for (const point of daily) {
    const key = point.date.slice(0, 7);
    const item = monthly.get(key) || { date: key, count: 0, valueGhs: 0, valuedCount: 0 };
    item.count += point.count;
    item.valueGhs += point.valueGhs;
    item.valuedCount += point.valuedCount;
    monthly.set(key, item);
  }
  return { chart: [...monthly.values()], current, previous, currentCoverage };
}
