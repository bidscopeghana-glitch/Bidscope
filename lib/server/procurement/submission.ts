import { currentOpportunityStatus } from "./normalization.ts";

export type SubmissionOpportunity = {
  source_name: string;
  official_submission_url?: string | null;
  official_tender_url?: string | null;
  official_source_url: string;
  status?: string | null;
  deadline_at?: string | null;
};

export function submissionAvailable(opportunity: Pick<SubmissionOpportunity, "status" | "deadline_at">, now = new Date()) {
  const deadline = opportunity.deadline_at ? new Date(opportunity.deadline_at) : null;
  if (deadline && Number.isFinite(deadline.valueOf()) && deadline <= now) return false;
  return !["CLOSED", "AWARDED", "CANCELLED", "ARCHIVED", "DRAFT"].includes(currentOpportunityStatus(opportunity.status, opportunity.deadline_at, now));
}

export function getSubmissionDestination(opportunity: SubmissionOpportunity) {
  const destination = opportunity.official_submission_url || opportunity.official_tender_url || opportunity.official_source_url;
  const source = opportunity.source_name.toLowerCase();
  const label = !submissionAvailable(opportunity) ? "View Official Notice"
    : source.includes("ghaneps") ? "Apply on GHANEPS"
    : source.includes("mrh") ? "Continue on MRH e-Bids"
    : source.includes("world bank") || source.includes("african development") ? "View Official Procurement"
    : "View Official Tender";
  return { destination, label };
}
