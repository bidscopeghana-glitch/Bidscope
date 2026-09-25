import { randomInt, randomUUID } from "node:crypto";
import { Agent, AgoraClient, Area, CustomLLM, DeepgramSTT, MiniMaxTTS } from "agora-agents";
import { RtcRole, RtcTokenBuilder } from "agora-token";
import { z } from "zod";
import { ApiError, apiErrorResponse } from "@/lib/server/api-error";
import { requireUser } from "@/lib/server/auth";
import { agoraVoiceEnabled, sealVoiceBridge, verifyVoiceStopProof, voiceStopProof } from "@/lib/server/ai/agora-voice-bridge";
import { supabaseRest } from "@/lib/server/supabase-rest";
import { getEntitlement, primaryOrganization } from "@/lib/server/entitlements";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;
const inputSchema = z.object({ currentPath: z.string().max(500).regex(/^\/(?!\/)/).default("/customer") });

function agoraClient() {
  return new AgoraClient({ area: Area.US, appId: process.env.AGORA_APP_ID!, appCertificate: process.env.AGORA_APP_CERTIFICATE! });
}

async function subscribedUser(request: Request) {
  const { user, accessToken } = await requireUser(request);
  const membership = await primaryOrganization(user.id);
  const entitled = membership ? await getEntitlement(membership.organization_id, user) : null;
  return { user, accessToken, eligible: entitled?.tier === "PREMIUM" };
}

export async function GET(request: Request) {
  try {
    const { eligible } = await subscribedUser(request);
    return Response.json({ enabled: agoraVoiceEnabled(), eligible }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return apiErrorResponse(error); }
}

export async function POST(request: Request) {
  try {
    if (!agoraVoiceEnabled()) throw new ApiError(503, "Agora voice is not enabled yet. Please use Taleh's text chat.", "agora_voice_unavailable");
    const { user, accessToken, eligible } = await subscribedUser(request);
    if (!eligible) throw new ApiError(402, "Taleh's live Agora calls are available to subscribed BidScope members. You can still use text help or compare plans.", "premium_required");
    const input = inputSchema.parse(await request.json());
    const base = (process.env.NEXT_PUBLIC_SITE_URL || "https://www.bidscopeghana.com").replace(/\/$/, "");
    if (!base.startsWith("https://") || new URL(base).hostname !== "www.bidscopeghana.com") throw new ApiError(503, "Agora voice needs the production HTTPS endpoint.", "agora_voice_endpoint_unavailable");
    const jwt = accessToken.split(".");
    const jwtExpiry = jwt.length === 3 ? Number((JSON.parse(Buffer.from(jwt[1], "base64url").toString("utf8")) as { exp?: number }).exp || 0) * 1000 : 0;
    const expiresAt = Math.min(Date.now() + 10 * 60_000, jwtExpiry - 30_000);
    if (expiresAt < Date.now() + 60_000) throw new ApiError(401, "Your sign-in session is almost over. Refresh and try again.", "voice_auth_expiring");
    const channel = `taleh-${randomUUID()}`;
    const uid = randomInt(1000, 2_000_000_000);
    const { data: threads } = await supabaseRest<Array<{ id: string }>>("ai_threads", { method: "POST", headers: { Prefer: "return=representation" }, body: JSON.stringify({ user_id: user.id, title: "BidScope AI voice" }) });
    if (!threads[0]) throw new ApiError(503, "Voice conversation storage is unavailable.", "voice_storage_unavailable");
    const bridgeToken = sealVoiceBridge({ accessToken, userId: user.id, expiresAt, channel, currentPath: input.currentPath, threadId: threads[0].id });
    const client = agoraClient();
    const agent = new Agent({ client })
      .withStt(new DeepgramSTT({ model: "nova-3", language: "en-US", smartFormat: true }))
      .withLlm(new CustomLLM({
        apiKey: bridgeToken, url: `${base}/api/ai/voice/agora/completions`, model: "bidscope-ai",
        maxHistory: 2, maxTokens: 350,
        systemMessages: [{ role: "system", content: "You are Taleh, BidScope's AI receptionist. BidScope's own AI endpoint controls every answer and permission." }],
        greetingMessage: "Hello, I'm Taleh, your BidScope receptionist. How can I help you today?",
        failureMessage: "I'm sorry, I couldn't answer that just now. Please try the text chat or contact our team.",
      }))
      .withTts(new MiniMaxTTS({ model: "speech-2.6-turbo", voiceId: "English_captivating_female1" }));
    const session = agent.createSession({ name: `taleh-${randomUUID()}`, channel, agentUid: "0", remoteUids: [String(uid)], idleTimeout: 120, expiresIn: 600 });
    const agentId = await session.start();
    const ttl = Math.max(60, Math.floor((expiresAt - Date.now()) / 1000));
    const token = RtcTokenBuilder.buildTokenWithUid(process.env.AGORA_APP_ID!, process.env.AGORA_APP_CERTIFICATE!, channel, uid, RtcRole.PUBLISHER, ttl, ttl);
    return Response.json({ data: { appId: process.env.AGORA_APP_ID, channel, uid, token, agentId, stopProof: voiceStopProof(user.id, agentId), expiresAt } }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return apiErrorResponse(error); }
}

export async function DELETE(request: Request) {
  try {
    if (!agoraVoiceEnabled()) throw new ApiError(503, "Agora voice is unavailable.", "agora_voice_unavailable");
    const { user } = await requireUser(request);
    const input = z.object({ agentId: z.string().min(8).max(200), stopProof: z.string().regex(/^[0-9a-f]{64}$/) }).parse(await request.json());
    if (!verifyVoiceStopProof(user.id, input.agentId, input.stopProof)) throw new ApiError(403, "This voice session is not yours.", "voice_stop_denied");
    await agoraClient().stopAgent(input.agentId);
    return Response.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return apiErrorResponse(error); }
}
