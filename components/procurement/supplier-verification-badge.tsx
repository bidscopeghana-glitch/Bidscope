"use client";
import { useState } from "react";
import { BadgeCheck, ShieldCheck } from "lucide-react";

export function SupplierVerificationBadge({verification}:{verification?:{level:string;verified_at:string|null;expires_at:string|null}|null}){
 const [open,setOpen]=useState(false);
 if(!verification||!["verified","enhanced_verified"].includes(verification.level)||!verification.expires_at)return null;
 const enhanced=verification.level==="enhanced_verified";
 return <span className="relative inline-flex"><button type="button" aria-expanded={open} onClick={()=>setOpen(!open)} className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-bold ${enhanced?"bg-amber-100 text-amber-900":"bg-emerald-100 text-emerald-900"}`}>{enhanced?<ShieldCheck size={14}/>:<BadgeCheck size={14}/>} {enhanced?"Enhanced Verified Supplier":"Verified Supplier"}</button>{open&&<span role="status" className="absolute right-0 top-full z-10 mt-2 w-72 rounded-xl border bg-white p-4 text-left text-xs leading-5 text-[#17362d] shadow-xl"><strong>{enhanced?"Enhanced Verified Supplier":"Verified Supplier"}</strong><span className="mt-1 block">{enhanced?"BidScope has completed additional company, compliance, document and applicable licence checks.":"BidScope has completed defined company and document verification checks for this supplier."}</span><span className="mt-2 block text-[#64766e]">Last verified: {verification.verified_at?new Date(verification.verified_at).toLocaleDateString("en-GB"):"Not available"}<br/>Valid until: {new Date(verification.expires_at).toLocaleDateString("en-GB")}</span><span className="mt-2 block">This is not government endorsement or a guarantee of performance.</span></span>}</span>;
}
