import {NextResponse} from "next/server";
import {verifyAndFulfil} from "@/lib/server/paystack";
export const dynamic="force-dynamic";
export async function GET(request:Request){const url=new URL(request.url);const reference=url.searchParams.get("reference")||url.searchParams.get("trxref");const destination=new URL("/customer/billing",url.origin);if(!reference){destination.searchParams.set("payment","missing_reference");return NextResponse.redirect(destination);}try{await verifyAndFulfil(reference);destination.searchParams.set("payment","success");}catch{destination.searchParams.set("payment","verification_pending");}return NextResponse.redirect(destination);}
