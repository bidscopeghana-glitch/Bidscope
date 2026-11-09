import {readFile,mkdir,writeFile,rename} from "node:fs/promises";
import path from "node:path";
import {randomUUID} from "node:crypto";
import {createCjTokenManager} from "./cj-auth.ts";
import {ApiError} from "../api-error.ts";
const directory=path.join(process.cwd(),".codex-tmp","commerce");
const credentialPath=path.join(directory,"cj-credential.json");
export function requireLocalCommerceSetup(request:Request){
 const url=new URL(request.url),host=request.headers.get("host"),origin=request.headers.get("origin");
 // Next may normalise Request.url to localhost while the browser uses 127.0.0.1.
 // Validate both loopback hostnames, then bind CSRF to the actual Host header.
 if(process.env.BIDSCOPE_COMMERCE_LOCAL_SETUP!=="1"||!["127.0.0.1","localhost","[::1]"].includes(url.hostname)||!host||!/^(localhost|127\.0\.0\.1|\[::1\])(?::\d{1,5})?$/.test(host))throw new ApiError(404,"Local setup is unavailable.","local_setup_unavailable");
 if(request.method!=="GET"&&(origin!==url.protocol+"//"+host||request.headers.get("content-type")?.split(";")[0]!=="application/json"))throw new ApiError(403,"Same-origin local setup is required.","local_setup_origin_denied");
}
async function configuredKey(){
 if(process.env.CJ_API_KEY?.trim())return process.env.CJ_API_KEY.trim();
 if(process.env.BIDSCOPE_COMMERCE_LOCAL_SETUP==="1"){
  try{const data=JSON.parse(await readFile(credentialPath,"utf8"));return typeof data.apiKey==="string"?data.apiKey:"";}catch{return "";}
 }
 return "";
}
export const cjConnection=createCjTokenManager(configuredKey);
export async function cjConnectionStatus(){
 return {provider:"cj",configured:Boolean(await configuredKey()),...cjConnection.status(),mode:"sandbox",publicationApproval:"unverified",ghanaShipping:"unverified",liveCheckout:false};
}
export async function saveLocalCjCredential(apiKey:string){
 const candidate=createCjTokenManager(async()=>apiKey);
 const token=await candidate.token();
 await mkdir(directory,{recursive:true,mode:0o700});
 const temporary=path.join(directory,"cj-"+randomUUID()+".tmp");
 await writeFile(temporary,JSON.stringify({apiKey,createdAt:new Date().toISOString()}),{mode:0o600,flag:"wx"});
 await rename(temporary,credentialPath);
 cjConnection.clear();
 return {configured:true,verified:true,expiresAt:token.accessTokenExpiryDate,mode:"sandbox",liveCheckout:false,publicationApproval:"unverified",ghanaShipping:"unverified"};
}
