import {ProcurementHeader,ProcurementFooter} from "@/components/procurement/site-shell";
import {ServiceWorkspace} from "@/components/procurement/service-workspace";
export default async function Page({searchParams}:{searchParams:Promise<{service?:string}>}){const query=await searchParams;return <main className="min-h-screen bg-[#f7f4eb]"><ProcurementHeader/><ServiceWorkspace initialService={query.service}/><ProcurementFooter/></main>;}
