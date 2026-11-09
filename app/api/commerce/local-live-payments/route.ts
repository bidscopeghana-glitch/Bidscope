import {z} from "zod";
import {requireLocalCommerceSetup} from "@/lib/server/commerce/cj-connection";
import {commerceLiveStatus,saveCommerceLiveKey} from "@/lib/server/commerce/paystack-live";
import {ApiError,apiErrorResponse} from "@/lib/server/api-error";
const headers={"Cache-Control":"no-store"};
export async function GET(request:Request){try{requireLocalCommerceSetup(request);return Response.json(await commerceLiveStatus(),{headers});}catch(error){return apiErrorResponse(error);}}
let pending=false;
export async function POST(request:Request){
 let acquired=false;
 try{
  requireLocalCommerceSetup(request);
  if(pending)throw new ApiError(429,"A live-key connection check is already running.");
  if(Number(request.headers.get("content-length")||0)>2048)throw new ApiError(413,"Request is too large.");
  const text=await request.text();if(text.length>2048)throw new ApiError(413,"Request is too large.");
  let raw:unknown;try{raw=JSON.parse(text);}catch{throw new ApiError(400,"Valid JSON is required.");}
  const input=z.object({key:z.string().regex(/^sk_live_[A-Za-z0-9]{20,200}$/)}).strict().parse(raw);
  if(pending)throw new ApiError(429,"A live-key connection check is already running.");
  pending=true;acquired=true;
  try{return Response.json(await saveCommerceLiveKey(input.key),{headers});}catch{throw new ApiError(400,"The live key could not be verified and saved. Check the key and try again. No transaction or setting change was made.","live_key_connection_failed");}
 }catch(error){return apiErrorResponse(error);}finally{if(acquired)pending=false;}
}
