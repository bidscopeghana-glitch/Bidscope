import {ApiError} from "../api-error";
import {supabaseConfiguration} from "../supabase-rest";

const bucket="outreach-imports";
function config(){const{url,serviceKey}=supabaseConfiguration();if(!serviceKey)throw new ApiError(503,"Outreach file storage is not configured.","outreach_not_configured");return{url,serviceKey};}
export async function uploadOutreachFile(path:string,buffer:Buffer,contentType:string){const{url,serviceKey}=config();const response=await fetch(`${url}/storage/v1/object/${bucket}/${path}`,{method:"POST",headers:{apikey:serviceKey,Authorization:`Bearer ${serviceKey}`,"Content-Type":contentType,"x-upsert":"false"},body:new Uint8Array(buffer)});if(!response.ok)throw new ApiError(503,"The prospect file could not be stored.","storage_upload_failed");}
export async function downloadOutreachFile(path:string){const{url,serviceKey}=config();const response=await fetch(`${url}/storage/v1/object/${bucket}/${path}`,{headers:{apikey:serviceKey,Authorization:`Bearer ${serviceKey}`},cache:"no-store"});if(!response.ok)throw new ApiError(404,"The prospect source file is unavailable.","storage_file_missing");return Buffer.from(await response.arrayBuffer());}
