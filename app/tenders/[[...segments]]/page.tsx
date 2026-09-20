import type {Metadata} from "next";
import Link from "next/link";
import {notFound} from "next/navigation";
import {ProcurementFooter,ProcurementHeader} from "@/components/procurement/site-shell";
import {Breadcrumbs,Faqs,SeoCta,TenderCards} from "@/components/seo/public-seo";
import {listPublicTenders,tenderCategories,tenderLocations,type TenderCategorySlug,type TenderLocationSlug} from "@/lib/server/seo-opportunities";
import {publicMetadata} from "@/lib/seo/site";

type Props={params:Promise<{segments?:string[]}>};
type PageKind={kind:"root"|"ghana"|"category"|"location";category?:TenderCategorySlug;location?:TenderLocationSlug;path:string;title:string;description:string;intro:string};

function resolve(segments:string[]=[]):PageKind|null{
  if(!segments.length)return{kind:"root",path:"/tenders",title:"Tenders in Ghana | Procurement Opportunities | BidScope",description:"Find live public and private tender opportunities, RFQs, RFPs and supply contracts for businesses in Ghana.",intro:"Browse live tender and contract opportunities across Ghana. BidScope helps suppliers discover relevant procurement notices while protecting subscriber-only source and buyer details."};
  if(segments.length===1&&segments[0]==="ghana")return{kind:"ghana",path:"/tenders/ghana",title:"Ghana Tenders and Procurement Opportunities | BidScope",description:"Explore current Ghana tenders, government procurement notices, RFQs, RFPs and contract opportunities for suppliers and contractors.",intro:"Find current procurement opportunities in Ghana across construction, supplies, consulting, technology, healthcare and other sectors."};
  if(segments.length===1&&segments[0] in tenderCategories){const category=segments[0] as TenderCategorySlug;const item=tenderCategories[category];return{kind:"category",category,path:`/tenders/${category}`,title:`${item.name} Tenders in Ghana | BidScope`,description:`Browse live ${item.name.toLowerCase()} tenders, procurement notices and contract opportunities in Ghana. Get alerts and review protected tender details with BidScope.`,intro:item.intro};}
  if(segments.length===2&&segments[0]==="ghana"&&segments[1] in tenderLocations){const location=segments[1] as TenderLocationSlug;const item=tenderLocations[location];return{kind:"location",location,path:`/tenders/ghana/${location}`,title:`Tenders in ${item.name}, Ghana | BidScope`,description:`Find live tenders, RFQs, procurement notices and contract opportunities in ${item.name}, Ghana.`,intro:item.intro};}
  return null;
}

export async function generateMetadata({params}:Props):Promise<Metadata>{
  const page=resolve((await params).segments||[]);if(!page)return{};
  const result=await listPublicTenders({limit:1,category:page.category,location:page.location});
  return publicMetadata({title:page.title,description:page.description,path:page.path,noindex:(page.kind==="category"||page.kind==="location")&&result.total<3});
}

const faq=[
  {question:"How do I find tenders in Ghana?",answer:"Browse BidScope's public tender previews by category or location, then create an account to save opportunities, receive alerts and access the tender information available under your plan."},
  {question:"Can Ghanaian SMEs use BidScope?",answer:"Yes. BidScope is designed to help SMEs and established suppliers discover opportunities and organise bidding decisions. Every supplier must still confirm the issuing authority's eligibility requirements."},
  {question:"Does BidScope publish official tender documents?",answer:"BidScope organises public procurement information and links subscribed users to official sources where permitted. The issuing authority's current notice and documents always control the procurement process."},
];

export default async function TenderLanding({params}:Props){
  const page=resolve((await params).segments||[]);if(!page)notFound();
  const result=await listPublicTenders({limit:18,category:page.category,location:page.location});
  const crumbs=[{name:"Home",href:"/"},{name:"Tenders",href:"/tenders"},...(page.kind==="ghana"||page.kind==="location"?[{name:"Ghana",href:"/tenders/ghana"}]:[]),...(page.kind==="category"?[{name:tenderCategories[page.category!].name,href:page.path}]:[]),...(page.kind==="location"?[{name:tenderLocations[page.location!].name,href:page.path}]:[])];
  return <main className="min-h-screen bg-[#f7f4eb] text-[#17362d]"><ProcurementHeader/><section className="border-b border-[#17362d]/10 bg-[#103f32] text-white"><div className="mx-auto max-w-7xl px-5 py-12 sm:px-8"><Breadcrumbs items={crumbs}/><p className="mt-7 text-xs font-bold uppercase tracking-[.18em] text-[#8bd7b7]">Ghana procurement opportunities</p><h1 className="serif mt-4 max-w-4xl text-4xl leading-tight sm:text-6xl">{page.kind==="root"?"Find tenders and contract opportunities in Ghana.":page.kind==="ghana"?"Ghana tenders and procurement opportunities.":page.kind==="category"?tenderCategories[page.category!].title:`Tenders in ${tenderLocations[page.location!].name}, Ghana`}</h1><p className="mt-5 max-w-3xl text-lg leading-8 text-white/75">{page.intro}</p></div></section><div className="mx-auto max-w-7xl space-y-12 px-5 py-10 sm:px-8"><section><div className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-widest text-[#116149]">Live listings</p><h2 className="serif mt-2 text-3xl">Open opportunities</h2></div><p className="text-sm text-[#61736a]">{result.total.toLocaleString()} current result{result.total===1?"":"s"}</p></div><div className="mt-6"><TenderCards items={result.items}/></div></section><section><h2 className="serif text-3xl">Browse major tender categories</h2><nav className="mt-5 flex flex-wrap gap-2" aria-label="Tender categories">{Object.entries(tenderCategories).map(([slug,item])=><Link key={slug} href={`/tenders/${slug}`} className="rounded-full border border-[#17362d]/15 bg-white px-4 py-2 text-sm font-bold hover:border-[#116149] hover:text-[#116149]">{item.name}</Link>)}</nav></section><SeoCta/><Faqs items={faq}/></div><ProcurementFooter/></main>;
}

