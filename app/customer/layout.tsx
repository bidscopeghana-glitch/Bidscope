import { Suspense } from "react";
import { CustomerShell } from "@/components/customer/shell";
import "./customer.css";
import "./tender-detail.css";
import "@/components/chat/tender-chat.css";
import "@/components/chat/tender-call.css";
export default function Layout({children}:{children:React.ReactNode}){return <Suspense fallback={<div className="cc-loading">Loading BidScope…</div>}><CustomerShell>{children}</CustomerShell></Suspense>;}
