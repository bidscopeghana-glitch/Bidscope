import test from "node:test";
import assert from "node:assert/strict";
import { buildMarketTrend, percentageChange, type MarketDay } from "../../lib/market-trends.ts";

const records: MarketDay[] = [
  { date: "2026-09-10", count: 5, valueGhs: 500, valuedCount: 1 },
  { date: "2026-09-12", count: 4, valueGhs: 200, valuedCount: 1 },
  { date: "2026-09-19", count: 2, valueGhs: 100, valuedCount: 1 },
  { date: "2026-09-25", count: 3, valueGhs: 300, valuedCount: 1 },
];
const now = new Date("2026-09-25T12:00:00Z");

test("market trend compares exact non-overlapping seven-day publication windows", () => {
  const result = buildMarketTrend(records, "7D", "count", now);
  assert.equal(result.chart.length, 7);
  assert.equal(result.chart[0].date, "2026-09-19");
  assert.equal(result.chart.at(-1)?.date, "2026-09-25");
  assert.equal(result.current, 5);
  assert.equal(result.previous, 4);
  assert.equal(percentageChange(result.current, result.previous), 25);
});

test("disclosed GHS values and coverage are counted without inventing missing values", () => {
  const result = buildMarketTrend(records, "7D", "valueGhs", now);
  assert.equal(result.current, 400);
  assert.equal(result.previous, 200);
  assert.equal(result.currentCoverage, 2);
  assert.equal(percentageChange(0, 0), null);
});

test("ALL aggregates daily records into monthly points without changing totals", () => {
  const result = buildMarketTrend([
    { date: "2026-01-02", count: 2, valueGhs: 100, valuedCount: 1 },
    { date: "2026-01-20", count: 3, valueGhs: 50, valuedCount: 1 },
    { date: "2026-02-01", count: 4, valueGhs: 0, valuedCount: 0 },
  ], "ALL", "count", new Date("2026-02-02T12:00:00Z"));
  assert.deepEqual(result.chart.map(point => [point.date, point.count, point.valueGhs]), [
    ["2026-01", 5, 150], ["2026-02", 4, 0],
  ]);
  assert.equal(result.current, 9);
  assert.equal(result.previous, 0);
});
