import {requireSuperAdmin} from "@/lib/server/auth";
import {supabaseRest} from "@/lib/server/supabase-rest";
import {apiErrorResponse} from "@/lib/server/api-error";
import {hostedCatalogueQuery,hostedCatalogueItem} from "@/lib/server/commerce/hosted-catalogue";
export async function GET(request:Request){try{
 // Draft access always uses existing BidScope administrator authentication.
 // Vercel preview protection alone is never treated as an application role.
 await requireSuperAdmin(request);
 const {input,path}=hostedCatalogueQuery(Object.fromEntries(new URL(request.url).searchParams));
 const {data,response}=await supabaseRest<Record<string,unknown>[]>(path,{count:"exact"});
 const count=Number(response.headers.get("content-range")?.split("/")[1]||0);
 const items=data.map(hostedCatalogueItem);
 return Response.json({items,total:count,imported:input.q||input.category||input.id?null:count,page:input.page,pageSize:24,categories:[...new Set(items.map(item=>item.category))],progress:null,workerActive:false,mode:"hosted_admin_drafts",checkoutEnabled:false},{headers:{"Cache-Control":"private, no-store","Vary":"Authorization"}});
 }catch(error){return apiErrorResponse(error);}}
