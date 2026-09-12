const badgeStyles: Record<string, string> = {
  GHANEPS: "border-emerald-800/15 bg-emerald-50 text-emerald-900",
  "MRH e-Bids": "border-sky-800/15 bg-sky-50 text-sky-900",
  "Bank of Ghana": "border-slate-800/15 bg-slate-100 text-slate-800",
  UNGM: "border-blue-800/15 bg-blue-50 text-blue-900",
  "African Development Bank": "border-teal-800/15 bg-teal-50 text-teal-900",
  "World Bank": "border-indigo-800/15 bg-indigo-50 text-indigo-900",
};

export function SourceBadge({ source }: { source: string }) {
  const label = source === "World Bank" ? "World Bank Funded" : source;
  return <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-[.1em] ${badgeStyles[source] || "border-stone-300 bg-stone-50 text-stone-700"}`}>{label}</span>;
}
