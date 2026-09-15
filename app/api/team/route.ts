import {createHash,randomBytes} from "node:crypto";
import {z} from "zod";
import {ApiError,apiErrorResponse} from "@/lib/server/api-error";
import {requireOrganizationMember,requireUser} from "@/lib/server/auth";
import {getEntitlement,getPlanLimit,primaryOrganization} from "@/lib/server/entitlements";
import {supabaseRest} from "@/lib/server/supabase-rest";

export const dynamic="force-dynamic";
const hash=(token:string)=>createHash("sha256").update(token).digest("hex");

async function usage(organizationId:string){
  const[{response:members},{response:pending}]=await Promise.all([
    supabaseRest(`organization_members?select=user_id&organization_id=eq.${organizationId}`,{count:"exact"}),
    supabaseRest(`organization_invitations?select=id&organization_id=eq.${organizationId}&status=eq.pending&expires_at=gt.${new Date().toISOString()}`,{count:"exact"}),
  ]);
  return{members:Number(members.headers.get("content-range")?.split("/")[1]||0),pending:Number(pending.headers.get("content-range")?.split("/")[1]||0)};
}

export async function GET(request:Request){
  try{
    const{user}=await requireUser(request);
    const membership=await primaryOrganization(user.id);
    if(!membership)return Response.json({data:{organizationId:null,members:[],invitations:[],used:0,limit:0,canManage:false}});
    const entitlement=await getEntitlement(membership.organization_id,user);
    const[{data:members},{data:invitations},counts]=await Promise.all([
      supabaseRest<Array<{user_id:string;role:string;created_at:string}>>(`organization_members?select=user_id,role,created_at&organization_id=eq.${membership.organization_id}&order=created_at.asc`),
      supabaseRest<Array<{id:string;email:string;role:string;status:string;expires_at:string;created_at:string}>>(`organization_invitations?select=id,email,role,status,expires_at,created_at&organization_id=eq.${membership.organization_id}&status=eq.pending&order=created_at.desc`),
      usage(membership.organization_id),
    ]);
    const ids=members.map(item=>item.user_id);
    const{data:profiles}=ids.length?await supabaseRest<Array<{id:string;email:string;full_name:string}>>(`profiles?select=id,email,full_name&id=in.(${ids.join(",")})`):{data:[]};
    const byId=new Map(profiles.map(profile=>[profile.id,profile]));
    return Response.json({data:{organizationId:membership.organization_id,members:members.map(member=>({...member,profile:byId.get(member.user_id)||null})),invitations,used:counts.members+counts.pending,limit:Math.max(1,getPlanLimit(entitlement,"team_seats")),canManage:["owner","admin"].includes(membership.role)}});
  }catch(error){return apiErrorResponse(error);}
}

export async function POST(request:Request){
  try{
    const{user}=await requireUser(request);
    const body=z.discriminatedUnion("action",[
      z.object({action:z.literal("invite"),organizationId:z.string().uuid(),email:z.string().trim().toLowerCase().email().max(320),role:z.enum(["admin","member"]).default("member")}),
      z.object({action:z.literal("accept"),token:z.string().min(32).max(256)}),
    ]).parse(await request.json());
    if(body.action==="accept"){
      const tokenHash=hash(body.token);
      const{data}=await supabaseRest<Array<{id:string;organization_id:string;email:string;role:string;status:string;expires_at:string}>>(`organization_invitations?select=*&token_hash=eq.${tokenHash}&status=eq.pending&limit=1`);
      const invitation=data[0];
      if(!invitation||Date.parse(invitation.expires_at)<=Date.now())throw new ApiError(400,"This invitation is invalid or has expired.","invalid_invitation");
      if(invitation.email!==user.email.toLowerCase())throw new ApiError(403,"Sign in with the email address that received this invitation.","invitation_email_mismatch");
      const entitlement=await getEntitlement(invitation.organization_id,user);
      const counts=await usage(invitation.organization_id);
      if(counts.members>=Math.max(1,getPlanLimit(entitlement,"team_seats")))throw new ApiError(402,"This workspace has reached its team-seat limit.","plan_limit_reached");
      await supabaseRest("organization_members?on_conflict=organization_id,user_id",{method:"POST",headers:{Prefer:"resolution=merge-duplicates"},body:JSON.stringify({organization_id:invitation.organization_id,user_id:user.id,role:invitation.role})});
      await supabaseRest(`organization_invitations?id=eq.${invitation.id}`,{method:"PATCH",body:JSON.stringify({status:"accepted",accepted_by:user.id,accepted_at:new Date().toISOString()})});
      return Response.json({data:{accepted:true}});
    }
    const membership=await requireOrganizationMember(user.id,body.organizationId);
    if(!["owner","admin"].includes(membership.role))throw new ApiError(403,"Only workspace owners and administrators can invite teammates.","forbidden");
    const entitlement=await getEntitlement(body.organizationId,user);
    const limit=Math.max(1,getPlanLimit(entitlement,"team_seats"));
    const counts=await usage(body.organizationId);
    if(counts.members+counts.pending>=limit)throw new ApiError(402,`Your plan supports ${limit} team seat${limit===1?"":"s"}. Upgrade to invite another teammate.`,"plan_limit_reached");
    if(!process.env.RESEND_API_KEY||!process.env.ALERT_FROM_EMAIL)throw new ApiError(503,"Team invitation email is not configured.","email_configuration_required");
    const token=randomBytes(32).toString("base64url");
    const{data}=await supabaseRest<Array<{id:string}>>("organization_invitations",{method:"POST",headers:{Prefer:"return=representation"},body:JSON.stringify({organization_id:body.organizationId,email:body.email,role:body.role,token_hash:hash(token),invited_by:user.id})});
    const site=process.env.NEXT_PUBLIC_SITE_URL||"https://www.bidscopeghana.com";
    const inviteUrl=new URL("/customer/team",site);
    inviteUrl.searchParams.set("invite",token);
    const response=await fetch("https://api.resend.com/emails",{method:"POST",headers:{Authorization:`Bearer ${process.env.RESEND_API_KEY}`,"Content-Type":"application/json"},body:JSON.stringify({from:process.env.ALERT_FROM_EMAIL,to:[body.email],subject:"You have been invited to a BidScope workspace",html:`<div style="font-family:Arial,sans-serif;color:#17362d"><h2>Join the BidScope workspace</h2><p>You were invited as ${body.role}.</p><p><a href="${inviteUrl.toString()}">Accept invitation</a></p><p>This secure link expires in 7 days.</p></div>`})});
    if(!response.ok){
      await supabaseRest(`organization_invitations?id=eq.${data[0]?.id}`,{method:"DELETE"});
      throw new ApiError(502,"The invitation email could not be sent.","email_delivery_failed");
    }
    return Response.json({data:{invited:true}},{status:201});
  }catch(error){return apiErrorResponse(error);}
}

export async function DELETE(request:Request){
  try{
    const{user}=await requireUser(request);
    const id=z.string().uuid().parse(new URL(request.url).searchParams.get("id"));
    const{data}=await supabaseRest<Array<{organization_id:string}>>(`organization_invitations?select=organization_id&id=eq.${id}&status=eq.pending&limit=1`);
    if(!data[0])throw new ApiError(404,"Invitation not found.","not_found");
    const membership=await requireOrganizationMember(user.id,data[0].organization_id);
    if(!["owner","admin"].includes(membership.role))throw new ApiError(403,"Only workspace owners and administrators can revoke invitations.","forbidden");
    await supabaseRest(`organization_invitations?id=eq.${id}`,{method:"PATCH",body:JSON.stringify({status:"revoked"})});
    return new Response(null,{status:204});
  }catch(error){return apiErrorResponse(error);}
}
