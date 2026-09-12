import { BadgeCheck, CircleAlert, CircleCheck, Clock3, Trophy, XCircle } from "lucide-react";

export type TenderStatus = "new" | "closing-soon" | "awarded" | "open" | "closed" | "deadline-extended" | "cancelled" | "verified";

const styles: Record<TenderStatus, { label: string; className: string; icon: typeof CircleCheck }> = {
  new: { label: "New tender", className: "border-blue-200 bg-blue-50 text-blue-800", icon: CircleAlert },
  "closing-soon": { label: "Closing soon", className: "border-amber-300 bg-amber-50 text-amber-900", icon: Clock3 },
  awarded: { label: "Contract awarded", className: "border-[#D4AF37]/45 bg-[#D4AF37]/15 text-[#084D33]", icon: Trophy },
  open: { label: "Open", className: "border-emerald-200 bg-emerald-50 text-emerald-800", icon: CircleCheck },
  closed: { label: "Closed", className: "border-slate-200 bg-slate-100 text-slate-700", icon: XCircle },
  "deadline-extended": { label: "Deadline extended", className: "border-violet-200 bg-violet-50 text-violet-800", icon: Clock3 },
  cancelled: { label: "Cancelled", className: "border-red-200 bg-red-50 text-red-800", icon: XCircle },
  verified: { label: "Verified", className: "border-emerald-300 bg-emerald-50 text-[#084D33]", icon: BadgeCheck },
};

export function TenderStatusBadge({ status }: { status: TenderStatus }) {
  const item = styles[status];
  const Icon = item.icon;
  return <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold ${item.className}`}><Icon size={13} aria-hidden="true" />{item.label}</span>;
}
