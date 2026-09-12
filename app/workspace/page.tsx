import { ProcurementFooter, ProcurementHeader } from "@/components/procurement/site-shell";
import { BidWorkspace } from "./workspace";

export default function WorkspacePage() { return <main className="min-h-screen bg-[#f7f4eb]"><ProcurementHeader/><BidWorkspace/><ProcurementFooter/></main>; }

