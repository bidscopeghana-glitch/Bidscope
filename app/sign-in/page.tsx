import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, ArrowRight, BookmarkCheck, BriefcaseBusiness, Check, LockKeyhole, SearchCheck, ShieldCheck } from "lucide-react";
import { BrandLogo } from "@/components/brand/brand-logo";

export const metadata: Metadata = {
  title: "Sign in or create an account | BidScope",
  description: "Access your BidScope account to explore live procurement opportunities, research awards and manage your bidding workspace.",
};

const benefits = [
  [SearchCheck, "Discover live opportunities", "Review open notices and continue to the official source."],
  [BookmarkCheck, "Keep your shortlist organised", "Save the opportunities that deserve a closer look."],
  [BriefcaseBusiness, "Build a clearer bid pipeline", "Track decisions and prepare your business to respond."],
] as const;

export default function SignInPage() {
  return (
    <main className="min-h-svh bg-[#f6f3e9] text-[#17362d] lg:grid lg:grid-cols-[minmax(390px,46%)_1fr]">
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

      <section className="relative flex min-h-svh flex-col bg-[radial-gradient(circle_at_88%_4%,rgba(201,157,72,.13),transparent_27%),#f6f3e9] px-5 py-5 sm:px-8 lg:px-[clamp(2.5rem,6vw,7rem)] lg:py-8">
        <div className="flex items-center justify-between">
          <Link href="/" className="lg:hidden" aria-label="BidScope home">
            <BrandLogo priority className="h-auto w-[148px]" />
          </Link>
          <Link href="/" className="ml-auto inline-flex items-center gap-2 rounded-full px-3 py-2 text-sm font-semibold text-[#456258] hover:bg-white/65">
            <ArrowLeft size={16} /> <span className="hidden sm:inline">Back to BidScope</span><span className="sm:hidden">Back</span>
          </Link>
        </div>

        <div className="my-auto mx-auto w-full max-w-[520px] py-10 sm:py-14">
          <div className="mb-7 flex size-12 items-center justify-center rounded-2xl bg-[#dfece4] text-[#116149] shadow-[inset_0_0_0_1px_rgba(17,97,73,.08)]">
            <LockKeyhole size={21} />
          </div>
          <p className="text-xs font-bold uppercase tracking-[.17em] text-[#16805e]">Secure member access</p>
          <h2 className="serif mt-3 text-[clamp(2.25rem,5vw,3.45rem)] font-medium leading-[1.02] tracking-[-.045em]">Welcome to BidScope.</h2>
          <p className="mt-4 max-w-md text-base leading-7 text-[#64776f]">
            Sign in or create your free account to access live opportunities, past awards and your BidScope workspace.
          </p>

          <div className="mt-9 rounded-[26px] border border-[#17362d]/10 bg-[#fffdf8] p-5 shadow-[0_24px_70px_rgba(19,62,49,.11)] sm:p-7">
            <a
              href="/api/auth/google"
              className="group flex min-h-14 w-full items-center justify-center gap-3 rounded-2xl border border-[#17362d]/15 bg-white px-4 text-sm font-bold text-[#17362d] shadow-sm transition hover:-translate-y-0.5 hover:border-[#116149]/30 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#116149]/30"
            >
              <span aria-hidden="true" className="grid size-7 place-items-center rounded-full border border-[#17362d]/10 bg-white font-extrabold text-[#4285f4] shadow-sm">G</span>
              Continue with Google
              <ArrowRight className="ml-auto transition group-hover:translate-x-0.5" size={17} />
            </a>

            <p className="mt-4 text-center text-xs leading-5 text-[#718079]">
              One secure step for both sign in and account creation.
            </p>

            <div className="mt-6 border-t border-[#17362d]/10 pt-5">
              <p className="flex items-start gap-3 text-xs leading-5 text-[#526a61]">
                <ShieldCheck className="mt-0.5 shrink-0 text-[#116149]" size={17} />
                Google confirms your identity securely. BidScope never receives or stores your Google password.
              </p>
            </div>
          </div>

          <div className="mt-6 grid gap-3 text-sm text-[#526a61] sm:grid-cols-2">
            <p className="flex items-center gap-2"><span className="grid size-5 place-items-center rounded-full bg-[#dfece4] text-[#116149]"><Check size={12} /></span>No card required</p>
            <p className="flex items-center gap-2"><span className="grid size-5 place-items-center rounded-full bg-[#dfece4] text-[#116149]"><Check size={12} /></span>Free account available</p>
          </div>

          <p className="mt-8 text-xs leading-5 text-[#78857f]">
            By continuing, you agree to our <Link className="font-semibold text-[#315b4e] underline-offset-2 hover:underline" href="/terms">Terms</Link> and acknowledge our <Link className="font-semibold text-[#315b4e] underline-offset-2 hover:underline" href="/privacy">Privacy Policy</Link>.
          </p>
        </div>
      </section>
    </main>
  );
}
