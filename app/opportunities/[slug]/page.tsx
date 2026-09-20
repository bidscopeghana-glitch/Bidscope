import type {Metadata} from "next";
import {notFound} from "next/navigation";
import { ProcurementFooter, ProcurementHeader } from "@/components/procurement/site-shell";
import {Breadcrumbs,JsonLd,TenderCards} from "@/components/seo/public-seo";
import {absoluteUrl,publicMetadata} from "@/lib/seo/site";
import {getPublicTender,listRelatedTenders} from "@/lib/server/seo-opportunities";
import { OpportunityDetail } from "./opportunity-detail";

type Props={params:Promise<{slug:string}>};
export async function generateMetadata({params}:Props):Promise<Metadata>{
  const{slug}=await params;const item=await getPublicTender(slug);if(!item)return{};
  const description=(item.summary||`Tender opportunity in ${item.region||item.country||"Ghana"}.`).slice(0,155);
  return publicMetadata({title:`${item.title} | Ghana Tender | BidScope`,description,path:`/opportunities/${item.slug}`,image:`/opportunities/${item.slug}/opengraph-image`,noindex:["WITHDRAWN","DRAFT"].includes(item.status)});
}

export default async function OpportunityPage({ params }:Props) {
  const { slug } = await params;
  const item=await getPublicTender(slug);if(!item)notFound();
  const related=await listRelatedTenders(item);
  return <main className="min-h-screen bg-[#f7f4eb]"><ProcurementHeader/><div className="mx-auto max-w-6xl px-5 pt-9 sm:px-8"><Breadcrumbs items={[{name:"Home",href:"/"},{name:"Tenders",href:"/tenders"},{name:item.category,href:"/tenders"},{name:item.title,href:`/opportunities/${item.slug}`}]}/></div><OpportunityDetail slug={slug} initialItem={item}/><section className="mx-auto max-w-6xl px-5 pb-8 sm:px-8"><h2 className="serif text-3xl text-[#17362d]">Related live tenders</h2><div className="mt-5"><TenderCards items={related}/></div></section><JsonLd data={{"@context":"https://schema.org","@type":"WebPage",name:item.title,description:item.summary,url:absoluteUrl(`/opportunities/${item.slug}`),datePublished:item.published_at||undefined,expires:item.deadline_at||undefined,about:{"@type":"Thing",name:`${item.category} procurement opportunity`},isPartOf:{"@type":"WebSite",name:"BidScope",url:absoluteUrl("/")}}}/><ProcurementFooter/></main>;
}
