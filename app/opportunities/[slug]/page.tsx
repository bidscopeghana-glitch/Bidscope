import { ProcurementFooter, ProcurementHeader } from "@/components/procurement/site-shell";
import { OpportunityDetail } from "./opportunity-detail";

export default async function OpportunityPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <main className="min-h-screen bg-[#f7f4eb]"><ProcurementHeader/><OpportunityDetail slug={slug}/><ProcurementFooter/></main>;
}

