import { apiErrorResponse } from "@/lib/server/api-error";
import { requireUser } from "@/lib/server/auth";
import { supabaseRest } from "@/lib/server/supabase-rest";
import { isFormattingOnlyTenderAmendment } from "@/lib/customer-dashboard";

export const dynamic = "force-dynamic";

type NotificationRow = { type: string; message: string; read_at: string | null } & Record<string, unknown>;

export async function GET(request:Request) {
  try { const { user }=await requireUser(request); const url=new URL(request.url); const type=url.searchParams.get("type"); const unread=url.searchParams.get("unread")==="true"; const requestedLimit=Number(url.searchParams.get("limit")||100); const limit=Number.isFinite(requestedLimit)?Math.min(100,Math.max(1,Math.floor(requestedLimit))):100; const params=new URLSearchParams({select:"*",user_id:`eq.${user.id}`,dismissed_at:"is.null",order:"created_at.desc",limit:String(limit)}); if(type&&type!=="all")params.set("type",`eq.${type}`); if(unread)params.set("read_at","is.null"); const {data:rows}=await supabaseRest<NotificationRow[]>(`notifications?${params}`); const data=rows.filter(row=>!isFormattingOnlyTenderAmendment(row)); const {data:unreadRows}=await supabaseRest<NotificationRow[]>(`notifications?select=type,message,read_at&user_id=eq.${user.id}&read_at=is.null&dismissed_at=is.null&limit=1000`); const unreadCount=unreadRows.filter(row=>!isFormattingOnlyTenderAmendment(row)).length; return Response.json({data,unreadCount}); }
  catch(error){return apiErrorResponse(error);}
}

export async function PATCH(request:Request) {
  try { const {user}=await requireUser(request); const body=await request.json() as {markAllRead?:boolean}; if(!body.markAllRead)return Response.json({error:"markAllRead is required."},{status:400}); await supabaseRest(`notifications?user_id=eq.${user.id}&read_at=is.null`,{method:"PATCH",body:JSON.stringify({read_at:new Date().toISOString()})}); return Response.json({data:{updated:true}}); }
  catch(error){return apiErrorResponse(error);}
}
