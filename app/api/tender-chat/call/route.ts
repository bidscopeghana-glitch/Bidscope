import { RtcRole, RtcTokenBuilder } from "agora-token";
import { z } from "zod";
import { ApiError, apiErrorResponse } from "@/lib/server/api-error";
import { requireUser, type AuthenticatedUser } from "@/lib/server/auth";
import { createNotification } from "@/lib/server/notifications";
import { audit } from "@/lib/server/procurement/access";
import { encodeFilter, supabaseRest } from "@/lib/server/supabase-rest";

export const dynamic = "force-dynamic";

const noStore = { "Cache-Control": "private, no-store" };
const uuid = z.string().uuid();
const input = z.discriminatedUnion("action", [
  z.object({ action: z.literal("start"), conversationId: uuid }),
  z.object({ action: z.literal("join"), conversationId: uuid, callId: uuid }),
  z.object({ action: z.literal("end"), conversationId: uuid, callId: uuid }),
]);

type Membership = { organization_id: string; user_id: string; role: string; procurement_role: string };
type Conversation = {
  id: string;
  tender_id: string;
  buyer_organization_id: string;
  supplier_organization_id: string;
  status: "open" | "closed";
};
type TenderCall = {
  id: string;
  conversation_id: string;
  channel_name: string;
  started_by_user_id: string;
  started_by_organization_id: string;
  ended_by_user_id: string | null;
  status: "active" | "ended" | "expired";
  started_at: string;
  ended_at: string | null;
  expires_at: string;
};

function canManageBuyer(membership: Membership | undefined) {
  return Boolean(
    membership &&
      (membership.role === "owner" ||
        ["procurement_manager", "procurement_officer"].includes(membership.procurement_role)),
  );
}

async function conversationAccess(user: AuthenticatedUser, conversationId: string) {
  const [{ data: conversations }, { data: member }] = await Promise.all([
    supabaseRest<Conversation[]>(
      `tender_conversations?select=id,tender_id,buyer_organization_id,supplier_organization_id,status&id=eq.${encodeFilter(conversationId)}&limit=1`,
      { serviceRole: true },
    ),
    supabaseRest<Membership[]>(
      `organization_members?select=organization_id,user_id,role,procurement_role&user_id=eq.${encodeFilter(user.id)}`,
      { serviceRole: true },
    ),
  ]);
  const conversation = conversations[0];
  if (!conversation) throw new ApiError(404, "Tender conversation not found.", "conversation_not_found");
  const buyerMembership = member.find((item) => item.organization_id === conversation.buyer_organization_id);
  const supplierMembership = member.find((item) => item.organization_id === conversation.supplier_organization_id);
  if (canManageBuyer(buyerMembership))
    return { conversation, side: "buyer" as const, organizationId: conversation.buyer_organization_id };
  if (supplierMembership)
    return { conversation, side: "supplier" as const, organizationId: conversation.supplier_organization_id };
  throw new ApiError(403, "You are not a participant in this tender conversation.", "conversation_access_denied");
}

function agoraConfiguration() {
  const appId = process.env.AGORA_APP_ID?.trim();
  const certificate = process.env.AGORA_APP_CERTIFICATE?.trim();
  if (!appId || !certificate)
    throw new ApiError(503, "BidScope voice calling is not configured yet.", "agora_unavailable");
  return { appId, certificate };
}

async function activeCall(conversationId: string) {
  const now = new Date().toISOString();
  await supabaseRest(
    `tender_call_sessions?conversation_id=eq.${encodeFilter(conversationId)}&status=eq.active&expires_at=lt.${encodeFilter(now)}`,
    { method: "PATCH", body: JSON.stringify({ status: "expired", ended_at: now }), serviceRole: true },
  );
  const { data } = await supabaseRest<TenderCall[]>(
    `tender_call_sessions?select=*&conversation_id=eq.${encodeFilter(conversationId)}&status=eq.active&expires_at=gt.${encodeFilter(now)}&order=started_at.desc&limit=1`,
    { serviceRole: true },
  );
  return data[0] || null;
}

function publicCall(call: TenderCall, userId: string) {
  return {
    id: call.id,
    conversationId: call.conversation_id,
    status: call.status,
    startedByMe: call.started_by_user_id === userId,
    startedAt: call.started_at,
    endedAt: call.ended_at,
    expiresAt: call.expires_at,
  };
}

function joinAccess(call: TenderCall, userId: string) {
  const { appId, certificate } = agoraConfiguration();
  const expiresIn = Math.max(60, Math.min(1800, Math.floor((Date.parse(call.expires_at) - Date.now()) / 1000)));
  const token = RtcTokenBuilder.buildTokenWithUserAccount(
    appId,
    certificate,
    call.channel_name,
    userId,
    RtcRole.PUBLISHER,
    expiresIn,
    expiresIn,
  );
  return {
    appId,
    channel: call.channel_name,
    token,
    uid: userId,
    expiresAt: new Date(Date.now() + expiresIn * 1000).toISOString(),
  };
}

export async function GET(request: Request) {
  try {
    const { user } = await requireUser(request);
    const conversationId = uuid.parse(new URL(request.url).searchParams.get("conversationId"));
    await conversationAccess(user, conversationId);
    const call = await activeCall(conversationId);
    return Response.json({ data: call ? publicCall(call, user.id) : null }, { headers: noStore });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const { user } = await requireUser(request);
    const body = input.parse(await request.json());
    const access = await conversationAccess(user, body.conversationId);
    if (body.action === "end") {
      const { data: calls } = await supabaseRest<TenderCall[]>(
        `tender_call_sessions?select=*&id=eq.${encodeFilter(body.callId)}&conversation_id=eq.${encodeFilter(body.conversationId)}&status=eq.active&limit=1`,
        { serviceRole: true },
      );
      const call = calls[0];
      if (call) {
        const endedAt = new Date().toISOString();
        await supabaseRest(`tender_call_sessions?id=eq.${encodeFilter(call.id)}`, {
          method: "PATCH",
          body: JSON.stringify({ status: "ended", ended_at: endedAt, ended_by_user_id: user.id }),
          serviceRole: true,
        });
        await audit({
          organizationId: access.conversation.buyer_organization_id,
          tenderId: access.conversation.tender_id,
          actorUserId: user.id,
          action: "tender_voice_call_ended",
          entityType: "tender_call_session",
          entityId: call.id,
          metadata: { conversationId: access.conversation.id, side: access.side },
        });
      }
      return Response.json({ data: { ended: true } }, { headers: noStore });
    }
    if (access.conversation.status !== "open")
      throw new ApiError(409, "Voice calls are unavailable in a closed conversation.", "conversation_closed");
    let call = await activeCall(body.conversationId);
    if (body.action === "join" && (!call || call.id !== body.callId))
      throw new ApiError(410, "This voice call has ended or expired.", "call_unavailable");
    if (body.action === "start" && !call) {
      const expiresAt = new Date(Date.now() + 30 * 60_000).toISOString();
      const { data } = await supabaseRest<TenderCall[]>("tender_call_sessions", {
        method: "POST",
        headers: { Prefer: "return=representation" },
        body: JSON.stringify({
          conversation_id: access.conversation.id,
          channel_name: `bs_${crypto.randomUUID().replaceAll("-", "")}`,
          started_by_user_id: user.id,
          started_by_organization_id: access.organizationId,
          expires_at: expiresAt,
        }),
        serviceRole: true,
      });
      call = data[0];
      const recipientOrganizationId = access.side === "buyer"
        ? access.conversation.supplier_organization_id
        : access.conversation.buyer_organization_id;
      const recipientSide = access.side === "buyer" ? "supplier" : "buyer";
      const { data: recipients } = await supabaseRest<Membership[]>(
        `organization_members?select=organization_id,user_id,role,procurement_role&organization_id=eq.${encodeFilter(recipientOrganizationId)}`,
        { serviceRole: true },
      );
      const eligibleRecipients = recipients.filter(
        (recipient) => recipient.user_id !== user.id && (recipientSide === "supplier" || canManageBuyer(recipient)),
      );
      await Promise.all(eligibleRecipients.map((recipient) => createNotification({
        userId: recipient.user_id,
        organizationId: recipientOrganizationId,
        type: "system",
        title: "Incoming BidScope voice call",
        message: "A participant started a voice call in a managed tender conversation.",
        relatedEntityType: "tender_call_session",
        relatedEntityId: call!.id,
        relatedUrl: `${recipientSide === "buyer" ? "/procurement/messages" : "/customer/messages"}/${access.conversation.id}`,
        priority: "high",
        frequencyOverride: "instant",
        dedupeKey: `tender-call-${call!.id}-${recipient.user_id}`,
      })));
      await audit({
        organizationId: access.conversation.buyer_organization_id,
        tenderId: access.conversation.tender_id,
        actorUserId: user.id,
        action: "tender_voice_call_started",
        entityType: "tender_call_session",
        entityId: call.id,
        metadata: { conversationId: access.conversation.id, side: access.side },
      });
    }
    if (!call) throw new ApiError(500, "The voice call could not be created.", "call_create_failed");
    return Response.json({ data: { call: publicCall(call, user.id), access: joinAccess(call, user.id) } }, { status: body.action === "start" ? 201 : 200, headers: noStore });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
