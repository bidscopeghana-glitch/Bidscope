import {z} from "zod";
import {apiErrorResponse} from "@/lib/server/api-error";
import {requireLocalCommerceSetup,cjConnection} from "@/lib/server/commerce/cj-connection";
import {createCjCatalogueInspector} from "@/lib/server/commerce/cj-catalogue";
const inspector=createCjCatalogueInspector(()=>cjConnection.token());
let pending=false,lastRequest=0;
export async function POST(request:Request){
 let acquired=false;
 try{requireLocalCommerceSetup(request);}catch(error){return apiErrorResponse(error);}
 if(pending||Date.now()-lastRequest<1500)return Response.json({error:"Wait a moment before the next CJ check."},{status:429});
 if(Number(request.headers.get("content-length")||0)>2048)return Response.json({error:"Request too large."},{status:413});
 try{
  const id=z.string().trim().min(1).max(200).regex(/^[A-Za-z0-9_-]+$/);
  const input=z.discriminatedUnion("action",[z.object({action:z.literal("search"),keyword:z.string().trim().min(2).max(100)}),z.object({action:z.literal("product"),productId:id}),z.object({action:z.literal("shipping"),productId:id,variantId:id,origin:z.string().regex(/^[A-Z]{2}$/),quantity:z.number().int().min(1).max(999)})]).parse(await request.json());
  if(pending||Date.now()-lastRequest<1500)return Response.json({error:"Wait a moment before the next CJ check."},{status:429});
  pending=true;acquired=true;lastRequest=Date.now();
  const result=input.action==="search"?await inspector.search(input.keyword):input.action==="product"?await inspector.product(input.productId):await inspector.shipping(input.productId,input.variantId,input.origin,input.quantity);
  return Response.json(result,{headers:{"Cache-Control":"no-store"}});
 }catch{return Response.json({error:"CJ check failed. Verify the product, variant and origin; stock or Ghana shipping may be unavailable. Nothing was published or ordered."},{status:400});}
 finally{if(acquired)pending=false;}
}
