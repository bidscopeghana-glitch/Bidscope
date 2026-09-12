import type { Metadata } from "next";
import { ProcurementFooter, ProcurementHeader } from "@/components/procurement/site-shell";
import { PlansClient } from "./plans-client";

export const metadata: Metadata = { title: "Plans | BidScope Ghana", description: "Choose a BidScope plan for opportunity discovery, procurement intelligence and team bidding." };
export default function PlansPage(){return <main className="min-h-screen bg-[#f4f7f3]"><ProcurementHeader/><PlansClient/><ProcurementFooter/></main>;}
