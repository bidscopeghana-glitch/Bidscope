import type { Metadata } from "next";
import { ProcurementFooter, ProcurementHeader } from "@/components/procurement/site-shell";
import { PlansClient } from "./plans-client";
import {publicMetadata} from "@/lib/seo/site";

export const metadata: Metadata = publicMetadata({title:"BidScope Plans and Tender Alert Packages",description:"Compare BidScope Pro, Premium and Platinum plans for tender discovery, alerts, procurement intelligence and bid preparation.",path:"/plans"});
export default function PlansPage(){return <main className="min-h-screen bg-[#f4f7f3]"><ProcurementHeader/><PlansClient/><ProcurementFooter/></main>;}
