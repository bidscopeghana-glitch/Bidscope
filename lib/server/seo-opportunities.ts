import "server-only";
import {cache} from "react";
import {guestOpportunityPreview,type GuestOpportunityInput} from "@/lib/server/procurement/guest-preview";
import {supabaseRest} from "@/lib/server/supabase-rest";

const fields="slug,title,summary,buyer_name,source_name,country,country_code,region,sector,category,published_at,deadline_at,status,estimated_value,currency,contract_type,procurement_method";
export type PublicTender=ReturnType<typeof guestOpportunityPreview>;

export const tenderCategories={
  construction:{name:"Construction",title:"Construction Tenders and Contract Opportunities in Ghana",intro:"Find current construction, civil works, building, road and infrastructure tender opportunities relevant to businesses operating in Ghana.",terms:["construction","works","building","road","civil"]},
  ict:{name:"ICT / Technology",title:"ICT and Technology Tenders in Ghana",intro:"Explore technology, software, hardware, connectivity, digital transformation and ICT service opportunities published for suppliers in Ghana.",terms:["ict","technology","software","computer","digital"]},
  healthcare:{name:"Healthcare / Medical",title:"Healthcare and Medical Tenders in Ghana",intro:"Review live opportunities involving medical supplies, health services, hospital equipment, pharmaceuticals and healthcare delivery.",terms:["health","medical","hospital","pharma"]},
  logistics:{name:"Logistics / Transport",title:"Logistics and Transport Tenders in Ghana",intro:"Discover transport, fleet, haulage, distribution, warehousing and logistics contract opportunities across Ghana.",terms:["logistics","transport","vehicle","haulage"]},
  consulting:{name:"Consultancy",title:"Consultancy Opportunities in Ghana",intro:"Find advisory, research, training, technical assistance and professional consultancy assignments from public and development-funded buyers.",terms:["consult","advisory","technical assistance","research"]},
  "professional-services":{name:"Professional Services",title:"Professional Services Tenders in Ghana",intro:"Explore legal, audit, accounting, communications, human resources and other specialist service opportunities.",terms:["professional","audit","legal","accounting","communications"]},
  supplies:{name:"Goods & Supplies",title:"Goods and Supply Contracts in Ghana",intro:"Find opportunities to supply equipment, consumables, materials and general goods to public and institutional buyers.",terms:["goods","supply","supplies","equipment","consumables"]},
  engineering:{name:"Engineering",title:"Engineering Tenders and Contracts in Ghana",intro:"Review mechanical, electrical, structural, water and specialist engineering procurement opportunities.",terms:["engineering","mechanical","electrical","structural"]},
  education:{name:"Education",title:"Education Tenders in Ghana",intro:"Discover procurement opportunities for schools, universities, training programmes, learning materials and education services.",terms:["education","school","training","university"]},
  agriculture:{name:"Agriculture",title:"Agriculture Tenders and Opportunities in Ghana",intro:"Find agricultural inputs, food systems, irrigation, agribusiness and rural development procurement opportunities.",terms:["agriculture","agricultural","farming","irrigation"]},
  security:{name:"Security",title:"Security Services and Equipment Tenders in Ghana",intro:"Explore security services, surveillance, protective equipment and related procurement opportunities.",terms:["security","surveillance","guard"]},
  "facilities-management":{name:"Facilities Management",title:"Facilities Management Tenders in Ghana",intro:"Find cleaning, maintenance, property support, utilities and facilities-management contract opportunities.",terms:["facilities","cleaning","maintenance","property"]},
} as const;
export type TenderCategorySlug=keyof typeof tenderCategories;

export const tenderLocations={
  "greater-accra":{name:"Greater Accra",intro:"Live tender and contract opportunities published for work, delivery or services in Greater Accra."},
  ashanti:{name:"Ashanti",intro:"Current public procurement and contract opportunities available across the Ashanti Region."},
  northern:{name:"Northern",intro:"Tender and supplier opportunities for projects and services in Ghana's Northern Region."},
  eastern:{name:"Eastern",intro:"Browse open procurement opportunities relevant to suppliers and contractors in the Eastern Region."},
  western:{name:"Western",intro:"Find current tender and contract opportunities for businesses serving Ghana's Western Region."},
} as const;
export type TenderLocationSlug=keyof typeof tenderLocations;

function filterOr(terms:readonly string[]){return `(${terms.flatMap(term=>["title","summary","sector","category"].map(field=>`${field}.ilike.*${term.replace(/[,*()]/g," ")}*`)).join(",")})`;}
function baseParams(limit:number,offset=0){return new URLSearchParams({select:fields,source_removed_at:"is.null",published_at:"not.is.null",status:"in.(OPEN,CLOSING_SOON)",order:"deadline_at.asc.nullslast",limit:String(limit),offset:String(offset)});}

export const getPublicTender=cache(async(slug:string):Promise<PublicTender|null>=>{
  const params=new URLSearchParams({select:fields,slug:`eq.${slug.slice(0,220)}`,source_removed_at:"is.null",published_at:"not.is.null",status:"neq.DRAFT",limit:"1"});
  const{data}=await supabaseRest<GuestOpportunityInput[]>(`procurement_opportunities?${params}`);
  return data[0]?guestOpportunityPreview(data[0]):null;
});

export async function listPublicTenders(input:{limit?:number;offset?:number;category?:TenderCategorySlug;location?:TenderLocationSlug;ghanaOnly?:boolean;excludeSlug?:string}={}){
  const params=baseParams(Math.min(input.limit||12,50),input.offset||0);
  if(input.ghanaOnly!==false)params.set("country_code","eq.GH");
  if(input.category)params.set("or",filterOr(tenderCategories[input.category].terms));
  if(input.location)params.set("region",`ilike.*${tenderLocations[input.location].name}*`);
  if(input.excludeSlug)params.set("slug",`neq.${input.excludeSlug}`);
  const{data,response}=await supabaseRest<GuestOpportunityInput[]>(`procurement_opportunities?${params}`,{count:"exact"});
  const total=Number(response.headers.get("content-range")?.split("/")[1]||data.length);
  return{items:data.map(guestOpportunityPreview),total:Number.isFinite(total)?total:data.length};
}

async function listIndexableRows<T extends{slug:string}>(select:string,limit:number){
  const requested=Math.max(0,Math.floor(limit));
  if(!requested)return[] as T[];
  const rows:T[]=[];
  const seen=new Set<string>();
  for(let offset=0;offset<requested;offset+=1000){
    const batchSize=Math.min(1000,requested-offset);
    const params=new URLSearchParams({select,source_removed_at:"is.null",published_at:"not.is.null",status:"not.in.(DRAFT,WITHDRAWN)",order:"published_at.desc,slug.asc",limit:String(batchSize),offset:String(offset)});
    const{data}=await supabaseRest<T[]>(`procurement_opportunities?${params}`);
    for(const row of data)if(!seen.has(row.slug)){seen.add(row.slug);rows.push(row)}
    if(data.length<batchSize)break;
  }
  return rows.slice(0,requested);
}

export async function listIndexableTenderSlugs(limit=5000){
  return listIndexableRows<{slug:string;published_at:string|null}>("slug,published_at",limit);
}

export async function listSeoInventory(limit=5000){
  return listIndexableRows<{slug:string;title:string;summary:string|null;sector:string|null;category:string|null;region:string|null;country_code:string|null;published_at:string|null}>("slug,title,summary,sector,category,region,country_code,published_at",limit);
}

export async function listRelatedTenders(tender:PublicTender,limit=4){
  const params=baseParams(limit+1);
  params.set("country_code",tender.country_code?`eq.${tender.country_code}`:"eq.GH");
  const category=String(tender.category||"").replace(/[,*()]/g," ").trim();
  const region=String(tender.region||"").replace(/[,*()]/g," ").trim();
  if(category||region)params.set("or",`(${[category?`category.eq.${category}`:"",region?`region.ilike.*${region}*`:""].filter(Boolean).join(",")})`);
  params.set("slug",`neq.${tender.slug}`);
  const{data}=await supabaseRest<GuestOpportunityInput[]>(`procurement_opportunities?${params}`);
  return data.slice(0,limit).map(guestOpportunityPreview);
}
