import {z} from "zod";
import {apiErrorResponse} from "@/lib/server/api-error";
import {requireLocalCommerceSetup,cjConnectionStatus,saveLocalCjCredential,cjConnection} from "@/lib/server/commerce/cj-connection";
export async function GET(request:Request){try{requireLocalCommerceSetup(request);return Response.json(await cjConnectionStatus(),{headers:{"Cache-Control":"no-store"}});}catch(error){return apiErrorResponse(error);}}
export async function POST(request:Request){let stage="local_policy";try{
 requireLocalCommerceSetup(request);
 stage="input_validation";
 if(Number(request.headers.get("content-length")||0)>4096)return Response.json({error:"Request too large."},{status:413});
 const input=z.discriminatedUnion("action",[z.object({action:z.literal("connect"),apiKey:z.string().trim().min(10).max(1024)}),z.object({action:z.literal("test")})]).parse(await request.json());
 stage="provider_verification_or_local_storage";
 if(input.action==="test"){await cjConnection.token();return Response.json(await cjConnectionStatus(),{headers:{"Cache-Control":"no-store"}});}
 return Response.json(await saveLocalCjCredential(input.apiKey),{headers:{"Cache-Control":"no-store"}});
 }catch(error){if(stage==="local_policy")return apiErrorResponse(error);return Response.json({error:"CJ connection could not be verified. Check the key and try again later. No credentials are returned.",stage},{status:400});}}
