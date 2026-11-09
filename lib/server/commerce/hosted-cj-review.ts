import {z} from "zod";
import {ApiError} from "../api-error.ts";
import type {CjDraft} from "./cj-catalogue.ts";

export const cjReviewInput=z.object({id:z.string().min(1).max(200).regex(/^[A-Za-z0-9_-]+$/)}).strict();
type Dependencies={exists:(id:string)=>Promise<boolean>;acquire:()=>Promise<string|null>;release:(lease:string)=>Promise<void>;product:(id:string)=>Promise<CjDraft>};
// No order, payment, publication or stock-reservation capability is exposed here.
export async function reviewHostedCjProduct(input:unknown,deps:Dependencies){
 const {id}=cjReviewInput.parse(input);
 if(!await deps.exists(id))throw new ApiError(404,"Product draft not found.","draft_not_found");
 const lease=await deps.acquire();
 if(!lease)throw new ApiError(429,"Another CJ review is in progress. Try again shortly.","cj_review_busy");
 try{
  const draft=await deps.product(id);
  if(draft.supplierId!==id)throw new ApiError(502,"CJ returned a different product.","cj_product_mismatch");
  return {product:draft,checkoutEnabled:false as const,stockVerified:false as const,shippingVerified:false as const};
 }finally{await deps.release(lease);}
}
