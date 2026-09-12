import { BrandLogo } from "@/components/brand/brand-logo";
import { AuthModal, AuthNav, MemberNavLinks } from "@/components/procurement/auth-nav";
import Link from "next/link";

export function ProcurementHeader() {
  return <><header className="sticky top-0 z-40 border-b border-[#084d33]/10 bg-[#fdfbf4]/95 backdrop-blur-xl"><div className="mx-auto flex h-16 max-w-7xl items-center gap-3 px-4 sm:gap-5 sm:px-6 lg:px-8"><Link href="/" aria-label="BidScope home"><BrandLogo priority className="h-auto w-[132px] sm:w-[170px]"/></Link><nav className="ml-auto flex items-center gap-1 text-xs font-semibold text-[#35554a] sm:gap-2 sm:text-sm"><MemberNavLinks/><Link className="hidden rounded-full px-3 py-2 hover:bg-[#e9f1e8] lg:inline-flex" href="/plans">Plans</Link><AuthNav/></nav></div></header><AuthModal/></>;
}

export function ProcurementFooter() {
  return <footer className="mt-16 bg-[#0b3e30] text-white/65"><div className="mx-auto max-w-7xl px-5 py-10 text-xs leading-6 lg:px-8"><p>BidScope is an independent procurement intelligence platform. Procurement notices originate from official and public sources. Formal bids must be submitted through the issuing authority&apos;s designated procurement system.</p></div></footer>;
}
