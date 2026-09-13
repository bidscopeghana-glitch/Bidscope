import type { Metadata } from "next";
import { MemberAccess } from "@/components/procurement/member-access";
import { ProcurementFooter, ProcurementHeader } from "@/components/procurement/site-shell";
import { AwardedOpportunityFeed } from "./awarded-opportunity-feed";

export const metadata: Metadata = { title: "Awarded Opportunities | BidScope Ghana", description: "Research previous public-contract awards, buyers and winning suppliers in Ghana." };

export default function AwardedOpportunitiesPage() {
  return <main className="min-h-screen bg-[#f4f7f3]"><ProcurementHeader/><MemberAccess title="Sign in to research awarded contracts" description="The BidScope award archive helps members understand previous contract decisions, government buyers and winning suppliers."><AwardedOpportunityFeed/></MemberAccess><ProcurementFooter/></main>;
}
