import { supabaseRest } from "@/lib/server/supabase-rest";

export const dynamic = "force-dynamic";

async function count(path: string) {
  const { response } = await supabaseRest<unknown[]>(path, { count: "exact", headers: { Range: "0-0" } });
  const range = response.headers.get("content-range");
  const total = range?.split("/")[1];
  return total && total !== "*" ? Number(total) : 0;
}

export async function GET() {
  try {
    const now = new Date();
    const week = new Date(now); week.setDate(week.getDate() + 7);
    const recent = new Date(now); recent.setDate(recent.getDate() - 7);
    const [active, closingThisWeek, addedRecently, sources] = await Promise.all([
      count("procurement_opportunities?select=id&status=eq.OPEN&published_at=not.is.null"),
      count(`procurement_opportunities?select=id&status=eq.OPEN&deadline_at=gte.${encodeURIComponent(now.toISOString())}&deadline_at=lte.${encodeURIComponent(week.toISOString())}`),
      count(`procurement_opportunities?select=id&published_at=gte.${encodeURIComponent(recent.toISOString())}`),
      count("procurement_sources?select=id&status=eq.ACTIVE"),
    ]);
    return Response.json({ data: { active, closingThisWeek, addedRecently, sources } }, { headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=900" } });
  } catch {
    return Response.json({ data: null }, { status: 200, headers: { "Cache-Control": "no-store" } });
  }
}
