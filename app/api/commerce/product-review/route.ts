import {randomUUID} from "node:crypto";
import {setTimeout as pause} from "node:timers/promises";
import {requireSuperAdmin} from "@/lib/server/auth";
import {ApiError,apiErrorResponse} from "@/lib/server/api-error";
import {supabaseRest,supabaseRpc} from "@/lib/server/supabase-rest";
import {hostedCatalogueQuery} from "@/lib/server/commerce/hosted-catalogue";
import {reviewHostedCjProduct} from "@/lib/server/commerce/hosted-cj-review";
import {cjConnection} from "@/lib/server/commerce/cj-connection";
import {createCjCatalogueInspector,CjReadError} from "@/lib/server/commerce/cj-catalogue";

export const runtime="nodejs";
export const maxDuration=60;
export async function POST(request:Request){try{
 await requireSuperAdmin(request);
 if(request.headers.get("origin")!==new URL(request.url).origin||request.headers.get("content-type")?.split(";")[0]!=="application/json")throw new ApiError(403,"Same-origin JSON requests are required.","origin_denied");
 if(process.env.BIDSCOPE_CJ_HOSTED_REVIEW!=="1"||!process.env.CJ_API_KEY?.trim())throw new ApiError(503,"Hosted CJ review is not configured yet. Saved drafts remain available.","cj_review_unconfigured");
 const input=await request.json().catch(()=>{throw new ApiError(400,"Invalid JSON.","invalid_json");});
 const result=await reviewHostedCjProduct(input,{
  async exists(id){const {path}=hostedCatalogueQuery({id});const {data}=await supabaseRest<unknown[]>(path);return data.length===1;},
  async acquire(){const lease=randomUUID();const {data}=await supabaseRpc<boolean>("bidscope_cj_review_acquire",{p_lease:lease});return data?lease:null;},
  async release(lease){await supabaseRpc("bidscope_cj_review_release",{p_lease:lease});},
  async product(id){try{return await createCjCatalogueInspector(async()=>{const token=await cjConnection.token();await pause(1100);return token;}).product(id);}catch(error){throw new ApiError(503,error instanceof CjReadError?error.message:"CJ could not complete the product review. Try again later.","cj_review_failed");}}
 });
 return Response.json(result,{headers:{"Cache-Control":"private, no-store","Vary":"Authorization"}});
 }catch(error){const response=apiErrorResponse(error);response.headers.set("Cache-Control","private, no-store");if(response.status===429)response.headers.set("Retry-After","90");return response;}}
