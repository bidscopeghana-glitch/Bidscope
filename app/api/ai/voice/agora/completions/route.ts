import { z } from "zod";
import { ApiError, apiErrorResponse } from "@/lib/server/api-error";
import { agoraVoiceEnabled, openVoiceBridge } from "@/lib/server/ai/agora-voice-bridge";
import { POST as answerWithBidscopeAi } from "@/app/api/ai/voice/route";
import { requireUser } from "@/lib/server/auth";
import { getEntitlement, primaryOrganization } from "@/lib/server/entitlements";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const inputSchema = z.object({
  stream: z.boolean().optional(),
  messages: z.array(z.object({ role: z.string(), content: z.string().optional() }).passthrough()).min(1).max(20),
}).passthrough();

export async function POST(request: Request) {
  try {
    if (!agoraVoiceEnabled()) throw new ApiError(503, "Live voice is unavailable.", "agora_voice_unavailable");
    const authorization = request.headers.get("authorization") || "";
    const bridge = openVoiceBridge(authorization.replace(/^Bearer\s+/i, ""));
    const input = inputSchema.parse(await request.json());
    const question = [...input.messages].reverse().find(item => item.role === "user")?.content?.trim();
    if (!question || question.length < 2 || question.length > 1000) throw new ApiError(400, "Please ask a short question.", "voice_question_invalid");
    const answerRequest = new Request("https://www.bidscopeghana.com/api/ai/voice", {
      method: "POST", headers: { Authorization: `Bearer ${bridge.accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ question, threadId: bridge.threadId, currentPath: bridge.currentPath }),
    });
    const { user } = await requireUser(answerRequest);
    if (user.id !== bridge.userId) throw new ApiError(401, "Voice account does not match this session.", "agora_voice_account_mismatch");
    const membership = await primaryOrganization(user.id);
    if (!membership || (await getEntitlement(membership.organization_id, user)).tier !== "PREMIUM") throw new ApiError(402, "A BidScope subscription is required for live voice calls.", "premium_required");
    const response = await answerWithBidscopeAi(answerRequest);
    const payload = await response.json() as { data?: { answer?: string }; error?: string };
    if (!response.ok || !payload.data?.answer) throw new ApiError(response.status >= 500 ? 503 : response.status, payload.error || "BidScope AI is temporarily unavailable.", "voice_ai_unavailable");
    const answer = payload.data.answer.replace(/\[[^\]]+\]\([^)]*\)/g, "link available on BidScope").replace(/[#*`]/g, "").slice(0, 1400);
    const id = `chatcmpl-${crypto.randomUUID()}`;
    const created = Math.floor(Date.now() / 1000);
    if (!input.stream) return Response.json({ id, object: "chat.completion", created, model: "bidscope-ai", choices: [{ index: 0, message: { role: "assistant", content: answer }, finish_reason: "stop" }] }, { headers: { "Cache-Control": "no-store" } });
    const chunk = (delta: Record<string, string>, finish_reason: string | null) => `data: ${JSON.stringify({ id, object: "chat.completion.chunk", created, model: "bidscope-ai", choices: [{ index: 0, delta, finish_reason }] })}\n\n`;
    return new Response(`${chunk({ role: "assistant" }, null)}${chunk({ content: answer }, null)}${chunk({}, "stop")}data: [DONE]\n\n`, { headers: { "Content-Type": "text/event-stream; charset=utf-8", "Cache-Control": "no-store, no-transform" } });
  } catch (error) { return apiErrorResponse(error); }
}
