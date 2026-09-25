import { z } from "zod";
import { ApiError, apiErrorResponse } from "@/lib/server/api-error";
import { requireUser } from "@/lib/server/auth";
import { spokenExcerpt } from "@/lib/server/ai/taleh-speech";
import { supabaseRest } from "@/lib/server/supabase-rest";
import { getEntitlement, primaryOrganization } from "@/lib/server/entitlements";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const inputSchema = z.object({ threadId: z.string().uuid() });
type VoiceThread = { id: string; user_id: string };
type VoiceMessage = { content: string; created_at: string };

export async function POST(request: Request) {
  try {
    const { user } = await requireUser(request);
    const membership = await primaryOrganization(user.id);
    if (!membership || (await getEntitlement(membership.organization_id, user)).tier !== "PREMIUM") throw new ApiError(402, "Spoken replies are available to subscribed BidScope members. Written help remains available.", "premium_required");
    const { threadId } = inputSchema.parse(await request.json());
    if (!process.env.GROQ_API_KEY) throw new ApiError(503, "Natural speech is not configured yet. Written replies remain available.", "voice_speech_unavailable");
    const { data: threads } = await supabaseRest<VoiceThread[]>(`ai_threads?select=id,user_id&id=eq.${threadId}&user_id=eq.${user.id}&title=eq.BidScope%20AI%20voice&limit=1`);
    if (!threads[0]) throw new ApiError(403, "This conversation is not available to your account.", "voice_thread_access_denied");
    const { data: messages } = await supabaseRest<VoiceMessage[]>(`ai_messages?select=content,created_at&thread_id=eq.${threadId}&role=eq.assistant&order=created_at.desc&limit=1`);
    const latest = messages[0];
    if (!latest || Date.now() - Date.parse(latest.created_at) > 5 * 60_000) throw new ApiError(400, "That spoken reply has expired. Ask Taleh a new question.", "voice_reply_expired");
    const spoken = spokenExcerpt(latest.content);
    if (!spoken) throw new ApiError(400, "No reply is available to speak.", "voice_reply_empty");

    const today = new Date().toISOString().slice(0, 10);
    const { response: usage } = await supabaseRest(`ai_usage_logs?select=id&user_id=eq.${user.id}&task_type=eq.voice_speech&created_at=gte.${today}T00:00:00.000Z`, { count: "exact" });
    const calls = Number(usage.headers.get("content-range")?.split("/")[1] || 0);
    if (calls >= 10) throw new ApiError(429, "Taleh has reached today's natural-voice limit. Her written replies still work.", "voice_speech_daily_limit");
    // Record the attempt before calling the paid provider; retries also consume the daily cap.
    await supabaseRest("ai_usage_logs", { method: "POST", body: JSON.stringify({
      user_id: user.id, task_type: "voice_speech", feature: "taleh_natural_voice", provider: "groq",
      model: "canopylabs/orpheus-v1-english", estimated_cost_usd: Number((spoken.length * 22 / 1_000_000).toFixed(8)),
      status: "attempted", metadata: { characters: spoken.length, voice: "hannah" },
    }) });
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20_000);
    let audio: Response;
    try {
      audio = await fetch("https://api.groq.com/openai/v1/audio/speech", {
        method: "POST", signal: controller.signal,
        headers: { Authorization: `Bearer ${process.env.GROQ_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({ model: "canopylabs/orpheus-v1-english", voice: "hannah", input: spoken, response_format: "wav" }),
      });
    } finally { clearTimeout(timeout); }
    if (!audio.ok) throw new ApiError(503, "Natural speech is temporarily unavailable. Taleh's written reply is still here.", "voice_speech_provider_unavailable");
    const bytes = await audio.arrayBuffer();
    if (!bytes.byteLength || bytes.byteLength > 2_000_000) throw new ApiError(503, "Natural speech could not be played. Taleh's written reply is still here.", "voice_speech_invalid_audio");
    return new Response(bytes, { headers: { "Content-Type": "audio/wav", "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" } });
  } catch (error) { return apiErrorResponse(error); }
}
