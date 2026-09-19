import {notFound} from "next/navigation";
import {ProcurementPage} from "@/components/procurement/buyer-workspace";
export default async function Page({params}:{params:Promise<{section?:string[]}>}){const{section=[]}=await params;if(section.length>2||!["home","onboarding","tenders","create","bids","evaluations","meetings","suppliers","reports","team","settings"].includes(section[0]||"home"))notFound();return <ProcurementPage section={section[0]||"home"} identifier={section[1]}/>}
