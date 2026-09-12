import { z } from "zod";
import { apiErrorResponse } from "@/lib/server/api-error";
import { requireUser } from "@/lib/server/auth";
import { supabaseRest } from "@/lib/server/supabase-rest";

export const dynamic = "force-dynamic";

const updateSchema = z.object({
  fullName: z.string().trim().max(160).optional(),
  phone: z.string().trim().max(60).optional(),
  jobTitle: z.string().trim().max(120).optional(),
});

export async function GET(request: Request) {
  try {
    const { user } = await requireUser(request);
    const query = new URLSearchParams({ select: "id,email,full_name,phone,job_title,created_at,updated_at", id: `eq.${user.id}`, limit: "1" });
    const { data } = await supabaseRest<unknown[]>(`profiles?${query}`);
    return Response.json({ data: data[0] || { id: user.id, email: user.email, full_name: "", phone: "", job_title: "" } });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function PATCH(request: Request) {
  try {
    const { user } = await requireUser(request);
    const input = updateSchema.parse(await request.json());
    const updates: Record<string, string> = {};
    if (input.fullName !== undefined) updates.full_name = input.fullName;
    if (input.phone !== undefined) updates.phone = input.phone;
    if (input.jobTitle !== undefined) updates.job_title = input.jobTitle;
    const { data } = await supabaseRest<unknown[]>(`profiles?id=eq.${user.id}`, {
      method: "PATCH", headers: { Prefer: "return=representation" }, body: JSON.stringify(updates),
    });
    return Response.json({ data: data[0] });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

