import type { Metadata } from "next";
import { ProcurementFooter, ProcurementHeader } from "@/components/procurement/site-shell";

export const metadata: Metadata = {
  title: "Privacy Policy | BidScope Ghana",
  description: "How BidScope Ghana handles information when you use our services.",
};

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-[#f7f4eb] text-[#12352a]">
      <ProcurementHeader />
      <article className="mx-auto max-w-3xl px-6 py-16 sm:py-24">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#84651f]">BidScope Ghana</p>
        <h1 className="mt-3 text-4xl font-bold tracking-tight sm:text-5xl">Privacy Policy</h1>
        <p className="mt-5 text-base leading-8 text-[#496159]">Last updated: 12 September 2026</p>

        <div className="mt-10 space-y-8 text-base leading-8 text-[#334d45]">
          <section>
            <h2 className="text-xl font-semibold text-[#12352a]">Information we collect</h2>
            <p className="mt-2">When you sign in, we may receive your name, email address and profile image from your chosen authentication provider. We also collect information you choose to save in BidScope and basic technical data needed to operate and secure the service.</p>
          </section>
          <section>
            <h2 className="text-xl font-semibold text-[#12352a]">How we use information</h2>
            <p className="mt-2">We use this information to provide your account, personalise procurement research features, maintain saved opportunities, improve BidScope and protect the service from misuse. We do not sell personal information.</p>
          </section>
          <section>
            <h2 className="text-xl font-semibold text-[#12352a]">Service providers and retention</h2>
            <p className="mt-2">We use trusted infrastructure and authentication providers to operate BidScope. Information is retained only for as long as reasonably necessary to provide the service, meet legal obligations and resolve disputes.</p>
          </section>
          <section>
            <h2 className="text-xl font-semibold text-[#12352a]">Your choices</h2>
            <p className="mt-2">You may sign out at any time. To request access, correction or deletion of account information, contact us at bidscopeghana@gmail.com.</p>
          </section>
        </div>
      </article>
      <ProcurementFooter />
    </main>
  );
}
