"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ArrowDownRight, ArrowRight, ArrowUpRight, Minus } from "lucide-react";
import { buildMarketTrend, marketPeriods, percentageChange, type MarketMetric, type MarketPeriod } from "@/lib/market-trends";
import { useData } from "./data";
import { Skeleton } from "./shell";

type Snapshot = {
  asOf: string; indexed: number; active: number; newWeek: number; closingWeek: number;
  awarded: number; valueGhs: number | null; valuedGhsCount: number;
  series: { date: string; count: number; valueGhs: number; valuedCount: number }[];
  sectors: { name: string; recent: number; previous: number; active: number; closing: number; valueGhs: number; valuedCount: number }[];
  buyers: { name: string; active: number; valueGhs: number; valuedCount: number }[];
  regions: { name: string; active: number }[];
  heatmap: { region: string; sector: string; active: number }[];
};
const money = (value: number) => `GH₵${Math.round(value).toLocaleString("en-GB")}`;
const change = percentageChange;
const isSourceCode = (name: string) => /^(?:[A-Z]{0,3}\d[\d, ]*)$/i.test(name);
export function MarketIntelligence() {
  const result = useData<{ data: Snapshot }>("/api/market-intelligence");
  const watches = useData<{ data: { id: string; name: string; alerts_enabled: boolean; filters: Record<string, string> }[] }>("/api/customer?resource=searches");
  const [period, setPeriod] = useState<MarketPeriod>("30D");
  const [metric, setMetric] = useState<MarketMetric>("count");
  const data = result.data?.data;
  const trend = useMemo(() => buildMarketTrend(data?.series || [], period, metric), [data, period, metric]);
  if (result.loading) return <Skeleton />;
  if (result.error || !data) return <p role="alert" className="cc-error">{result.error || "Market data is unavailable."}</p>;
  const namedSectors = data.sectors.filter(item => item.name !== "Unclassified" && !isSourceCode(item.name));
  const mostActive = namedSectors.find(item => item.active > 0);
  const fastest = namedSectors.filter(item => item.previous >= 3 && item.recent >= 3).sort((a,b) => (change(b.recent,b.previous) || 0) - (change(a.recent,a.previous) || 0))[0];
  const sectorBoard = data.sectors.filter(item => item.active > 0).slice(0, 12);
  const topBuyer = data.buyers[0];
  const cards = [
    ["Active tenders", data.active.toLocaleString()], ["New this week", data.newWeek.toLocaleString()],
    ["Closing in 7 days", data.closingWeek.toLocaleString()], ["Indexed award notices", data.awarded.toLocaleString()],
    ["Published GHS opportunity value", data.valuedGhsCount ? money(data.valueGhs || 0) : "Not disclosed"],
    ["Average disclosed GHS tender", data.valuedGhsCount ? money((data.valueGhs || 0) / data.valuedGhsCount) : "Not enough data"],
    ["Fastest growing named sector", fastest?.name || "Insufficient classified data"],
    ["Most active named sector", mostActive?.name || "Insufficient classified data"],
    ["Most active buyer", topBuyer?.name || "Not enough data"],
  ];
  const delta = change(trend.current, trend.previous);
  const regions = data.regions.slice(0, 6);
  const sectors = data.sectors.filter(item => item.active > 0).slice(0, 6);
  const heatmap = new Map(data.heatmap.map(cell => [`${cell.region}\u0000${cell.sector}`, cell.active]));
  const heatMax = Math.max(1, ...data.heatmap.map(cell => cell.active));
  const savedWatches = watches.data?.data?.filter(watch => watch.filters?.sector || watch.filters?.region || watch.filters?.buyer).slice(0, 4) || [];
  return <div className="cc-market-terminal">
    <header className="cc-market-hero"><div><p className="cc-eyebrow">BIDSCOPE MARKET SIGNALS · INDEXED DATA</p><h1>Market intelligence</h1><p>Live procurement signals from BidScope’s published index. Values and trends are shown only where records support them.</p></div><span>Updated {new Date(data.asOf).toLocaleString("en-GB")}</span></header>
    <div className="cc-market-metrics">{cards.map(([label,value]) => <div className="cc-market-metric" key={label}><small>{label}</small><strong>{value}</strong></div>)}</div>
    <section className="cc-market-panel"><div className="cc-market-panel-head"><div><p className="cc-eyebrow">TENDER ACTIVITY</p><h2>Market trend</h2><p>{period === "ALL" ? "Monthly" : "Daily"} publication activity · {metric === "count" ? "tender count" : "disclosed estimated GHS value"}</p></div><div><div role="group" aria-label="Market metric" className="cc-market-periods"><button aria-pressed={metric === "count"} onClick={() => setMetric("count")}>Tender count</button><button aria-pressed={metric === "valueGhs"} onClick={() => setMetric("valueGhs")}>GHS value</button></div><div role="group" aria-label="Market timeframe" className="cc-market-periods">{Object.keys(marketPeriods).map(key => <button key={key} aria-pressed={period === key} onClick={() => setPeriod(key as MarketPeriod)}>{key}</button>)}</div></div></div>
      <p className="cc-market-comparison"><strong>{metric === "count" ? trend.current.toLocaleString("en-GB") : trend.currentCoverage ? money(trend.current) : "No disclosed GHS values"}</strong> in this period {delta == null || period === "ALL" ? <span>· comparison unavailable</span> : <span className={delta >= 0 ? "up" : "down"}>· {delta > 0 ? "+" : ""}{delta.toFixed(1)}% versus the preceding period</span>}</p>
      {data.series.length < 2 || (metric === "valueGhs" && !trend.currentCoverage) ? <p className="cc-quiet">{metric === "valueGhs" ? "No GHS-denominated estimated tender values are disclosed in this period." : "Not enough historical data yet."}</p> : <div className="cc-market-chart" role="img" aria-label={`${period === "ALL" ? "Monthly" : "Daily"} ${metric === "count" ? "tender count" : "disclosed GHS estimated value"} over ${period}`}><ResponsiveContainer width="100%" height="100%"><AreaChart data={trend.chart} margin={{ top: 12, right: 12, bottom: 0, left: -20 }}><defs><linearGradient id="market-fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#16a876" stopOpacity={0.42}/><stop offset="100%" stopColor="#16a876" stopOpacity={0.02}/></linearGradient></defs><CartesianGrid stroke="#dce8df" vertical={false}/><XAxis dataKey="date" tick={{ fontSize: 11 }} minTickGap={34}/><YAxis allowDecimals={metric === "valueGhs"} tick={{ fontSize: 11 }} tickFormatter={value => metric === "valueGhs" ? `${(Number(value) / 1000000).toFixed(1)}m` : String(value)}/><Tooltip formatter={value => [metric === "count" ? `${value} tenders` : money(Number(value)), metric === "count" ? "Published" : "Estimated GHS value"]}/><Area type="monotone" dataKey={metric} stroke="#0c8060" strokeWidth={2.5} fill="url(#market-fill)"/></AreaChart></ResponsiveContainer></div>}
    </section>
    <div className="cc-market-columns"><section className="cc-market-panel"><div className="cc-market-panel-head"><div><p className="cc-eyebrow">SECTOR BOARD</p><h2>Opportunity activity</h2><p>Top 12 active categories from indexed source records. Code labels are source classifications, not verified sector names.</p></div></div><div className="cc-market-list">{sectorBoard.map(sector => { const movement = change(sector.recent,sector.previous); const label = isSourceCode(sector.name) ? `Classification code ${sector.name}` : sector.name === "Unclassified" ? "Unclassified source category" : sector.name; return <Link href={`/customer/discover?sector=${encodeURIComponent(sector.name)}`} className="cc-market-sector" key={sector.name}><span><strong>{label}</strong><small>{sector.active} active · {sector.closing} closing soon · {sector.valuedCount ? money(sector.valueGhs) : "value not disclosed"}</small></span><span className={movement == null ? "neutral" : movement >= 0 ? "up" : "down"}>{movement == null ? <Minus size={16}/> : movement >= 0 ? <ArrowUpRight size={16}/> : <ArrowDownRight size={16}/>} {movement == null ? "Insufficient history" : `${movement > 0 ? "+" : ""}${movement.toFixed(1)}%`}</span></Link>; })}</div></section>
      <div><section className="cc-market-panel"><p className="cc-eyebrow">DATA-BACKED INSIGHT</p><h2>What is moving?</h2>{fastest ? <p>{fastest.name} published {fastest.recent} tenders in the last 30 days, versus {fastest.previous} in the preceding 30 days ({change(fastest.recent, fastest.previous)?.toFixed(1)}% change).</p> : <p>Not enough historical data yet to identify a reliable growth leader.</p>}{fastest && <Link href={`/customer/discover?sector=${encodeURIComponent(fastest.name)}`}>Explore {fastest.name} <ArrowRight size={15}/></Link>}</section>
      <section className="cc-market-panel"><p className="cc-eyebrow">TOP BUYERS</p><h2>Most active entities</h2>{data.buyers.map(buyer => <Link className="cc-market-rank" key={buyer.name} href={`/customer/discover?buyer=${encodeURIComponent(buyer.name)}`}><span>{buyer.name}<small>{buyer.valuedCount ? ` · ${money(buyer.valueGhs)} disclosed GHS value` : ""}</small></span><strong>{buyer.active}</strong></Link>)}</section>
      <section className="cc-market-panel"><p className="cc-eyebrow">REGIONAL VIEW</p><h2>Open opportunities by region</h2>{data.regions.map(region => <Link className="cc-market-rank" key={region.name} href={`/customer/discover?region=${encodeURIComponent(region.name)}`}><span>{region.name}</span><strong>{region.active}</strong></Link>)}</section>
      <section className="cc-market-panel"><p className="cc-eyebrow">YOUR WATCHLIST</p><h2>Watched markets</h2>{savedWatches.length ? savedWatches.map(watch => <Link className="cc-market-rank" key={watch.id} href={`/customer/discover?${new URLSearchParams(watch.filters).toString()}`}><span>{watch.name}</span><strong>{watch.alerts_enabled ? "Alerts on" : "Saved"}</strong></Link>) : <p>Save a filtered opportunity search to watch a sector, buyer or region.</p>}<Link href="/customer/alerts">Manage Tender Watches <ArrowRight size={15}/></Link></section></div></div>
    {!!regions.length && !!sectors.length && <section className="cc-market-panel"><p className="cc-eyebrow">OPPORTUNITY HEATMAP</p><h2>Open tenders by region and sector</h2><p>The six most active indexed regions and sectors are shown. Cell intensity represents currently open tenders; select a named cell to explore matching opportunities.</p><div className="cc-market-heatmap-scroll"><div className="cc-market-heatmap" style={{ gridTemplateColumns: `minmax(125px,1.5fr) repeat(${sectors.length},minmax(78px,1fr))` }}><span className="cc-market-heatmap-label">Region / sector</span>{sectors.map(sector => <span className="cc-market-heatmap-label" key={sector.name}>{sector.name}</span>)}{regions.flatMap(region => [<span className="cc-market-heatmap-label" key={`${region.name}-label`}>{region.name}</span>, ...sectors.map(sector => { const count = heatmap.get(`${region.name}\u0000${sector.name}`) || 0; const named = region.name !== "Unspecified" && sector.name !== "Unclassified"; return count && named ? <Link key={`${region.name}-${sector.name}`} aria-label={`${count} open ${sector.name} tenders in ${region.name}`} href={`/customer/discover?region=${encodeURIComponent(region.name)}&sector=${encodeURIComponent(sector.name)}`} style={{ backgroundColor: `rgba(14, 117, 86, ${0.13 + 0.77 * count / heatMax})`, color: count / heatMax > .55 ? "white" : "#124e3c" }}>{count}</Link> : <span className="cc-market-heatmap-empty" key={`${region.name}-${sector.name}`} aria-label={`${count} indexed open ${sector.name} tenders in ${region.name}`}>{count || "—"}</span>; })])}</div></div></section>}
    <p className="cc-quiet">Coverage is limited to BidScope-indexed records, not the entire procurement market. Estimated value includes only open GHS-denominated tenders with a disclosed value ({data.valuedGhsCount} records). No currency conversion or award-value estimate is made.</p>
  </div>;
}
