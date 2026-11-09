import {readFile} from "node:fs/promises";
import path from "node:path";
import {requireLocalCommerceSetup} from "@/lib/server/commerce/cj-connection";
import {cjPreviewFeedSchema} from "@/lib/commerce/cj-preview";
import {apiErrorResponse} from "@/lib/server/api-error";
export async function GET(request:Request){
 try{requireLocalCommerceSetup(request);}catch(error){return apiErrorResponse(error);}
 try{
  const data=cjPreviewFeedSchema.parse(JSON.parse(await readFile(path.join(process.cwd(),".codex-tmp","commerce","cj-preview.json"),"utf8")));
  return Response.json(data,{headers:{"Cache-Control":"no-store"}});
 }catch{return Response.json({mode:"private_cj_preview",items:[]},{headers:{"Cache-Control":"no-store"}});}
}
