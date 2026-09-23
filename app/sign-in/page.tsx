import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, BookmarkCheck, BriefcaseBusiness, LockKeyhole, SearchCheck } from "lucide-react";
import { BrandLogo } from "@/components/brand/brand-logo";
import { AuthPanel } from "./auth-panel";
import { customerReturnPath } from "@/lib/auth-return";

export const metadata: Metadata = {
  title: "Sign in or create an account | BidScope",
  description: "Access your BidScope account to explore live procurement opportunities, research awards and manage your bidding workspace.",
  robots:{index:false,follow:false},
  alternates:{canonical:"/sign-in"},
};

const benefits = [
  [SearchCheck, "Discover live opportunities", "Review open notices and continue to the official source."],
  [BookmarkCheck, "Keep your shortlist organised", "Save the opportunities that deserve a closer look."],
  [BriefcaseBusiness, "Build a clearer bid pipeline", "Track decisions and prepare your business to respond."],
] as const;

export default async function SignInPage({ searchParams }: { searchParams: Promise<Record<string,string|string[]|undefined>> }) {
  const query = await searchParams;
  return (
    <main className="relative min-h-svh overflow-hidden bg-[#0b3c2f] text-[#17362d] lg:grid lg:grid-cols-[minmax(390px,46%)_1fr] lg:bg-[#f6f3e9]">
      <Image src="/images/bidscope-hero.webp" alt="" fill priority sizes="100vw" className="object-cover object-[63%_center] lg:hidden" />
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(5,39,29,.64),rgba(5,39,29,.82))] lg:hidden" />
      <section className="relative hidden min-h-svh overflow-hidden bg-[#0b3c2f] text-white lg:flex">
        <Image
          src="/images/bidscope-hero.webp"
          alt="Ghanaian business owners reviewing a procurement opportunity"
          fill
          priority
          sizes="46vw"
          className="object-cover object-[62%_center]"
        />
        <div className="absolute inset-0 bg-[linear-gradient(105deg,rgba(7,46,35,.98)_0%,rgba(7,46,35,.89)_45%,rgba(7,46,35,.42)_100%)]" />
        <div className="absolute -bottom-36 -left-28 size-[420px] rounded-full bg-[#b88b37]/24 blur-3xl" />
        <div className="relative z-10 flex w-full flex-col px-[clamp(2.5rem,5vw,5.25rem)] py-[clamp(2.5rem,5vw,4.5rem)]">
          <Link href="/" aria-label="Return to BidScope home" className="w-fit">
            <BrandLogo reversed priority className="h-auto w-[178px]" />
          </Link>

          <div className="my-auto max-w-[520px] py-14">
            <p className="text-xs font-bold uppercase tracking-[.18em] text-[#9de2c4]">Your procurement workspace</p>
            <h1 className="serif mt-5 text-[clamp(2.8rem,4.6vw,5rem)] font-medium leading-[.98] tracking-[-.05em]">
              Better opportunities begin with a clearer view.
            </h1>
            <div className="mt-7 h-1 w-16 rounded-full bg-[#c99d48]" />
            <p className="mt-7 max-w-md text-base leading-7 text-white/72">
              Sign in to turn public procurement information into an organised, better-informed bidding journey.
            </p>

            <div className="mt-9 grid gap-5">
              {benefits.map(([Icon, title, description]) => (
                <div key={title} className="grid grid-cols-[46px_1fr] items-center gap-4">
                  <span className="grid size-11 place-items-center rounded-full border border-[#d6b15d]/35 bg-white/8 text-[#e2bd68] backdrop-blur">
                    <Icon size={19} />
                  </span>
                  <span>
                    <strong className="block text-sm font-bold">{title}</strong>
                    <span className="mt-1 block text-xs leading-5 text-white/60">{description}</span>
                  </span>
                </div>
              ))}
            </div>
          </div>

          <p className="text-xs leading-5 text-white/48">Independent procurement intelligence for Ghanaian businesses.</p>
        </div>
      </section>

      <section className="relative z-10 flex min-h-svh flex-col px-4 py-5 sm:px-8 lg:bg-[radial-gradient(circle_at_88%_4%,rgba(201,157,72,.13),transparent_27%),#f6f3e9] lg:px-[clamp(2.5rem,6vw,7rem)] lg:py-8">
        <div className="flex items-center justify-between">
          <Link href="/" className="lg:hidden" aria-label="BidScope home">
            <BrandLogo reversed priority className="h-auto w-[148px]" />
          </Link>
          <Link href="/" className="ml-auto inline-flex items-center gap-2 rounded-full px-3 py-2 text-sm font-semibold text-white hover:bg-white/10 lg:text-[#456258] lg:hover:bg-white/65">
            <ArrowLeft size={16} /> <span className="hidden sm:inline">Back to BidScope</span><span className="sm:hidden">Back</span>
          </Link>
        </div>

        <div className="my-auto mx-auto w-full max-w-[540px] py-7 sm:py-12">
          <div className="mb-5 flex size-11 items-center justify-center rounded-2xl bg-white/15 text-white shadow-[inset_0_0_0_1px_rgba(255,255,255,.15)] backdrop-blur lg:bg-[#dfece4] lg:text-[#116149]">
            <LockKeyhole size={21} />
          </div>
          <p className="text-xs font-bold uppercase tracking-[.17em] text-[#9de2c4] lg:text-[#16805e]">Secure member access</p>
          <h2 className="serif mt-3 text-[clamp(2rem,5vw,3.35rem)] font-medium leading-[1.02] tracking-[-.045em] text-white lg:text-[#17362d]">Welcome to BidScope.</h2>
          <p className="mt-3 max-w-md text-[15px] leading-6 text-white/75 lg:text-base lg:leading-7 lg:text-[#64776f]">
            Sign in to continue, or create a free account in a few moments.
          </p>
          <div className="mt-6"><AuthPanel initialMode={query.mode === "sign-up" ? "sign-up" : "sign-in"} returnTo={customerReturnPath(query.next)} turnstileSiteKey={process.env.TURNSTILE_SITE_KEY || ""} /></div>
        </div>
      </section>
    </main>
  );
}
