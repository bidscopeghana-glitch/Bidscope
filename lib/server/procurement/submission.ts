export type SubmissionOpportunity = {
  source_name: string;
  official_submission_url?: string | null;
  official_tender_url?: string | null;
  official_source_url: string;
};

export function getSubmissionDestination(opportunity: SubmissionOpportunity) {
  const destination = opportunity.official_submission_url || opportunity.official_tender_url || opportunity.official_source_url;
  const source = opportunity.source_name.toLowerCase();
  const label = source.includes("ghaneps") ? "Apply on GHANEPS"
    : source.includes("mrh") ? "Continue on MRH e-Bids"
    : source.includes("ungm") ? "Continue on UNGM"
    : source.includes("world bank") || source.includes("african development") ? "View Official Procurement"
    : "View Official Tender";
  return { destination, label };
}

