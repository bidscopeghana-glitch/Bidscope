import type {Metadata} from "next";
import {ProcurementHeader,ProcurementFooter} from "@/components/procurement/site-shell";
import {CommandCentreOverview} from "./overview";

export const metadata:Metadata={title:"Admin Command Centre | BidScope",robots:{index:false,follow:false}};
export default function Page(){return <main className="min-h-screen bg-[#eef1e9]"><ProcurementHeader/><CommandCentreOverview/><ProcurementFooter/></main>}
