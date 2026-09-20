import type { Metadata } from "next";
import { ProcurementFooter, ProcurementHeader } from "@/components/procurement/site-shell";
import {publicMetadata} from "@/lib/seo/site";
import {listPublicTenders} from "@/lib/server/seo-opportunities";
import { OpportunityBrowser } from "./opportunity-browser";

export const metadata: Metadata = publicMetadata({title:"Search Tenders and Procurement Opportunities in Ghana | BidScope",description:"Search live Ghana tenders, public procurement notices and eligible contract opportunities by category and location.",path:"/opportunities"});

export default async function OpportunitiesPage() {
  const initial=await listPublicTenders({limit:12});
  return <main className="min-h-screen bg-[#f7f4eb]"><ProcurementHeader/><OpportunityBrowser initialResult={{data:initial.items,pagination:{total:initial.total,page:1,pageSize:12}}}/><ProcurementFooter/></main>;
}
