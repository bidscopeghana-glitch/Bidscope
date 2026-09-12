import type { Metadata } from "next";
import { ProcurementFooter, ProcurementHeader } from "@/components/procurement/site-shell";

export const metadata: Metadata = {
  title: "Terms of Service | BidScope Ghana",
  description: "Terms governing use of the BidScope Ghana procurement intelligence service.",
};

export default function TermsPage() {
  return (
    <main className="min-h-screen bg-[#f7f4eb] text-[#12352a]">
      <ProcurementHeader />
      <article className="mx-auto max-w-3xl px-6 py-16 sm:py-24">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#84651f]">BidScope Ghana</p>
        <h1 className="mt-3 text-4xl font-bold tracking-tight sm:text-5xl">Terms of Service</h1>
        <p className="mt-5 text-base leading-8 text-[#496159]">Last updated: 12 September 2026</p>

        <div className="mt-10 space-y-8 text-base leading-8 text-[#334d45]">
          <section>
            <h2 className="text-xl font-semibold text-[#12352a]">Using BidScope</h2>
            <p className="mt-2">BidScope provides procurement discovery and research tools. You must use the service lawfully, keep your account secure and provide accurate information when creating or maintaining an account.</p>
          </section>
          <section>
            <h2 className="text-xl font-semibold text-[#12352a]">Opportunity information</h2>
            <p className="mt-2">We organise information from official and other identified sources to help businesses research opportunities. Source notices remain authoritative. You are responsible for confirming requirements, deadlines and eligibility with the issuing organisation before bidding.</p>
          </section>
          <section>
            <h2 className="text-xl font-semibold text-[#12352a]">Availability and acceptable use</h2>
            <p className="mt-2">You may not interfere with the service, attempt unauthorised access, misuse data or use BidScope to break applicable law. Features and availability may change as the service develops.</p>
          </section>
          <section>
            <h2 className="text-xl font-semibold text-[#12352a]">Contact</h2>
            <p className="mt-2">Questions about these terms can be sent to bidscopeghana@gmail.com.</p>
          </section>
        </div>
      </article>
      <ProcurementFooter />
    </main>
  );
}
