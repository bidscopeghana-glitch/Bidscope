import type { Metadata } from "next";
import { ProcurementFooter, ProcurementHeader } from "@/components/procurement/site-shell";
import { LiveOpportunityFeed } from "./live-opportunity-feed";
import { MemberAccess } from "@/components/procurement/member-access";

export const metadata: Metadata = { title: "Live Open Opportunities | BidScope Ghana", description: "View every live open procurement opportunity currently tracked by BidScope Ghana." };

export default function LiveOpportunitiesPage() {
  return <main className="min-h-screen bg-[#f4f7f3]"><ProcurementHeader/><MemberAccess title="Sign in to view live opportunities" description="Live procurement records are reserved for BidScope members. Sign in to see current notices, deadlines and official source links."><LiveOpportunityFeed/></MemberAccess><ProcurementFooter/></main>;
}
