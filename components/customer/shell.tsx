"use client";
import { createContext,useContext,useEffect,useRef,useState } from "react";
import Link from "next/link";
import { usePathname,useRouter,useSearchParams } from "next/navigation";
import { Home,Search,Bookmark,BriefcaseBusiness,Building2,FileText,PanelLeftClose,PanelLeftOpen,LogOut,ChevronRight,Sparkles,Menu,X,ArrowUpRight,SlidersHorizontal,Compass,ShieldCheck,ArrowLeftRight,CheckCircle2,AlertTriangle,Info,XCircle } from "lucide-react";
import { BrandLogo } from "@/components/brand/brand-logo";
import { navGroups } from "@/components/customer/navigation";
import { useBidScopeSession } from "@/components/procurement/auth-nav";
import { NotificationBell } from "@/components/procurement/notification-bell";
import { FloatingHelp } from "@/components/help/floating-help";
import {CountryNavigation} from "@/components/customer/country-navigation";
import { api,useData,invalidate,type Organization,type Preferences,type Opportunity } from "./data";

type ToastKind="success"|"warning"|"info"|"error";
type ToastMessage={id:number;text:string;kind:ToastKind};
type Account={profile?:{full_name:string;email:string;is_bidscope_admin:boolean};organization?:Organization;preferences:Preferences;setPreferences:(p:Preferences)=>void;toast:(m:string,kind?:ToastKind)=>void};
const Context=createContext<Account>({preferences:{},setPreferences:()=>{},toast:()=>{}});
export const useAccount=()=>useContext(Context);
export function CustomerShell({children}:{children:React.ReactNode}){
 const session=useBidScopeSession(),router=useRouter(),pathname=usePathname(),params=useSearchParams();
 const [expired,setExpired]=useState(false),[mobile,setMobile]=useState(false),[search,setSearch]=useState(false),[messages,setMessages]=useState<ToastMessage[]>([]);
 const toastId=useRef(0);
 const toast=(text:string,kind:ToastKind="info")=>{const id=++toastId.current;setMessages(current=>[...current,{id,text,kind}].slice(-20));};
 const [preferences,setLocalPreferences]=useState<Preferences>({});
 const me=useData<{data:{full_name:string;email:string;is_bidscope_admin:boolean}}>(session?"/api/me":null);
 const org=useData<{data:{organization:Organization}[]}>(session?"/api/organizations":null);
 const pref=useData<{data:{preferences:Preferences}[]}>(session?"/api/customer?resource=preferences":null);
 useEffect(()=>{if(pref.data)void Promise.resolve().then(()=>setLocalPreferences(pref.data!.data[0]?.preferences||{}));},[pref.data]);
 useEffect(()=>{const fail=()=>setExpired(true);window.addEventListener("bidscope-session-expired",fail);return()=>window.removeEventListener("bidscope-session-expired",fail);},[]);
 useEffect(()=>{if(session)void api("/api/customer",{resource:"visit"}).catch(()=>{});},[session]);
 useEffect(()=>{const key=(e:KeyboardEvent)=>{if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==="k"){e.preventDefault();setSearch(true);}if(e.key==="Escape"){setMobile(false);setSearch(false);}};window.addEventListener("keydown",key);return()=>window.removeEventListener("keydown",key);},[]);
 useEffect(()=>{if(!messages.length)return;const id=messages[0].id;const timer=setTimeout(()=>setMessages(current=>current.filter(item=>item.id!==id)),6000);return()=>clearTimeout(timer);},[messages]);
 const signInHref=`/sign-in?next=${encodeURIComponent(pathname+(params.size?`?${params}`:""))}`;
 useEffect(()=>{if(session===false||expired)router.replace(signInHref);},[session,expired,router,signInHref]);
 const setPreferences=(p:Preferences)=>{const next={...preferences,...p};setLocalPreferences(next);void api("/api/customer",{resource:"preferences",preferences:next}).catch(e=>toast(e.message,"error"));};
 if(session===null)return <div className="cc-loading" aria-busy="true"><div className="cc-skeleton"/><p>Opening your command centre…</p></div>;
 if(!session||expired)return <div className="cc-loading" aria-busy="true"><div className="cc-skeleton"/><p>Opening secure sign-in…</p></div>;
 const selected=pathname+(params.size?`?${params}`:"");
 const name=me.data?.data.full_name||me.data?.data.email?.split("@")[0]||"Your account";
 return <Context.Provider value={{profile:me.data?.data,organization:org.data?.data[0]?.organization,preferences,setPreferences,toast}}><div className={`cc-app ${preferences.collapsed?"cc-collapsed":""} ${mobile?"cc-menu-open":""}`}>
 <a href="#customer-main" className="cc-skip">Skip to content</a>
 {mobile&&<button className="cc-overlay" onClick={()=>setMobile(false)} aria-label="Close navigation"/>}
 <aside className="cc-sidebar" aria-label="Customer navigation"><div className="cc-brand"><Link href="/customer" aria-label="BidScope Home"><BrandLogo className="cc-logo"/></Link><button className="cc-collapse" onClick={()=>setPreferences({collapsed:!preferences.collapsed})} aria-label={preferences.collapsed?"Expand navigation":"Collapse navigation"}>{preferences.collapsed?<PanelLeftOpen size={17}/>:<PanelLeftClose size={17}/>}</button><button className="cc-mobile-close" aria-label="Close menu" onClick={()=>setMobile(false)}><X size={20}/></button></div><div className="cc-workspace-name"><span className="cc-avatar"><Building2 size={15}/></span><span>{org.data?.data[0]?.organization.name||"Personal workspace"}<small>PROCUREMENT INTELLIGENCE</small></span></div>
 {org.data?.data[0]?.organization.can_procure?<Link className="cc-workspace-switch" href="/procurement" onClick={()=>setMobile(false)}><ArrowLeftRight size={17}/><span><strong>Buyer workspace</strong><small>Switch to procurement</small></span></Link>:null}
 <nav className="cc-nav">{navGroups.map((group,index)=><div key={index} className="cc-nav-group">{group.title&&<p>{group.title}</p>}{group.links.filter(([,href])=>href!=="/customer/performance"||org.data?.data[0]?.organization.can_bid).map(([label,href,Icon])=><Link key={href} title={label} aria-current={selected===href?"page":undefined} href={href} onClick={()=>setMobile(false)}><Icon size={16}/><span>{label}</span>{selected===href&&<i/>}</Link>)}{index===1?<CountryNavigation close={()=>setMobile(false)}/>:null}</div>)}</nav>
 {me.data?.data.is_bidscope_admin?<div className="cc-nav-group px-3 pb-3"><Link href="/admin/command-centre" className="flex items-center gap-2 rounded-xl bg-[#d4af37]/15 px-3 py-3 text-sm font-bold text-[#17362d]"><ShieldCheck size={16}/><span>Admin control panel</span></Link></div>:null}
 <div className="cc-account"><Link href="/customer/profile"><span className="cc-avatar">{name.slice(0,2).toUpperCase()}</span><span>{name}<small>Manage your account</small></span></Link><button aria-label="Sign out" onClick={()=>{["bidscope_access_token","bidscope_refresh_token","bidscope_token_expires_at"].forEach(k=>localStorage.removeItem(k));invalidate();window.dispatchEvent(new Event("bidscope-session-change"));router.push("/");}}><LogOut size={16}/></button></div></aside>
 <div className="cc-body"><header className="cc-topbar"><button className="cc-mobile-menu" aria-label="Open navigation" onClick={()=>setMobile(true)}><Menu size={21}/></button><button className="cc-global-search" onClick={()=>setSearch(true)}><Search size={17}/><span>Search tenders, buyers, sectors, keywords or reference numbers…</span><kbd>⌘ / Ctrl K</kbd></button><div className="cc-top-actions"><Link href="/customer/ai" aria-label="Open AI Tender Evaluation"><Sparkles size={18}/><span>Evaluate tender</span></Link><NotificationBell/><Link href="/customer/profile" aria-label="Your profile" className="cc-avatar">{name.slice(0,1).toUpperCase()}</Link></div></header>
 <div className="cc-context"><span>Workspace <ChevronRight size={12}/> {navGroups.flatMap(g=>g.links).find(([,href])=>href===selected)?.[0]||"Procurement intelligence"}</span><span className="cc-context-right"><span className="cc-status-dot"/> Official sources. Informed decisions.</span></div>
 <main id="customer-main" className="cc-main">{children}</main><footer className="cc-footer">Independent procurement intelligence. Always confirm requirements and submit through the official authority.<Link href="/customer/help">Source & analysis guide <ArrowUpRight size={12}/></Link></footer></div>
 <nav className="cc-bottom" aria-label="Mobile navigation">{[["Home","/customer",Home],["Discover","/customer/discover",Compass],["Saved","/customer/saved",Bookmark],["Bids","/customer/bids",BriefcaseBusiness]].map(([label,href,Icon])=>{const I=Icon as typeof Home;return <Link key={String(href)} href={String(href)} aria-current={pathname===href?"page":undefined}><I size={20}/>{String(label)}</Link>;})}<button onClick={()=>setMobile(true)} aria-expanded={mobile}><Menu size={20}/>More</button></nav>
 <FloatingHelp />
 {!!messages.length&&<div className="cc-toast-stack" aria-label="Notifications">{messages.slice(0,3).map(item=><div key={item.id} role={item.kind==="error"||item.kind==="warning"?"alert":"status"} className={`cc-toast ${item.kind}`}>{item.kind==="success"?<CheckCircle2 size={18}/>:item.kind==="warning"?<AlertTriangle size={18}/>:item.kind==="error"?<XCircle size={18}/>:<Info size={18}/>}<span>{item.text}</span><button onClick={()=>setMessages(current=>current.filter(message=>message.id!==item.id))} aria-label={`Dismiss ${item.kind} notification`}><X size={15}/></button></div>)}</div>}
 {search&&<SearchDialog close={()=>setSearch(false)}/>}
 </div></Context.Provider>;
}
function SearchDialog({close}:{close:()=>void}){
 const dialog=useRef<HTMLDialogElement>(null);const [input,setInput]=useState(""),[q,setQ]=useState("");const router=useRouter();
 useEffect(()=>{dialog.current?.showModal();},[]);
 useEffect(()=>{const t=setTimeout(()=>setQ(input),300);return()=>clearTimeout(t);},[input]);
 const result=useData<{data:Opportunity[]}>(q.length>1?`/api/customer?resource=discover&q=${encodeURIComponent(q)}&pageSize=5`:null);
 const buyers=useData<{data:{id:string;name:string}[]}>(q.length>1?`/api/buyers?q=${encodeURIComponent(q)}&pageSize=3`:null);
 return <dialog ref={dialog} className="cc-search-dialog" onCancel={close} onClick={e=>{if(e.target===e.currentTarget)close();}}><form onSubmit={e=>{e.preventDefault();router.push(`/customer/discover?q=${encodeURIComponent(input)}`);close();}}><Search size={20}/><input autoFocus aria-label="Global procurement search" placeholder="Search tenders, buyers, sectors, references…" value={input} onChange={e=>setInput(e.target.value)}/><button type="button" aria-label="Close search" onClick={close}><X size={18}/></button></form><div className="cc-search-results"><p className="cc-eyebrow">Opportunities</p>{result.loading&&q?<Skeleton/>:result.error?<p role="alert">{result.error}</p>:result.data?.data.map(o=><Link key={o.id} href={`/customer/opportunity/${o.slug}`} onClick={close}><FileText size={16}/><span>{o.title}<small>{o.buyer_name}</small></span><ChevronRight size={14}/></Link>)}{!q&&<p>Search across official notices and buyer profiles. Press Enter for all results.</p>}{q&&result.data?.data.length===0&&<p>No matching notices. Try another reference or keyword.</p>}{!!buyers.data?.data.length&&<><p className="cc-eyebrow">Buyers</p>{buyers.data.data.map(b=><Link key={b.id} href={`/customer/discover?buyer=${encodeURIComponent(b.name)}`} onClick={close}><Building2 size={16}/>{b.name}</Link>)}</>}<Link href={`/customer/discover?q=${encodeURIComponent(input)}`} onClick={close}><SlidersHorizontal size={16}/> Open full search workspace <ChevronRight size={14}/></Link></div></dialog>;
}
export function Skeleton(){return <div className="cc-skeleton-set" aria-busy="true" aria-label="Loading"><div className="cc-skeleton"/><div className="cc-skeleton"/><div className="cc-skeleton"/></div>;}
export function Empty({title,description,href="/customer/discover",action="Discover opportunities"}:{title:string;description:string;href?:string;action?:string}){return <div className="cc-empty"><Compass size={25}/><h3>{title}</h3><p>{description}</p><Link href={href} className="cc-button">{action}<ChevronRight size={14}/></Link></div>;}
