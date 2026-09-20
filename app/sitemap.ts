import type {MetadataRoute} from "next";import {guides} from "@/lib/seo/resources";import {SITE_URL} from "@/lib/seo/site";import {listSeoInventory,tenderCategories,tenderLocations} from "@/lib/server/seo-opportunities";
const staticPaths=["","/opportunities","/tenders","/tenders/ghana","/public-tenders","/private-tenders","/for-buyers","/for-suppliers","/how-it-works","/resources","/services","/plans","/pricing","/about","/contact","/privacy","/terms","/cookies"];
export default async function sitemap():Promise<MetadataRoute.Sitemap>{
  const now=new Date();let inventory:Awaited<ReturnType<typeof listSeoInventory>>=[];try{inventory=await listSeoInventory()}catch{inventory=[]}
  const staticUrls=staticPaths.map(path=>({url:`${SITE_URL}${path}`,lastModified:now,changeFrequency:(path.includes("tender")||path==="/opportunities"?"daily":"weekly") as "daily"|"weekly",priority:path===""?1:path.includes("tender")||path==="/opportunities"?0.9:0.7}));
  const tenderUrls=inventory.map(item=>({url:`${SITE_URL}/opportunities/${item.slug}`,lastModified:item.published_at?new Date(item.published_at):now,changeFrequency:"weekly" as const,priority:0.7}));
  const ghana=inventory.filter(item=>item.country_code==="GH");
  const categoryUrls=Object.entries(tenderCategories).filter(([,category])=>ghana.filter(item=>category.terms.some(term=>`${item.title} ${item.summary||""} ${item.sector||""} ${item.category||""}`.toLowerCase().includes(term))).length>=3).map(([slug])=>({url:`${SITE_URL}/tenders/${slug}`,lastModified:now,changeFrequency:"daily" as const,priority:0.8}));
  const locationUrls=Object.entries(tenderLocations).filter(([,location])=>ghana.filter(item=>(item.region||"").toLowerCase().includes(location.name.toLowerCase())).length>=3).map(([slug])=>({url:`${SITE_URL}/tenders/ghana/${slug}`,lastModified:now,changeFrequency:"daily" as const,priority:0.8}));
  const guideUrls=guides.map(guide=>({url:`${SITE_URL}/resources/${guide.slug}`,lastModified:new Date(`${guide.updated}T00:00:00Z`),changeFrequency:"monthly" as const,priority:0.7}));
  return[...staticUrls,...categoryUrls,...locationUrls,...guideUrls,...tenderUrls];
}
