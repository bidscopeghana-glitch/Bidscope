import { ManualReviewAdapter } from "./manual-adapter";
import { WorldBankAdapter } from "./world-bank-adapter";
import type { ProcurementSourceAdapter } from "./types";

const adapters: Record<string, ProcurementSourceAdapter> = {
  ghaneps: new ManualReviewAdapter("ghaneps", "Manual ingestion ready; no verified public aggregation API."),
  "mrh-ebids": new ManualReviewAdapter("mrh-ebids", "Manual ingestion ready; portal automation needs legal and technical review."),
  "bank-of-ghana": new ManualReviewAdapter("bank-of-ghana", "Manual ingestion ready; no verified public procurement API."),
  ungm: new ManualReviewAdapter("ungm", "Public notices verified; third-party aggregation access needs review."),
  afdb: new ManualReviewAdapter("afdb", "Procurement RSS is advertised; exact feed and reuse conditions need review."),
  "world-bank": new WorldBankAdapter(),
};

export function getProcurementAdapter(slug: string) { return adapters[slug] || null; }
export function registeredAdapterSlugs() { return Object.keys(adapters); }

