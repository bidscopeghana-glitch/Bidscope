import type { Metadata } from "next";
import { ProcurementFooter, ProcurementHeader } from "@/components/procurement/site-shell";
import { OpportunityBrowser } from "./opportunity-browser";

export const metadata: Metadata = { title: "Procurement Opportunities | BidScope Ghana", description: "Search Ghana public-sector and development-funded procurement opportunities across official sources." };

export default function OpportunitiesPage() {
  return <main className="min-h-screen bg-[#f7f4eb]"><ProcurementHeader/><OpportunityBrowser/><ProcurementFooter/></main>;
}

