"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowLeftRight, Menu, X } from "lucide-react";
import { BrandLogo } from "@/components/brand/brand-logo";
import { useBidScopeSession } from "@/components/procurement/auth-nav";
import { navGroups } from "@/components/customer/navigation";
import {CountryNavigation} from "@/components/customer/country-navigation";

const ownNavigation = ["/customer", "/procurement", "/admin", "/post-tender"];
const fullScreenOrAuth = ["/sign-in", "/auth", "/meetings", "/unsubscribe", "/r"];

function isWithin(pathname: string, section: string) {
  return pathname === section || pathname.startsWith(`${section}/`);
}

export function PersistentSiteSidebar() {
  const pathname = usePathname();
  const signedIn = useBidScopeSession();
  const [openPath, setOpenPath] = useState<string | null>(null);
  const open = openPath === pathname;
  const visible = signedIn === true && ![...ownNavigation, ...fullScreenOrAuth].some(section => isWithin(pathname, section));

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === "Escape") setOpenPath(null); };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  if (!visible) return null;

  return <>
    {open && <button type="button" className="pws-backdrop" aria-label="Close workspace menu" onClick={() => setOpenPath(null)} />}
    <aside className={`pws-sidebar ${open ? "pws-open" : ""}`} aria-label="BidScope workspace navigation">
      <div className="pws-brand"><Link href="/customer" aria-label="BidScope workspace home" onClick={() => setOpenPath(null)}><BrandLogo className="pws-logo" /></Link><button type="button" className="pws-close" aria-label="Close workspace menu" onClick={() => setOpenPath(null)}><X size={19} /></button></div>
      <div className="pws-heading">Your workspace</div>
      <nav className="pws-nav">{navGroups.map((group, groupIndex) => <div key={`${group.title}-${groupIndex}`} className="pws-group">{group.title && <p>{group.title}</p>}{group.links.map(([label, href, Icon]) => <Link key={href} href={href} title={label} aria-current={isWithin(pathname, href) ? "page" : undefined} onClick={() => setOpenPath(null)}><Icon size={16} /><span>{label}</span></Link>)}{groupIndex===1?<CountryNavigation variant="persistent" close={()=>setOpenPath(null)}/>:null}</div>)}</nav>
      <div className="pws-foot"><Link href="/procurement" onClick={() => setOpenPath(null)}><ArrowLeftRight size={16} />Buyer workspace</Link><Link href="/customer/profile" onClick={() => setOpenPath(null)}>Manage account</Link></div>
    </aside>
    <button type="button" className="pws-mobile-trigger" aria-label="Open workspace menu" aria-expanded={open} onClick={() => setOpenPath(pathname)}><Menu size={20} /><span>Menu</span></button>
  </>;
}
