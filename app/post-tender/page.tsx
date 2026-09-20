import { CustomerShell } from "@/components/customer/shell";
import { PostTenderForm } from "./post-tender-form";
import { Suspense } from "react";
export const metadata = { title: "Post a tender | BidScope", robots:{index:false,follow:false} };
export default function PostTenderPage() { return <Suspense fallback={<div className="cc-loading">Opening secure workspace…</div>}><CustomerShell><PostTenderForm /></CustomerShell></Suspense>; }
