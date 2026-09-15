import type { Metadata } from "next";
import { ProcurementFooter, ProcurementHeader } from "@/components/procurement/site-shell";
import { PlansClient } from "./plans-client";

export const metadata: Metadata = { title: "Plans | BidScope Ghana", description: "Compare BidScope Pro, Premium and Platinum plans for opportunity discovery, intelligence and bid preparation." };
export default function PlansPage(){return <main className="min-h-screen bg-[#f4f7f3]"><ProcurementHeader/><PlansClient/><ProcurementFooter/></main>;}
