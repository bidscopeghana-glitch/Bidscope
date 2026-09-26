export type SupplierReportBid = {
  id: string;
  tender_id: string;
  status: string;
  created_at: string;
  submitted_at: string | null;
};
export type SupplierReportTender = {
  id: string;
  procurement_category: string;
};
export type SupplierReportAward = {
  bid_id: string;
  approval_status: string;
  contract_value: number;
  currency: string;
};

export function supplierReport(
  bids: SupplierReportBid[],
  tenders: SupplierReportTender[],
  awards: SupplierReportAward[],
) {
  const submitted = bids.filter((bid) => bid.submitted_at != null);
  const finalised = awards.filter((award) => award.approval_status === "finalised");
  const awardedBidIds = new Set(finalised.map((award) => award.bid_id));
  const tenderById = new Map(tenders.map((tender) => [tender.id, tender]));
  const categoryCounts = new Map<string, { name: string; started: number; submitted: number; awarded: number }>();
  for (const bid of bids) {
    const name = tenderById.get(bid.tender_id)?.procurement_category || "Uncategorised";
    const row = categoryCounts.get(name) || { name, started: 0, submitted: 0, awarded: 0 };
    row.started++;
    if (bid.submitted_at) row.submitted++;
    if (awardedBidIds.has(bid.id)) row.awarded++;
    categoryCounts.set(name, row);
  }
  const turnaroundDays = submitted.flatMap((bid) => {
    const started = Date.parse(bid.created_at), sent = Date.parse(bid.submitted_at || "");
    return Number.isFinite(started) && Number.isFinite(sent) && sent >= started
      ? [(sent - started) / 86400000] : [];
  });
  const awardValue = new Map<string, number>();
  for (const award of finalised) {
    const amount = Number(award.contract_value);
    if (Number.isFinite(amount) && amount >= 0)
      awardValue.set(award.currency, (awardValue.get(award.currency) || 0) + amount);
  }
  const monthly = new Map<string, { month: string; started: number; submitted: number }>();
  for (const bid of bids) {
    const date = Date.parse(bid.created_at);
    if (!Number.isFinite(date)) continue;
    const month = new Date(date).toISOString().slice(0, 7);
    const row = monthly.get(month) || { month, started: 0, submitted: 0 };
    row.started++;
    if (bid.submitted_at) row.submitted++;
    monthly.set(month, row);
  }
  return {
    counts: {
      started: bids.length,
      drafts: bids.filter((bid) => bid.status === "draft").length,
      submitted: submitted.length,
      currentlyShortlisted: bids.filter((bid) => ["shortlisted", "interview_requested", "interview_scheduled"].includes(bid.status)).length,
      awarded: awardedBidIds.size,
      unsuccessful: bids.filter((bid) => bid.status === "unsuccessful").length,
      completionRate: bids.length ? Math.round(1000 * submitted.length / bids.length) / 10 : 0,
      averagePreparationDays: turnaroundDays.length
        ? Math.round(10 * turnaroundDays.reduce((sum, days) => sum + days, 0) / turnaroundDays.length) / 10
        : null,
    },
    awardValueByCurrency: [...awardValue].sort(([a], [b]) => a.localeCompare(b)).map(([currency, amount]) => ({ currency, amount })),
    categories: [...categoryCounts.values()].sort((a, b) => b.started - a.started || a.name.localeCompare(b.name)),
    monthlyBids: [...monthly.values()].sort((a, b) => a.month.localeCompare(b.month)),
  };
}
