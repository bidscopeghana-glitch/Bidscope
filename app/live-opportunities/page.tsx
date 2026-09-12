import type { Metadata } from "next";
import { ProcurementFooter, ProcurementHeader } from "@/components/procurement/site-shell";
import { LiveOpportunityFeed } from "./live-opportunity-feed";

export const metadata: Metadata = { title: "Live Open Opportunities | BidScope Ghana", description: "View every live open procurement opportunity currently tracked by BidScope Ghana." };

export default function LiveOpportunitiesPage() {
  return <main className="min-h-screen bg-[#f4f7f3]"><ProcurementHeader/><LiveOpportunityFeed/><ProcurementFooter/></main>;
}
