import {existsSync} from "node:fs";
import path from "node:path";
import {z} from "zod";
import {requireLocalCommerceSetup} from "@/lib/server/commerce/cj-connection";
import {openCatalogue} from "@/lib/server/commerce/catalogue-store";
import {apiErrorResponse} from "@/lib/server/api-error";
export async function GET(request:Request){
 try{requireLocalCommerceSetup(request);
  const url=new URL(request.url),page=z.coerce.number().int().min(1).max(5000).parse(url.searchParams.get("page")||1),q=z.string().max(100).parse(url.searchParams.get("q")||""),category=z.string().max(1000).parse(url.searchParams.get("category")||""),sort=z.enum(["featured","low","high"]).parse(url.searchParams.get("sort")||"featured");
  if(!existsSync(path.join(process.cwd(),".codex-tmp","commerce","catalogue.sqlite")))return Response.json({items:[],categories:[],imported:0,total:0,page,pageSize:24,progress:null,workerActive:false},{headers:{"Cache-Control":"no-store"}});
  const store=openCatalogue();try{return Response.json(store.search(q,category,page,sort),{headers:{"Cache-Control":"no-store"}});}finally{store.close();}
 }catch(error){return apiErrorResponse(error);}
}
