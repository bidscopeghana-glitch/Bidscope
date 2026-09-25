import { apiErrorResponse } from "@/lib/server/api-error";
import { requireOrganizationMember,requireUser } from "@/lib/server/auth";
import { supplierDocumentSchema } from "@/lib/server/schemas";
import { supabaseRest } from "@/lib/server/supabase-rest";
export const dynamic="force-dynamic";
export async function GET(request:Request){
  try{
    const{user}=await requireUser(request);
    const organizationId=new URL(request.url).searchParams.get("organizationId");
    if(!organizationId||!/^[a-f0-9-]{36}$/i.test(organizationId))return Response.json({error:"A valid organizationId is required."},{status:400});
    const membership=await requireOrganizationMember(user.id,organizationId);
    type Row={id:string;uploaded_by:string;[key:string]:unknown};
    const{data}=await supabaseRest<Row[]>(`supplier_documents?select=id,document_type,title,storage_path,source_url,issued_at,expires_at,verification_status,created_at,uploaded_by,metadata&organization_id=eq.${organizationId}&order=created_at.desc`);
    const ids=[...new Set(data.map(item=>item.uploaded_by))];
    const profiles=ids.length?(await supabaseRest<Array<{id:string;full_name:string|null;email:string|null}>>(`profiles?select=id,full_name,email&id=in.(${ids.join(",")})`)).data:[];
    const people=new Map(profiles.map(profile=>[profile.id,profile]));
    const canManageAll=["owner","admin"].includes(membership.role);
    return Response.json({data:data.map(item=>({...item,uploader:people.get(item.uploaded_by)?.full_name||people.get(item.uploaded_by)?.email||"Workspace member",can_manage:canManageAll||item.uploaded_by===user.id}))},{headers:{"Cache-Control":"private, no-store"}});
  }catch(error){return apiErrorResponse(error);}
}
export async function POST(request:Request){try{const{user}=await requireUser(request);const input=supplierDocumentSchema.parse(await request.json());await requireOrganizationMember(user.id,input.organizationId);const{data}=await supabaseRest<unknown[]>("supplier_documents",{method:"POST",headers:{Prefer:"return=representation"},body:JSON.stringify({organization_id:input.organizationId,uploaded_by:user.id,document_type:input.documentType,title:input.title,source_url:input.sourceUrl||null,issued_at:input.issuedAt||null,expires_at:input.expiresAt||null,verification_status:"needs_review"})});return Response.json({data:data[0]},{status:201});}catch(error){return apiErrorResponse(error);}}
