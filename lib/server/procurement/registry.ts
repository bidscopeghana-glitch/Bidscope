import { ManualReviewAdapter } from "./manual-adapter";
import { WorldBankAdapter } from "./world-bank-adapter";
import { AfricanUnionAdapter, EcowasAdapter, GhanaRoadsAdapter, GhanepsAdapter } from "./structured-adapters";
import { BankOfGhanaAdapter, GhanaHighwayAuthorityAdapter, GhanaMinistryFinanceAdapter, MrhEbidsAdapter } from "./ghana-adapters";
import { UngmAdapter } from "./ungm-adapter";
import { SamGovAdapter } from "./sam-gov-adapter";
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
  "mrh-ebids": new MrhEbidsAdapter(),
  ungm: new UngmAdapter(),
  "sam-gov": new SamGovAdapter(),
  "ghana-highway-authority": new GhanaHighwayAuthorityAdapter(),
  "ghana-ministry-finance": new GhanaMinistryFinanceAdapter(),
  afdb: new ManualReviewAdapter("afdb", "Procurement RSS is advertised; exact feed and reuse conditions need review."),
  "world-bank": new WorldBankAdapter(),
};

export function getProcurementAdapter(slug: string) { return adapters[slug] || null; }
export function registeredAdapterSlugs() { return Object.keys(adapters); }
