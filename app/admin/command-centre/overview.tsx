"use client";

import {useEffect,useState} from "react";
import Link from "next/link";
import {Activity,ArrowUpRight,BellRing,Bot,CreditCard,Database,Layers3,UsersRound} from "lucide-react";
import {api} from "@/components/customer/data";

type Item=Record<string,unknown>;
type Overview={window:string;metrics:Record<string,number>;recentBusinesses:Item[];recentPayments:Item[];sourceAlerts:Array<{id:string;severity:string;message:string;source?:{name?:string}}> ;auditLog:Item[];services:Record<string,string>};
const cards=[
  [/^users$|^businesses$/,UsersRound,"Customers","Recent organisations and account totals","#customers"],
  [/^openOpportunities$/,Layers3,"Opportunities","Published open and closing-soon records","/opportunities"],
  [/^sources$|^degradedSources$/,Database,"Sources & ingestion","Connector health, runs and controls","/admin/command-centre/procurement-data/sources"],
  [/^pendingPayments$|^activeSubscriptions$/,CreditCard,"Payments & subscriptions","Paystack transactions and entitlements","/admin/command-centre/subscriptions-revenue"],
  [/^failedDeliveries$/,BellRing,"Alerts","Delivery and notification health","/admin/command-centre/alerts-ai"],
  [/^aiRequests$/,Bot,"AI monitoring","Usage without private conversation content","/admin/command-centre/alerts-ai"],
] as const;

export function CommandCentreOverview(){
  const[data,setData]=useState<Overview|null>(null);
  const[message,setMessage]=useState("Loading live operational data…");
  useEffect(()=>{void api<{data:Overview}>("/api/admin/overview").then(result=>{setData(result.data);setMessage("");}).catch(error=>setMessage(error instanceof Error?error.message:"Command Centre could not be loaded."));},[]);
  return <section className="mx-auto max-w-7xl px-5 py-10 lg:px-8">
    <p className="text-xs font-bold uppercase tracking-[.17em] text-[#16805e]">Live platform control</p>
    <h1 className="serif mt-3 text-4xl text-[#17362d] sm:text-5xl">Command Centre</h1>
    <p className="mt-3 max-w-2xl text-sm leading-6 text-[#64766e]">Customer, procurement, billing, alert and service health in one protected operational view.</p>
    {message?<div className="mt-8 rounded-2xl border bg-white p-6 text-sm text-[#5e7068]">{message}</div>:null}
    {data?<>
      <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{cards.map(([matcher,Icon,title,description,href])=>{const values=Object.entries(data.metrics).filter(([key])=>matcher.test(key));return <Link href={href} key={title} className="rounded-[22px] border border-[#17362d]/10 bg-[#fffdf8] p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"><span className="flex items-center justify-between"><Icon className="text-[#16805e]"/><ArrowUpRight size={17}/></span><h2 className="mt-4 text-lg font-bold text-[#17362d]">{title}</h2><p className="mt-1 text-xs leading-5 text-[#6b7b74]">{description}</p><div className="mt-4 flex flex-wrap gap-4">{values.map(([key,value])=><span key={key}><strong className="block text-2xl text-[#17362d]">{value}</strong><small className="text-[10px] uppercase tracking-wider text-[#7d8b85]">{key.replaceAll(/([A-Z])/g," $1")}</small></span>)}</div></Link>})}</div>
      <div className="mt-8 grid gap-5 lg:grid-cols-[1.1fr_.9fr]">
        <section id="customers" className="scroll-mt-28 rounded-[22px] border bg-white p-5"><h2 className="text-lg font-bold">Recently created businesses</h2>{data.recentBusinesses.length?data.recentBusinesses.map(item=><div key={String(item.id)} className="grid grid-cols-[1fr_auto] gap-3 border-t py-3 text-sm"><strong>{String(item.name||"Unnamed business")}</strong><span className="text-[#718078]">{String(item.region||"Region not stated")}</span></div>):<p className="mt-4 text-sm text-[#718078]">No business records yet.</p>}</section>
        <section className="rounded-[22px] border bg-white p-5"><h2 className="flex items-center gap-2 text-lg font-bold"><Activity size={18}/>Critical services</h2>{Object.entries(data.services).map(([key,value])=><div key={key} className="flex items-center justify-between border-t py-3 text-sm"><span className="capitalize">{key}</span><strong className={value.includes("not configured")?"text-[#a75b35]":"text-[#16805e]"}>{value}</strong></div>)}</section>
      </div>
      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <section className="rounded-[22px] border bg-white p-5"><h2 className="text-lg font-bold">Recent payment activity</h2>{data.recentPayments.length?data.recentPayments.map(item=><div key={String(item.id)} className="border-t py-3 text-sm"><div className="flex justify-between gap-3"><strong>{String(item.billing_plan_code||"Payment")}</strong><span>{String(item.status||"Unknown")}</span></div><p className="mt-1 text-xs text-[#718078]">Reference {String(item.reference||"not recorded")}</p></div>):<p className="mt-4 text-sm text-[#718078]">No payment activity yet.</p>}</section>
        <section className="rounded-[22px] border bg-white p-5"><h2 className="text-lg font-bold">Administrator audit trail</h2>{data.auditLog.length?data.auditLog.map(item=><div key={String(item.id)} className="border-t py-3 text-sm"><strong>{String(item.action||"Administrative action")}</strong><p className="mt-1 text-xs text-[#718078]">{String(item.entity_type||"platform")} · {item.created_at?new Date(String(item.created_at)).toLocaleString("en-GB"):"time unavailable"}</p></div>):<p className="mt-4 text-sm text-[#718078]">No administrative actions recorded yet.</p>}</section>
      </div>
      <section className="mt-5 rounded-[22px] border bg-white p-5"><h2 className="text-lg font-bold">Unresolved source alerts</h2>{data.sourceAlerts.length?data.sourceAlerts.map(alert=><div key={alert.id} className="border-t py-3"><div className="flex flex-wrap items-center gap-2"><strong className="text-sm">{alert.source?.name||"Procurement source"}</strong><span className="rounded-full bg-[#f5e9dd] px-2 py-1 text-[10px] font-bold text-[#9a542f]">{alert.severity}</span></div><p className="mt-1 text-xs leading-5 text-[#687971]">{alert.message}</p></div>):<p className="mt-4 text-sm text-[#718078]">No unresolved source alerts.</p>}</section>
    </>:null}
  </section>;
}
