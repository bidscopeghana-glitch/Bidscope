"use client";
/* eslint-disable react-hooks/set-state-in-effect, react-hooks/exhaustive-deps */
import{useEffect,useState}from"react";
import Link from"next/link";
import{ArrowLeft,LoaderCircle}from"lucide-react";
import{api,invalidate}from"@/components/customer/data";
import{SeoDemand,SeoLandingPages,SeoReportsTools,type SeoOperations}from"./seo-growth-operations";

type Row=Record<string,unknown>;
type Data={metrics:Record<string,number>;pageMetrics:Row[];operations:SeoOperations};
const views=["Landing pages","Demand & tenders","Reports & tools"]as const;
type View=typeof views[number];

export function SeoOperationsWorkspace(){
 const[data,setData]=useState<Data|null>(null),[view,setView]=useState<View>("Landing pages"),[days,setDays]=useState(28),[busy,setBusy]=useState(false),[message,setMessage]=useState("Loading Phase 2 operations…");
 const load=async()=>{try{const response=await api<{data:Data}>(`/api/admin/seo?days=${days}`);setData(response.data);setMessage("")}catch(error){setMessage(error instanceof Error?error.message:"SEO operations could not be loaded.")}};
 useEffect(()=>{void load()},[days]);
 const submit=async(action:string,payload:Row)=>{setBusy(true);setMessage("");try{await api("/api/admin/seo",{action,payload});invalidate();await load()}catch(error){setMessage(error instanceof Error?error.message:"The operation could not be saved.")}finally{setBusy(false)}};
 return <section className="mx-auto max-w-[1500px] px-4 py-8 sm:px-7 lg:px-9"><header className="relative overflow-hidden rounded-[30px] bg-[#0b3e31] px-6 py-8 text-white shadow-xl sm:px-9"><div className="absolute inset-0 bg-[radial-gradient(circle_at_85%_15%,rgba(212,175,55,.28),transparent_42%)]"/><div className="relative flex flex-col justify-between gap-6 xl:flex-row xl:items-end"><div><Link href="/admin/growth/seo" className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-[.16em] text-[#73ddb7]"><ArrowLeft size={14}/>SEO Growth Centre</Link><h1 className="serif mt-4 text-4xl sm:text-5xl">Growth operations</h1><p className="mt-3 max-w-3xl text-sm leading-6 text-white/70">Landing-page acquisition, search demand, tender freshness, ethical outreach, reporting and controlled experiments.</p></div><select aria-label="Report date range" value={days} onChange={e=>setDays(Number(e.target.value))} className="rounded-full border border-white/20 bg-white/10 px-4 py-2.5 text-sm font-bold"><option className="text-black" value={7}>Last 7 days</option><option className="text-black" value={28}>Last 28 days</option><option className="text-black" value={90}>Last 3 months</option><option className="text-black" value={180}>Last 6 months</option><option className="text-black" value={365}>Last 12 months</option></select></div></header><nav className="mt-5 flex gap-1 overflow-x-auto rounded-2xl border border-[#17362d]/10 bg-white p-1.5 shadow-sm">{views.map(item=><button key={item} onClick={()=>setView(item)} className={`whitespace-nowrap rounded-xl px-4 py-2.5 text-xs font-bold ${view===item?"bg-[#116149] text-white":"text-[#52675f] hover:bg-[#eef4ef]"}`}>{item}</button>)}</nav>{message&&<div role="status" className="mt-5 rounded-2xl border bg-white p-5 text-sm">{busy&&<LoaderCircle className="mr-2 inline animate-spin" size={16}/>} {message}</div>}{data&&view==="Landing pages"&&<SeoLandingPages pageMetrics={data.pageMetrics} metrics={data.metrics}/>} {data&&view==="Demand & tenders"&&<SeoDemand operations={data.operations} metrics={data.metrics}/>} {data&&view==="Reports & tools"&&<SeoReportsTools operations={data.operations} busy={busy} submit={submit}/>}</section>
}
