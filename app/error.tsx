"use client";

import {useEffect} from "react";
import Link from "next/link";
import {CircleAlert,RefreshCw} from "lucide-react";

export default function ErrorPage({error,reset}:{error:Error&{digest?:string};reset:()=>void}){
  useEffect(()=>{console.error("BidScope page error",error.digest||error.message);},[error]);
  return <main className="grid min-h-[70vh] place-items-center bg-[#f7f4eb] px-5 py-16"><section className="w-full max-w-lg rounded-[28px] border border-[#17362d]/10 bg-[#fffdf8] p-8 text-center shadow-[0_20px_60px_rgba(19,62,49,.09)]"><CircleAlert className="mx-auto text-[#b55c3b]" size={34}/><p className="mt-5 text-xs font-bold uppercase tracking-[.16em] text-[#6a7a73]">Something needs attention</p><h1 className="serif mt-3 text-4xl text-[#17362d]">This page could not be loaded.</h1><p className="mx-auto mt-4 max-w-md text-sm leading-6 text-[#61736a]">Your data has not been changed. Try the page again, or return to your workspace.</p><div className="mt-7 flex flex-wrap justify-center gap-3"><button onClick={reset} className="inline-flex h-11 items-center gap-2 rounded-full bg-[#116149] px-5 text-sm font-bold text-white"><RefreshCw size={15}/>Try again</button><Link href="/customer" className="inline-flex h-11 items-center rounded-full border border-[#17362d]/15 px-5 text-sm font-bold text-[#17362d]">Return to workspace</Link></div>{error.digest&&<p className="mt-6 text-[10px] text-[#89958f]">Support reference: {error.digest}</p>}</section></main>;
}
