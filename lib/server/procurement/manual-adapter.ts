import type { AdapterHealth, NormalizedOpportunity, ProcurementSourceAdapter } from "./types";

export class ManualReviewAdapter implements ProcurementSourceAdapter<Record<string, never>> {
  constructor(public readonly slug: string, private readonly reason: string) {}

  async fetchOpportunities() { return []; }
  async fetchOpportunityById() { return null; }
  async normaliseOpportunity(): Promise<NormalizedOpportunity> { throw new Error(`${this.slug} accepts validated manual imports only.`); }
  getOfficialUrl() { return ""; }
  getSubmissionUrl() { return null; }
  async healthCheck(): Promise<AdapterHealth> {
    return { ok: false, message: this.reason, checkedAt: new Date().toISOString() };
  }
}

