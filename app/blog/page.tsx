import Image from "next/image";
import Link from "next/link";
import { ArrowRight, BookOpen, Clock3, SearchCheck } from "lucide-react";
import { ProcurementFooter, ProcurementHeader } from "@/components/procurement/site-shell";
import { Breadcrumbs, JsonLd, SeoCta } from "@/components/seo/public-seo";
import { absoluteUrl, publicMetadata } from "@/lib/seo/site";
import { listPublishedSeoContent, type PublishedSeoContent } from "@/lib/server/seo-content";

export const metadata = publicMetadata({
  title: "Tender Blog Ghana | Procurement Guides and Bid Intelligence",
  description: "BidScope's Ghana tender blog: expert guides on government contracts, bid writing, eligibility, procurement strategy and supplier growth.",
  path: "/blog",
  image: "/images/blog/procurement-team.webp",
});

function readingTime(item: PublishedSeoContent) {
  const words = (item.body || "").trim().split(/\s+/).filter(Boolean).length;
  return Math.max(4, Math.round(words / 220));
}

function ArticleCard({ item, featured = false }: { item: PublishedSeoContent; featured?: boolean }) {
  const href = `/insights/${item.slug}`;
  return <article className={`group overflow-hidden rounded-[30px] border border-[#17362d]/10 bg-white shadow-[0_18px_54px_rgba(20,58,46,.08)] ${featured ? "lg:grid lg:grid-cols-[1.05fr_.95fr]" : "flex h-full flex-col"}`}>
    <Link href={href} className={`relative block overflow-hidden bg-[#dce8df] ${featured ? "min-h-[320px]" : "h-52"}`}>
      <Image src={item.featured_image_url || "/images/blog/procurement-team.webp"} alt={`${item.title} — BidScope editorial photograph`} fill sizes={featured ? "(min-width:1024px) 55vw, 100vw" : "(min-width:1280px) 30vw, (min-width:768px) 50vw, 100vw"} className="object-cover transition duration-500 group-hover:scale-[1.035]" />
      <div className="absolute inset-0 bg-gradient-to-t from-[#082f25]/55 via-transparent to-transparent" />
    </Link>
    <div className={`flex flex-1 flex-col ${featured ? "p-7 sm:p-10" : "p-6"}`}>
      <div className="flex flex-wrap items-center gap-3 text-[11px] font-black uppercase tracking-[.14em] text-[#7a6331]"><span>{item.cluster}</span><span className="h-1 w-1 rounded-full bg-[#caa34e]"/><span className="inline-flex items-center gap-1"><Clock3 size={13}/>{readingTime(item)} min read</span></div>
      <h2 className={`${featured ? "mt-5 text-3xl sm:text-4xl" : "mt-4 text-2xl"} font-black leading-tight text-[#15362d]`}><Link href={href}>{item.title}</Link></h2>
      <p className={`${featured ? "mt-5 text-lg leading-8" : "mt-3 line-clamp-3 leading-7"} text-[#61736a]`}>{item.excerpt}</p>
      <Link href={href} className="mt-6 inline-flex items-center gap-2 font-black text-[#0d674d]">Read the analysis <ArrowRight size={17}/></Link>
    </div>
  </article>;
}

export default async function BlogPage() {
  const items = await listPublishedSeoContent(1000);
  const featured = items[0];
  const clusters = [...new Set(items.slice(1).map(item => item.cluster))];
  return <main className="min-h-screen bg-[#f7f4eb] text-[#17362d]">
    <ProcurementHeader />
    <section className="mx-auto max-w-7xl px-5 py-10 sm:px-8 sm:py-14">
      <Breadcrumbs items={[{ name: "Home", href: "/" }, { name: "Blog", href: "/blog" }]} />
      <header className="relative mt-8 overflow-hidden rounded-[38px] bg-[#082f25] text-white shadow-[0_24px_70px_rgba(8,47,37,.24)]">
        <Image src="/images/blog/procurement-team.webp" alt="Ghanaian procurement professionals reviewing a tender" fill priority sizes="100vw" className="object-cover opacity-45" />
        <div className="absolute inset-0 bg-gradient-to-r from-[#082f25] via-[#082f25]/90 to-[#082f25]/35" />
        <div className="relative max-w-4xl px-7 py-14 sm:px-12 sm:py-20">
          <span className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-2 text-xs font-black uppercase tracking-[.17em] text-[#a8e2ca]"><BookOpen size={16}/>BidScope Intelligence Journal</span>
          <h1 className="serif mt-6 text-4xl leading-[1.04] sm:text-6xl">The thinking behind better tender decisions.</h1>
          <p className="mt-6 max-w-3xl text-lg leading-8 text-white/80">Original, source-conscious guidance for Ghanaian suppliers, procurement teams and business leaders—from opportunity discovery to contract mobilisation.</p>
          <div className="mt-8 flex flex-wrap gap-3 text-sm font-bold"><span className="rounded-full bg-white px-4 py-2 text-[#103f32]">Original expert guidance</span><span className="rounded-full border border-white/25 bg-white/10 px-4 py-2">Ghana-first context</span><span className="rounded-full border border-white/25 bg-white/10 px-4 py-2">Official sources linked</span></div>
        </div>
      </header>

      <section className="mt-10 rounded-[28px] border border-[#17362d]/10 bg-[#eef4ee] p-5 sm:flex sm:items-center sm:justify-between sm:p-7">
        <div className="flex gap-4"><span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-[#116149] text-white"><SearchCheck size={22}/></span><div><h2 className="text-lg font-black">Built for decisions, not search-engine filler</h2><p className="mt-1 max-w-3xl leading-7 text-[#61736a]">Every guide separates official requirements from operating advice, links to authoritative sources and gives teams a practical control framework.</p></div></div>
        <Link href="/tenders/ghana" className="mt-4 inline-flex shrink-0 items-center gap-2 rounded-full bg-[#d4a43d] px-5 py-3 font-black text-[#17362d] sm:mt-0">Explore live tenders <ArrowRight size={16}/></Link>
      </section>

      {featured ? <section className="mt-12"><p className="mb-5 text-xs font-black uppercase tracking-[.18em] text-[#116149]">Featured analysis</p><ArticleCard item={featured} featured /></section> : null}

      {clusters.map(cluster => {
        const grouped = items.slice(1).filter(item => item.cluster === cluster);
        return <section key={cluster} className="mt-16">
          <div className="flex items-end justify-between gap-5 border-b border-[#17362d]/15 pb-4"><div><p className="text-xs font-black uppercase tracking-[.18em] text-[#116149]">BidScope editorial collection</p><h2 className="serif mt-2 text-3xl sm:text-4xl">{cluster}</h2></div><span className="text-sm font-bold text-[#61736a]">{grouped.length} article{grouped.length === 1 ? "" : "s"}</span></div>
          <div className="mt-6 grid gap-6 md:grid-cols-2 xl:grid-cols-3">{grouped.map(item => <ArticleCard key={item.id} item={item} />)}</div>
        </section>;
      })}

      <div className="mt-16"><SeoCta /></div>
    </section>
    <JsonLd data={{ "@context": "https://schema.org", "@type": "CollectionPage", name: "BidScope Tender Blog Ghana", description: "Expert procurement and tender guidance for Ghanaian businesses.", url: absoluteUrl("/blog"), mainEntity: { "@type": "ItemList", itemListElement: items.map((item, index) => ({ "@type": "ListItem", position: index + 1, name: item.title, url: absoluteUrl(`/insights/${item.slug}`) })) } }} />
    <ProcurementFooter />
  </main>;
}
