"use client";

import {useEffect,useState} from "react";
import Link from "next/link";
import {usePathname,useRouter} from "next/navigation";
import {Activity,ArrowLeft,BadgeCheck,BarChart3,BellRing,BrainCircuit,ContactRound,CreditCard,Database,FilePenLine,LayoutDashboard,LogOut,Menu,ShieldCheck,UsersRound,X,Video,SearchCheck} from "lucide-react";
import {BrandLogo} from "@/components/brand/brand-logo";
import {api,invalidate} from "@/components/customer/data";
import {clearSession} from "@/lib/client/session";

type AdminSession={data:{email:string;name:string;role:string;permissions:string[]}};
const navigation=[
  ["Overview","/admin/command-centre",LayoutDashboard],
  ["Customers & access","/admin/command-centre#customers",UsersRound],
  ["Procurement sources","/admin/command-centre/procurement-data/sources",Database],
  ["Opportunity discovery","/admin/command-centre/opportunity-discovery",SearchCheck],
  ["Subscriptions & revenue","/admin/command-centre/subscriptions-revenue",CreditCard],
  ["Custom services","/admin/command-centre/services",ContactRound],
  ["Alerts & AI","/admin/command-centre/alerts-ai",BellRing],
  ["AI control centre","/admin/ai",BrainCircuit],
  ["Outreach","/admin/outreach",ContactRound],
  ["SEO growth","/admin/growth/seo",SearchCheck],
  ["SEO content","/admin/growth/seo/content",FilePenLine],
  ["SEO operations","/admin/growth/seo/operations",BarChart3],
  ["Growth outreach","/admin/growth/outreach",ContactRound],
  ["Buyer verification","/admin/command-centre/buyer-verifications",BadgeCheck],
  ["Supplier verification","/admin/command-centre/supplier-verifications",ShieldCheck],
  ["BidScope Meet usage","/admin/command-centre/meetings",Video],
] as const;

export function AdminShell({children}:{children:React.ReactNode}){
  const router=useRouter(),pathname=usePathname();
  const[session,setSession]=useState<AdminSession["data"]|null>(null);
  const[state,setState]=useState<"loading"|"ready"|"denied">("loading");
  const[mobile,setMobile]=useState(false);

  useEffect(()=>{
    let active=true;
    void api<AdminSession>("/api/admin/session").then(result=>{if(active){setSession(result.data);setState("ready");}}).catch(error=>{
      if(!active)return;
      if(error instanceof Error&&error.message==="Sign in to continue.")router.replace(`/sign-in?next=${encodeURIComponent(pathname)}`);
      else setState("denied");
    });
    return()=>{active=false;};
  },[pathname,router]);

  if(state==="loading")return <main className="grid min-h-screen place-items-center bg-[#edf1eb]"><div className="text-center"><ShieldCheck className="mx-auto animate-pulse text-[#116149]" size={34}/><p className="mt-3 text-sm font-semibold text-[#456158]">Verifying administrator access…</p></div></main>;
  if(state==="denied")return <main className="grid min-h-screen place-items-center bg-[#edf1eb] px-5"><section className="max-w-md rounded-[28px] border border-[#17362d]/10 bg-white p-8 text-center shadow-xl"><ShieldCheck className="mx-auto text-[#a75b35]" size={40}/><h1 className="serif mt-4 text-3xl text-[#17362d]">Restricted area</h1><p className="mt-3 text-sm leading-6 text-[#64766e]">This console is reserved for the BidScope builder administrator.</p><Link href="/customer" className="mt-6 inline-flex rounded-full bg-[#116149] px-5 py-3 text-sm font-bold text-white">Return to your workspace</Link></section></main>;

  return <div className={`min-h-screen bg-[#edf1eb] text-[#17362d] ${mobile?"overflow-hidden lg:overflow-auto":""}`}>
    <a href="#admin-main" className="sr-only focus:not-sr-only">Skip to admin content</a>
    {mobile?<button aria-label="Close admin navigation" className="fixed inset-0 z-30 bg-[#082d24]/45 lg:hidden" onClick={()=>setMobile(false)}/>:null}
    <aside aria-label="Administrator navigation" className={`fixed inset-y-0 left-0 z-40 flex w-[276px] flex-col bg-[#092f26] text-white shadow-2xl transition-transform lg:translate-x-0 ${mobile?"translate-x-0":"-translate-x-full"}`}>
      <div className="flex h-20 items-center justify-between border-b border-white/10 px-5"><Link href="/admin/command-centre" aria-label="BidScope Admin home" className="rounded-xl bg-[#fffdf8] px-3 py-2"><BrandLogo className="h-8 w-auto"/></Link><button className="lg:hidden" aria-label="Close navigation" onClick={()=>setMobile(false)}><X size={20}/></button></div>
      <div className="border-b border-white/10 px-5 py-5"><span className="inline-flex items-center gap-2 rounded-full bg-[#d4af37]/15 px-3 py-1 text-[10px] font-black uppercase tracking-[.18em] text-[#e8ca6a]"><ShieldCheck size={13}/>Builder admin</span><p className="mt-3 truncate text-sm font-bold">{session?.name}</p><p className="mt-1 truncate text-xs text-white/55">{session?.email}</p></div>
      <nav className="flex-1 space-y-1 overflow-y-auto p-4">{navigation.map(([label,href,Icon])=>{const base=href.split("#")[0];const active=base==="/admin/command-centre"?pathname===base:pathname.startsWith(base);return <Link key={href} href={href} aria-current={active?"page":undefined} onClick={()=>setMobile(false)} className={`flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold transition ${active?"bg-white text-[#0d4939] shadow-sm":"text-white/72 hover:bg-white/8 hover:text-white"}`}><Icon size={17}/>{label}</Link>})}</nav>
      <div className="space-y-2 border-t border-white/10 p-4"><Link href="/customer" className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-xs font-semibold text-white/70 hover:bg-white/8 hover:text-white"><ArrowLeft size={16}/>Customer workspace</Link><button className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-xs font-semibold text-white/70 hover:bg-white/8 hover:text-white" onClick={()=>{clearSession();invalidate();router.push("/");}}><LogOut size={16}/>Sign out</button></div>
    </aside>
    <div className="lg:pl-[276px]"><header className="sticky top-0 z-20 flex h-20 items-center justify-between border-b border-[#17362d]/10 bg-[#f8faf6]/95 px-4 backdrop-blur sm:px-7"><div className="flex items-center gap-3"><button className="rounded-xl border border-[#17362d]/10 bg-white p-2.5 lg:hidden" aria-label="Open admin navigation" onClick={()=>setMobile(true)}><Menu size={20}/></button><div><p className="text-[10px] font-black uppercase tracking-[.2em] text-[#16805e]">BidScope operations</p><p className="text-sm font-bold">Administrator control panel</p></div></div><div className="hidden items-center gap-2 rounded-full border border-emerald-700/15 bg-emerald-50 px-3 py-2 text-[11px] font-bold text-emerald-800 sm:flex"><Activity size={14}/>Secure admin session</div></header>
      <main id="admin-main" className="min-h-[calc(100vh-5rem)]">{children}</main>
      <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-[#17362d]/10 px-5 py-5 text-[11px] text-[#6d7b75] sm:px-8"><span>BidScope administrative operations</span><span className="inline-flex items-center gap-1.5"><BarChart3 size={13}/>Actions are recorded in the audit log</span></footer>
    </div>
  </div>;
}
