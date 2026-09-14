import { NextResponse } from "next/server";
import { supabaseConfiguration } from "@/lib/server/supabase-rest";

export const dynamic = "force-dynamic";

function safeMessage(status:number){
  if(status===429)return "Too many reset attempts. Please wait before trying again.";
  return "The account service could not process the request. Please try again.";
}

export async function POST(request:Request){
  try{
    const body=await request.json() as {email?:string};
    const email=body.email?.trim().toLowerCase();
    if(!email||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))return NextResponse.json({error:"Enter a valid email address."},{status:400});
    const{url,publicKey}=supabaseConfiguration();
    if(!publicKey)return NextResponse.json({error:"Account service is not configured."},{status:503});
    const siteUrl=(process.env.NEXT_PUBLIC_SITE_URL||new URL(request.url).origin).replace(/\/$/,"");
    const response=await fetch(`${url}/auth/v1/recover?redirect_to=${encodeURIComponent(`${siteUrl}/auth/reset-password`)}`,{method:"POST",headers:{apikey:publicKey,"Content-Type":"application/json"},body:JSON.stringify({email}),cache:"no-store"});
    if(!response.ok)return NextResponse.json({error:safeMessage(response.status)},{status:response.status});
    // Always use a non-enumerating response so this endpoint cannot reveal accounts.
    return NextResponse.json({message:"If that address has an account, a password reset link is on its way."});
  }catch{return NextResponse.json({error:"Account service is temporarily unavailable. Please try again."},{status:503});}
}

export async function PATCH(request:Request){
  try{
    const body=await request.json() as {accessToken?:string;password?:string};
    if(!body.accessToken)return NextResponse.json({error:"This reset link is invalid or has expired."},{status:401});
    if(!body.password||body.password.length<8)return NextResponse.json({error:"Password must contain at least 8 characters."},{status:400});
    const{url,publicKey}=supabaseConfiguration();
    if(!publicKey)return NextResponse.json({error:"Account service is not configured."},{status:503});
    const response=await fetch(`${url}/auth/v1/user`,{method:"PUT",headers:{apikey:publicKey,Authorization:`Bearer ${body.accessToken}`,"Content-Type":"application/json"},body:JSON.stringify({password:body.password}),cache:"no-store"});
    if(!response.ok)return NextResponse.json({error:response.status===401?"This reset link is invalid or has expired.":safeMessage(response.status)},{status:response.status});
    return NextResponse.json({message:"Your password has been changed. You can now sign in."});
  }catch{return NextResponse.json({error:"Account service is temporarily unavailable. Please try again."},{status:503});}
}
