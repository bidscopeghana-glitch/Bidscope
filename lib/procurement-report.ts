export type ReportTender = {
  id: string;
  status: string;
  procurement_category: string;
  created_at: string;
  published_at: string | null;
};
export type ReportBid = {
  id: string;
  tender_id: string;
  supplier_organization_id: string;
  submitted_at: string | null;
};
export type ReportAward = {
  id: string;
  tender_id: string;
  supplier_organization_id: string;
  approval_status: string;
  contract_value: number;
  currency: string;
  finalised_at: string | null;
};

export function procurementReport(tenders: ReportTender[], bids: ReportBid[], awards: ReportAward[]) {
  const submitted = bids.filter((bid) => bid.submitted_at != null);
  const published = tenders.filter((tender) => tender.published_at != null);
  const finalised = awards.filter((award) => award.approval_status === "finalised");
  const bidTenderIds = new Set(submitted.map((bid) => bid.tender_id));
  const spendByCurrency = new Map<string, number>();
  const spendBySupplier = new Map<string, number>();
  for (const award of finalised) {
    const amount = Number(award.contract_value);
    if (!Number.isFinite(amount) || amount < 0) continue;
    spendByCurrency.set(award.currency, (spendByCurrency.get(award.currency) || 0) + amount);
    const key = `${award.currency}:${award.supplier_organization_id}`;
    spendBySupplier.set(key, (spendBySupplier.get(key) || 0) + amount);
  }
  const supplierConcentration = [...spendByCurrency].map(([currency, total]) => ({
    currency,
    topSupplierShare: total > 0
      ? Math.round(1000 * Math.max(0, ...[...spendBySupplier].filter(([key]) => key.startsWith(`${currency}:`)).map(([, value]) => value)) / total) / 10
      : 0,
  }));
  const tenderById = new Map(tenders.map((tender) => [tender.id, tender]));
  const lastFinalisation = new Map<string, number>();
  for (const award of finalised) {
    const at = Date.parse(award.finalised_at || "");
    if (Number.isFinite(at)) lastFinalisation.set(award.tender_id, Math.max(lastFinalisation.get(award.tender_id) || 0, at));
  }
  const cycleDays = [...lastFinalisation].flatMap(([id, finalisedAt]) => {
    const tender = tenderById.get(id);
    const publishedAt = Date.parse(tender?.published_at || "");
    return Number.isFinite(publishedAt) && finalisedAt >= publishedAt ? [(finalisedAt - publishedAt) / 86400000] : [];
  });
  const categories = new Map<string, { name: string; tenders: number; submittedBids: number }>();
  for (const tender of tenders) {
    const name = tender.procurement_category || "Uncategorised";
    const row = categories.get(name) || { name, tenders: 0, submittedBids: 0 };
    row.tenders += 1;
    categories.set(name, row);
  }
  for (const bid of submitted) {
    const name = tenderById.get(bid.tender_id)?.procurement_category || "Uncategorised";
    const row = categories.get(name);
    if (row) row.submittedBids += 1;
  }
  const monthly = new Map<string, number>();
  for (const tender of tenders) {
    const at = Date.parse(tender.created_at);
    if (Number.isFinite(at)) {
      const month = new Date(at).toISOString().slice(0, 7);
      monthly.set(month, (monthly.get(month) || 0) + 1);
    }
  }
  return {
    counts: {
      tenders: tenders.length,
      active: tenders.filter((tender) => ["live", "closing_soon"].includes(tender.status)).length,
      completed: tenders.filter((tender) => tender.status === "awarded").length,
      cancelled: tenders.filter((tender) => tender.status === "cancelled").length,
      published: published.length,
      bidsSubmitted: submitted.length,
      uniqueSuppliers: new Set(submitted.map((bid) => bid.supplier_organization_id)).size,
      averageBids: published.length ? Math.round(10 * submitted.length / published.length) / 10 : 0,
      tenderResponseRate: published.length ? Math.round(1000 * published.filter((tender) => bidTenderIds.has(tender.id)).length / published.length) / 10 : 0,
      averageCycleDays: cycleDays.length ? Math.round(10 * cycleDays.reduce((sum, days) => sum + days, 0) / cycleDays.length) / 10 : null,
    },
    spendByCurrency: [...spendByCurrency].map(([currency, amount]) => ({ currency, amount })).sort((a, b) => a.currency.localeCompare(b.currency)),
    supplierConcentration,
    categories: [...categories.values()].sort((a, b) => b.tenders - a.tenders || a.name.localeCompare(b.name)),
    monthlyTenders: [...monthly].sort(([a], [b]) => a.localeCompare(b)).map(([month, count]) => ({ month, count })),
  };
}
