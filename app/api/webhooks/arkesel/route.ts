import { createHmac, timingSafeEqual } from "node:crypto";
import { supabaseRest } from "@/lib/server/supabase-rest";

export const dynamic="force-dynamic";

function equalSignature(expected:string,received:string){
  const a=Buffer.from(expected),b=Buffer.from(received.trim());
  return a.length===b.length&&timingSafeEqual(a,b);
}

function authorised(request:Request,rawBody:string){
  const secret=process.env.ARKESEL_WEBHOOK_SECRET;if(!secret)return false;
  const url=new URL(request.url);
  const callbackToken=url.searchParams.get("token")||"";
  const expectedToken=createHmac("sha256",secret).update("delivery-callback").digest("hex");
  const timestamp=request.headers.get("x-arkesel-webhook-timestamp")||"";
  const received=request.headers.get("x-arkesel-webhook-signature")||"";
  const webhookId=request.headers.get("x-arkesel-webhook-id")||"";
  if(!received)return Boolean(callbackToken&&equalSignature(expectedToken,callbackToken));
  const parsed=Number(timestamp);if(!Number.isFinite(parsed)||Math.abs(Date.now()-parsed*(parsed<10_000_000_000?1000:1))>5*60_000)return false;
  const content=rawBody||url.searchParams.toString();
  const signedValues=[`${timestamp}.${content}`,webhookId?`${webhookId}.${timestamp}.${content}`:"",webhookId?`${timestamp}.${webhookId}.${content}`:""].filter(Boolean);
  const receivedValues=received.split(/[ ,]+/).map(value=>value.replace(/^(?:sha256=|v1,?)/i,"")).filter(Boolean);
  return signedValues.some(value=>{const hex=createHmac("sha256",secret).update(value).digest("hex"),base64=createHmac("sha256",secret).update(value).digest("base64");return receivedValues.some(signature=>equalSignature(hex,signature)||equalSignature(base64,signature));});
}

async function handle(request:Request){
  const rawBody=request.method==="POST"?await request.text():"";
  if(!authorised(request,rawBody))return Response.json({error:"Invalid webhook signature."},{status:401});
  const url=new URL(request.url);let body:Record<string,unknown>={};
  if(rawBody){try{body=JSON.parse(rawBody) as Record<string,unknown>;}catch{return Response.json({error:"Invalid webhook payload."},{status:400});}}
  const smsId=String(body.sms_id||body.id||url.searchParams.get("sms_id")||url.searchParams.get("id")||"");
  const incoming=String(body.status||url.searchParams.get("status")||"").toUpperCase();
  if(!smsId||!incoming)return Response.json({error:"sms_id and status are required."},{status:400});
  const status=incoming==="DELIVERED"?"delivered":["NOT_DELIVERED","PROHIBITED","EXPIRED","FAILED","REJECTED"].includes(incoming)?"failed":["QUEUED","SUBMITTED","SENT"].includes(incoming)?"sent":null;
  if(!status)return Response.json({data:{accepted:false}},{status:202});
  const{data:logs}=await supabaseRest<Array<{id:string;delivery_id:string|null}>>(`sms_delivery_logs?select=id,delivery_id&provider_message_id=eq.${encodeURIComponent(smsId)}&limit=1`);
  const log=logs[0];if(!log)return Response.json({data:{accepted:false}},{status:202});
  const at=new Date().toISOString();
  await supabaseRest(`sms_delivery_logs?id=eq.${log.id}`,{method:"PATCH",body:JSON.stringify({status,delivered_at:status==="delivered"?at:null,error_code:status==="failed"?incoming:null})});
  if(log.delivery_id)await supabaseRest(`notification_deliveries?id=eq.${log.delivery_id}`,{method:"PATCH",body:JSON.stringify({status,failed_at:status==="failed"?at:null,failure_reason:status==="failed"?incoming:null})});
  return Response.json({data:{accepted:true}});
}

export async function GET(request:Request){return handle(request);}
export async function POST(request:Request){return handle(request);}
