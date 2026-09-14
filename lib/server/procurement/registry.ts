import { ManualReviewAdapter } from "./manual-adapter";
import { WorldBankAdapter } from "./world-bank-adapter";
import { AfricanUnionAdapter, BankOfGhanaAdapter, EcowasAdapter, GhanaRoadsAdapter, GhanepsAdapter } from "./structured-adapters";
import { contractsFinderAdapter, findATenderAdapter, TedAdapter } from "./international-adapters";
import type { ProcurementSourceAdapter } from "./types";

const adapters: Record<string, ProcurementSourceAdapter> = {
  ghaneps: new GhanepsAdapter(),
  "mrh-procurement": new GhanaRoadsAdapter(),
  "bank-of-ghana": new BankOfGhanaAdapter(),
  ecowas: new EcowasAdapter(),
  "african-union": new AfricanUnionAdapter(),
  "ted-eu": new TedAdapter(),
  "uk-contracts-finder": contractsFinderAdapter,
  "uk-find-a-tender": findATenderAdapter,
  "mrh-ebids": new ManualReviewAdapter("mrh-ebids", "Manual ingestion ready; portal automation needs legal and technical review."),
  ungm: new ManualReviewAdapter("ungm", "Public notices verified; third-party aggregation access needs review."),
  afdb: new ManualReviewAdapter("afdb", "Procurement RSS is advertised; exact feed and reuse conditions need review."),
  "world-bank": new WorldBankAdapter(),
};

export function getProcurementAdapter(slug: string) { return adapters[slug] || null; }
export function registeredAdapterSlugs() { return Object.keys(adapters); }
