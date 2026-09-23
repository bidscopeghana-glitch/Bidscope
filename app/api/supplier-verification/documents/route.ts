import { randomUUID } from "node:crypto";
import { ApiError, apiErrorResponse } from "@/lib/server/api-error";
import { requireOrganizationMember, requireSuperAdmin, requireUser } from "@/lib/server/auth";
import { documentRisk, getVerificationRequest, sha256, verificationAudit } from "@/lib/server/supplier-verification";
import { supabaseConfiguration, supabaseRest } from "@/lib/server/supabase-rest";

export const dynamic="force-dynamic";
const bucket="supplier-verification-private";
const allowed=new Set(["application/pdf","image/png","image/jpeg"]);
// Keep the multipart request below Vercel's standard function-body limit.
const maxBytes=4*1024*1024;

export async function POST(request:Request){
  try{
    const {user}=await requireUser(request);
    const form=await request.formData();
    const requestId=String(form.get("requestId")||"");
    const documentType=String(form.get("documentType")||"").trim().slice(0,80);
    const file=form.get("file");
    if(!/^[a-f0-9-]{36}$/i.test(requestId)||!documentType||!(file instanceof File))throw new ApiError(400,"Select an application, document type and file.","invalid_document_upload");
    if(!allowed.has(file.type)||file.size<1||file.size>maxBytes)throw new ApiError(400,"Upload a PDF, PNG or JPEG under 4 MB.","invalid_document_type");
    const application=await getVerificationRequest(requestId);
    await requireOrganizationMember(user.id,application.organization_id);
    if(!["draft","awaiting_payment","paid","information_required"].includes(application.status))throw new ApiError(409,"Documents cannot be changed during review.","verification_document_locked");
    const bytes=new Uint8Array(await file.arrayBuffer());
    const digest=sha256(bytes);
    const {data:duplicates}=await supabaseRest<Array<{organization_id:string}>>(`supplier_verification_documents?select=organization_id&sha256=eq.${digest}&organization_id=neq.${application.organization_id}&limit=1`);
    const integrity=documentRisk(bytes,file.type,duplicates.length>0);
    const path=`${application.organization_id}/${application.id}/${randomUUID()}`;
    const {url,serviceKey}=supabaseConfiguration();
    if(!serviceKey)throw new ApiError(503,"Private document storage is unavailable.","storage_unavailable");
    const stored=await fetch(`${url}/storage/v1/object/${bucket}/${path}`,{method:"POST",headers:{apikey:serviceKey,Authorization:`Bearer ${serviceKey}`,"Content-Type":file.type,"x-upsert":"false"},body:bytes});
    if(!stored.ok)throw new ApiError(503,"The document could not be stored privately.","storage_upload_failed");
    const {data:rows}=await supabaseRest<Array<{id:string}>>("supplier_verification_documents",{method:"POST",headers:{Prefer:"return=representation"},body:JSON.stringify({request_id:application.id,organization_id:application.organization_id,document_type:documentType,original_filename:file.name.slice(0,180),mime_type:file.type,size_bytes:file.size,storage_path:path,sha256:digest,risk_level:integrity.risk,integrity_flags:integrity.flags,uploaded_by:user.id})});
    await supabaseRest(`supplier_verification_requests?id=eq.${application.id}`,{method:"PATCH",body:JSON.stringify({risk_level:integrity.risk})});
    await verificationAudit(application,user.id,"document_uploaded",{document_id:rows[0].id,document_type:documentType,sha256:digest,risk_level:integrity.risk,flags:integrity.flags});
    return Response.json({data:{id:rows[0].id,documentType,riskLevel:integrity.risk,flags:integrity.flags,message:integrity.risk==="low"?"No obvious file-signature or cross-account duplicate issue detected; authenticity still requires review.":"This document needs manual review."}},{status:201});
  }catch(error){return apiErrorResponse(error);}
}

export async function GET(request:Request){
  try{
    const {user}=await requireUser(request);
    const id=new URL(request.url).searchParams.get("id")||"";
    if(!/^[a-f0-9-]{36}$/i.test(id))throw new ApiError(400,"Document ID is required.","invalid_document_id");
    const {data:docs}=await supabaseRest<Array<{organization_id:string;storage_path:string;original_filename:string;mime_type:string}>>(`supplier_verification_documents?select=organization_id,storage_path,original_filename,mime_type&id=eq.${id}&limit=1`);
    const doc=docs[0];if(!doc)throw new ApiError(404,"Document not found.","document_not_found");
    try{await requireOrganizationMember(user.id,doc.organization_id);}catch{await requireSuperAdmin(request);}
    const {url,serviceKey}=supabaseConfiguration();if(!serviceKey)throw new ApiError(503,"Private storage is unavailable.","storage_unavailable");
    const stored=await fetch(`${url}/storage/v1/object/${bucket}/${doc.storage_path}`,{headers:{apikey:serviceKey,Authorization:`Bearer ${serviceKey}`},cache:"no-store"});
    if(!stored.ok)throw new ApiError(404,"The private document is unavailable.","document_missing");
    return new Response(stored.body,{headers:{"Content-Type":doc.mime_type,"Content-Disposition":`attachment; filename*=UTF-8''${encodeURIComponent(doc.original_filename)}`,"Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff"}});
  }catch(error){return apiErrorResponse(error);}
}
