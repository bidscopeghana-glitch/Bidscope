import {randomUUID} from "node:crypto";
import {requireSuperAdmin} from "@/lib/server/auth";
import {ApiError,apiErrorResponse} from "@/lib/server/api-error";
import {supabaseRest,supabaseRpc} from "@/lib/server/supabase-rest";
import {publicationAction} from "@/lib/commerce/storefront";
import {hostedCatalogueQuery,hostedCatalogueItem} from "@/lib/server/commerce/hosted-catalogue";
import {validReviewExpiry} from "@/lib/server/commerce/storefront";
import {reviewHostedCjProduct} from "@/lib/server/commerce/hosted-cj-review";
import {createCjCatalogueInspector} from "@/lib/server/commerce/cj-catalogue";
import {cjConnection} from "@/lib/server/commerce/cj-connection";
export const runtime="nodejs";
export const maxDuration=60;
export async function GET(request:Request){try{
 await requireSuperAdmin(request);
 if(process.env.BIDSCOPE_SHOP_PUBLICATIONS_READY!=="1")return Response.json({items:[],configured:false},{headers:{"Cache-Control":"private, no-store"}});
 const {data}=await supabaseRest<unknown[]>("bidscope_shop_publications?select=product_id,title,status,rights_evidence,media_evidence,approved_at,review_expires_at&order=approved_at.desc&limit=100");
 return Response.json({items:data,configured:true},{headers:{"Cache-Control":"private, no-store"}});
 }catch(error){return apiErrorResponse(error);}}
export async function POST(request:Request){try{
 const {user}=await requireSuperAdmin(request);
 if(request.headers.get("origin")!==new URL(request.url).origin||request.headers.get("content-type")?.split(";")[0]!=="application/json")throw new ApiError(403,"Same-origin JSON required.");
 if(process.env.BIDSCOPE_SHOP_PUBLICATIONS_READY!=="1")throw new ApiError(503,"Publication storage has not been activated.");
 const body=await request.text();if(body.length>18000)throw new ApiError(413,"Request too large.");
 const input=publicationAction.parse(JSON.parse(body));
 if(input.action==="retire")await supabaseRpc("bidscope_shop_retire_publication",{p_actor:user.id,p_product:input.productId,p_reason:input.reason});
 else{
  let expiry:string;try{expiry=validReviewExpiry(input.reviewExpiresAt);}catch{throw new ApiError(400,"Set a rights-review expiry within one year.");}
  if(process.env.BIDSCOPE_CJ_HOSTED_REVIEW!=="1"||!process.env.CJ_API_KEY?.trim())throw new ApiError(503,"The CJ server connection is not configured.");
  const {path}=hostedCatalogueQuery({id:input.productId});
  const {data}=await supabaseRest<Record<string,unknown>[]>(path);if(data.length!==1)throw new ApiError(404,"Imported draft not found.");
  const saved=hostedCatalogueItem(data[0]);
  const {product}=await reviewHostedCjProduct({id:input.productId},{exists:async()=>true,
   async acquire(){const lease=randomUUID();const {data}=await supabaseRpc<boolean>("bidscope_cj_review_acquire",{p_lease:lease});return data?lease:null;},
   async release(lease){await supabaseRpc("bidscope_cj_review_release",{p_lease:lease});},
   product:id=>createCjCatalogueInspector(()=>cjConnection.token()).product(id),
  });
  await supabaseRpc("bidscope_shop_publish",{p_actor:user.id,p_product:input.productId,p_details:{title:product.name,description:input.description,category:saved.category,image:saved.image,origin:input.origin,snapshot:product,minUsdMinor:Math.min(...product.variants.map(v=>v.costUsdMinor)),checkedAt:product.checkedAt,rightsEvidence:input.rightsEvidence,mediaEvidence:input.mediaEvidence,reviewExpiresAt:expiry}});
 }
 return Response.json({saved:true,checkoutEnabled:false},{headers:{"Cache-Control":"private, no-store"}});
 }catch(error){return apiErrorResponse(error);}}
