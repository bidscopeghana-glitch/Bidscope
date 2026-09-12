import { BrandLogo } from "./brand-logo";

export function BidScopeEmailSignature({ name, role, email, phone }: { name: string; role: string; email: string; phone?: string }) {
  return <div style={{ color: "#1D1D1D", fontFamily: "Arial, sans-serif", fontSize: 13, lineHeight: 1.6 }}><BrandLogo className="h-auto w-[230px]"/><strong style={{ color: "#084D33", display: "block", marginTop: 12 }}>{name}</strong><span>{role}</span><div style={{ marginTop: 8 }}>{email}{phone ? ` · ${phone}` : null}<br/><a href="https://www.bidscopeghana.com" style={{ color: "#084D33" }}>bidscopeghana.com</a></div><small style={{ color: "#5f6f68" }}>Where Opportunity Finds You.</small></div>;
}
