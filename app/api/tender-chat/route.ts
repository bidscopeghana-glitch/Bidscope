import { z } from "zod";
import { ApiError, apiErrorResponse } from "@/lib/server/api-error";
import { requireUser, type AuthenticatedUser } from "@/lib/server/auth";
import { createNotification } from "@/lib/server/notifications";
import { audit, bidsAreOpen, tenderById } from "@/lib/server/procurement/access";
import { encodeFilter, supabaseRest } from "@/lib/server/supabase-rest";

export const dynamic = "force-dynamic";
const noStore = { "Cache-Control": "private, no-store" };
const uuid = z.string().uuid();
const input = z.discriminatedUnion("action", [
  z.object({ action: z.literal("open"), bidId: uuid }),
  z.object({ action: z.literal("send"), conversationId: uuid, message: z.string().trim().min(1).max(4000) }),
  z.object({ action: z.literal("mark_read"), conversationId: uuid }),
  z.object({ action: z.literal("close"), conversationId: uuid }),
]);

type Membership = { organization_id: string; role: string; procurement_role: string };
type OrganizationContact = { organization_id: string; user_id: string; role: string };
type ContactProfile = { id: string; full_name: string | null; avatar_url: string | null };
type Conversation = {
  id: string;
  tender_id: string;
  supplier_bid_id: string;
  buyer_organization_id: string;
  supplier_organization_id: string;
  created_by: string;
  status: "open" | "closed";
  buyer_last_read_at: string | null;
  supplier_last_read_at: string | null;
  last_message_at: string | null;
  created_at: string;
  updated_at: string;
};
type Bid = { id: string; tender_id: string; supplier_organization_id: string; status: string };
type Message = { id: string; conversation_id: string; sender_user_id: string; sender_organization_id: string; body: string; created_at: string };

async function memberships(userId: string) {
  const { data } = await supabaseRest<Membership[]>(
    `organization_members?select=organization_id,role,procurement_role&user_id=eq.${encodeFilter(userId)}`,
    { serviceRole: true },
  );
  return data;
}

function canManageBuyer(membership: Membership | undefined) {
  return Boolean(
    membership &&
      (membership.role === "owner" ||
        ["procurement_manager", "procurement_officer"].includes(membership.procurement_role)),
  );
}

async function authorizeConversation(user: AuthenticatedUser, conversationId: string) {
  const { data } = await supabaseRest<Conversation[]>(
    `tender_conversations?select=*&id=eq.${encodeFilter(conversationId)}&limit=1`,
    { serviceRole: true },
  );
  const conversation = data[0];
  if (!conversation) throw new ApiError(404, "Tender conversation not found.", "conversation_not_found");
  const member = await memberships(user.id);
  const buyerMembership = member.find((item) => item.organization_id === conversation.buyer_organization_id);
  const supplierMembership = member.find((item) => item.organization_id === conversation.supplier_organization_id);
  if (canManageBuyer(buyerMembership)) return { conversation, side: "buyer" as const, organizationId: conversation.buyer_organization_id };
  if (supplierMembership) return { conversation, side: "supplier" as const, organizationId: conversation.supplier_organization_id };
  throw new ApiError(403, "You are not a participant in this tender conversation.", "conversation_access_denied");
}

async function assertChatEligible(bid: Bid) {
  if (["draft", "withdrawn"].includes(bid.status))
    throw new ApiError(409, "Chat becomes available after a bid is submitted.", "bid_not_submitted");
  const tender = await tenderById(bid.tender_id);
  if (!bidsAreOpen(tender))
    throw new ApiError(409, "Direct buyer-seller chat opens after sealed bids are released.", "sealed_bid_chat_unavailable");
  return tender;
}

async function enrich(conversations: Conversation[], user: AuthenticatedUser) {
  if (!conversations.length) return [];
  const member = await memberships(user.id);
  const tenderIds = [...new Set(conversations.map((item) => item.tender_id))];
  const organizationIds = [...new Set(conversations.flatMap((item) => [item.buyer_organization_id, item.supplier_organization_id]))];
  const conversationIds = conversations.map((item) => item.id);
  const [{ data: tenders }, { data: organizations }, { data: messages }, { data: organizationContacts }] = await Promise.all([
    supabaseRest<Array<{ id: string; title: string; reference_number: string | null; status: string; submission_deadline: string }>>(
      `procurement_tenders?select=id,title,reference_number,status,submission_deadline&id=in.(${tenderIds.join(",")})`,
      { serviceRole: true },
    ),
    supabaseRest<Array<{ id: string; name: string }>>(
      `organizations?select=id,name&id=in.(${organizationIds.join(",")})`,
      { serviceRole: true },
    ),
    supabaseRest<Message[]>(
      `tender_messages?select=id,conversation_id,sender_user_id,sender_organization_id,body,created_at&conversation_id=in.(${conversationIds.join(",")})&order=created_at.desc&limit=1000`,
      { serviceRole: true },
    ),
    supabaseRest<OrganizationContact[]>(
      `organization_members?select=organization_id,user_id,role&organization_id=in.(${organizationIds.join(",")})`,
      { serviceRole: true },
    ),
  ]);
  const contactUserIds = [...new Set(organizationContacts.map((item) => item.user_id))];
  const { data: contactProfiles } = contactUserIds.length
    ? await supabaseRest<ContactProfile[]>(
        `profiles?select=id,full_name,avatar_url&id=in.(${contactUserIds.join(",")})`,
        { serviceRole: true },
      )
    : { data: [] };
  const tenderMap = new Map(tenders.map((item) => [item.id, item]));
  const organizationMap = new Map(organizations.map((item) => [item.id, item]));
  const profileMap = new Map(contactProfiles.map((profile) => [profile.id, profile]));
  const contactMap = new Map<string, ContactProfile>();
  const rolePriority = { owner: 0, admin: 1, member: 2 } as const;
  for (const contact of [...organizationContacts].sort((a, b) => (rolePriority[a.role as keyof typeof rolePriority] ?? 3) - (rolePriority[b.role as keyof typeof rolePriority] ?? 3))) {
    const profile = profileMap.get(contact.user_id);
    if (profile && !contactMap.has(contact.organization_id)) contactMap.set(contact.organization_id, profile);
  }
  const lastMessage = new Map<string, Message>();
  for (const message of messages) if (!lastMessage.has(message.conversation_id)) lastMessage.set(message.conversation_id, message);
  return conversations.map((conversation) => {
    const buyerMembership = member.find((item) => item.organization_id === conversation.buyer_organization_id);
    const side = canManageBuyer(buyerMembership) ? "buyer" : "supplier";
    const viewerOrganizationId = side === "buyer" ? conversation.buyer_organization_id : conversation.supplier_organization_id;
    const readAt = side === "buyer" ? conversation.buyer_last_read_at : conversation.supplier_last_read_at;
    const unreadCount = messages.filter(
      (message) => message.conversation_id === conversation.id && message.sender_organization_id !== viewerOrganizationId && (!readAt || Date.parse(message.created_at) > Date.parse(readAt)),
    ).length;
    const counterpartyOrganizationId = side === "buyer" ? conversation.supplier_organization_id : conversation.buyer_organization_id;
    const counterpartyOrganization = organizationMap.get(counterpartyOrganizationId);
    return {
      ...conversation,
      side,
      tender: tenderMap.get(conversation.tender_id) || null,
      buyer: organizationMap.get(conversation.buyer_organization_id) || null,
      supplier: organizationMap.get(conversation.supplier_organization_id) || null,
      counterparty: counterpartyOrganization ? { ...counterpartyOrganization, representative: contactMap.get(counterpartyOrganizationId) || null } : null,
      lastMessage: lastMessage.get(conversation.id) || null,
      unreadCount,
    };
  });
}

export async function GET(request: Request) {
  try {
    const { user } = await requireUser(request);
    const conversationId = new URL(request.url).searchParams.get("conversationId");
    if (conversationId) {
      uuid.parse(conversationId);
      const access = await authorizeConversation(user, conversationId);
      const [{ data: messages }, conversation] = await Promise.all([
        supabaseRest<Message[]>(
          `tender_messages?select=*&conversation_id=eq.${conversationId}&order=created_at.asc&limit=500`,
          { serviceRole: true },
        ),
        enrich([access.conversation], user),
      ]);
      const senderIds = [...new Set(messages.map((message) => message.sender_user_id))];
      const { data: profiles } = senderIds.length
        ? await supabaseRest<Array<{ id: string; full_name: string | null; email: string; avatar_url: string | null }>>(
            `profiles?select=id,full_name,email,avatar_url&id=in.(${senderIds.join(",")})`,
            { serviceRole: true },
          )
        : { data: [] };
      const profileMap = new Map(profiles.map((profile) => [profile.id, profile]));
      return Response.json(
        { data: { conversation: conversation[0], messages: messages.map((message) => ({ ...message, sender: profileMap.get(message.sender_user_id) || null, mine: message.sender_user_id === user.id })) } },
        { headers: noStore },
      );
    }
    const member = await memberships(user.id);
    const buyerIds = member.filter(canManageBuyer).map((item) => item.organization_id);
    const supplierIds = member.map((item) => item.organization_id);
    if (!supplierIds.length) return Response.json({ data: [] }, { headers: noStore });
    const filters = [
      buyerIds.length ? `buyer_organization_id.in.(${buyerIds.join(",")})` : null,
      supplierIds.length ? `supplier_organization_id.in.(${supplierIds.join(",")})` : null,
    ].filter(Boolean).join(",");
    const { data } = await supabaseRest<Conversation[]>(
      `tender_conversations?select=*&or=(${filters})&order=last_message_at.desc.nullslast,created_at.desc&limit=100`,
      { serviceRole: true },
    );
    return Response.json({ data: await enrich(data, user) }, { headers: noStore });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const { user } = await requireUser(request);
    const body = input.parse(await request.json());
    if (body.action === "open") {
      const { data: bids } = await supabaseRest<Bid[]>(
        `supplier_bids?select=id,tender_id,supplier_organization_id,status&id=eq.${body.bidId}&limit=1`,
        { serviceRole: true },
      );
      const bid = bids[0];
      if (!bid) throw new ApiError(404, "Managed tender bid not found.", "managed_bid_not_found");
      const tender = await assertChatEligible(bid);
      const member = await memberships(user.id);
      const buyerMembership = member.find((item) => item.organization_id === tender.organization_id);
      const supplierMembership = member.find((item) => item.organization_id === bid.supplier_organization_id);
      if (!canManageBuyer(buyerMembership) && !supplierMembership)
        throw new ApiError(403, "Only the managed tender buyer and bidding seller can open this chat.", "chat_participant_required");
      const { data: existing } = await supabaseRest<Conversation[]>(
        `tender_conversations?select=*&supplier_bid_id=eq.${body.bidId}&limit=1`,
        { serviceRole: true },
      );
      if (existing[0]) return Response.json({ data: existing[0] }, { headers: noStore });
      const { data } = await supabaseRest<Conversation[]>("tender_conversations", {
        method: "POST",
        headers: { Prefer: "return=representation" },
        body: JSON.stringify({ tender_id: bid.tender_id, supplier_bid_id: bid.id, buyer_organization_id: tender.organization_id, supplier_organization_id: bid.supplier_organization_id, created_by: user.id }),
        serviceRole: true,
      });
      await audit({ organizationId: tender.organization_id, tenderId: tender.id, actorUserId: user.id, action: "tender_conversation_opened", entityType: "tender_conversation", entityId: data[0].id, metadata: { supplierBidId: bid.id } });
      return Response.json({ data: data[0] }, { status: 201, headers: noStore });
    }
    const access = await authorizeConversation(user, body.conversationId);
    if (body.action === "mark_read") {
      await supabaseRest(`tender_conversations?id=eq.${body.conversationId}`, {
        method: "PATCH",
        body: JSON.stringify({ [access.side === "buyer" ? "buyer_last_read_at" : "supplier_last_read_at"]: new Date().toISOString() }),
        serviceRole: true,
      });
      return Response.json({ data: { updated: true } }, { headers: noStore });
    }
    if (body.action === "close") {
      if (access.side !== "buyer") throw new ApiError(403, "Only the buyer can close this conversation.", "buyer_action_required");
      await supabaseRest(`tender_conversations?id=eq.${body.conversationId}`, { method: "PATCH", body: JSON.stringify({ status: "closed" }), serviceRole: true });
      return Response.json({ data: { closed: true } }, { headers: noStore });
    }
    if (access.conversation.status !== "open") throw new ApiError(409, "This conversation is closed.", "conversation_closed");
    const { data: latest } = await supabaseRest<Array<{ created_at: string }>>(
      `tender_messages?select=created_at&conversation_id=eq.${body.conversationId}&sender_user_id=eq.${user.id}&order=created_at.desc&limit=1`,
      { serviceRole: true },
    );
    if (latest[0] && Date.now() - Date.parse(latest[0].created_at) < 750)
      throw new ApiError(429, "Please wait a moment before sending another message.", "message_rate_limited");
    const { data } = await supabaseRest<Message[]>("tender_messages", {
      method: "POST",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify({ conversation_id: body.conversationId, sender_user_id: user.id, sender_organization_id: access.organizationId, body: body.message }),
      serviceRole: true,
    });
    const recipientOrganizationId = access.side === "buyer" ? access.conversation.supplier_organization_id : access.conversation.buyer_organization_id;
    const { data: recipients } = await supabaseRest<Array<Membership & { user_id: string }>>(
      `organization_members?select=organization_id,user_id,role,procurement_role&organization_id=eq.${recipientOrganizationId}`,
      { serviceRole: true },
    );
    const recipientSide = access.side === "buyer" ? "supplier" : "buyer";
    const eligibleRecipients = recipients.filter((recipient) => recipient.user_id !== user.id && (recipientSide === "supplier" || canManageBuyer(recipient)));
    await Promise.all(eligibleRecipients.map((recipient) => createNotification({
      userId: recipient.user_id,
      organizationId: recipientOrganizationId,
      type: "system",
      title: "New managed tender message",
      message: "A participant sent a message in a BidScope-managed tender conversation.",
      relatedEntityType: "tender_conversation",
      relatedEntityId: access.conversation.id,
      relatedUrl: `${recipientSide === "buyer" ? "/procurement/messages" : "/customer/messages"}/${access.conversation.id}`,
      priority: "normal",
      frequencyOverride: "instant",
      dedupeKey: `tender-message-${data[0].id}-${recipient.user_id}`,
    })));
    await audit({ organizationId: access.conversation.buyer_organization_id, tenderId: access.conversation.tender_id, actorUserId: user.id, action: "tender_message_sent", entityType: "tender_message", entityId: data[0].id, metadata: { conversationId: access.conversation.id, senderSide: access.side } });
    return Response.json({ data: data[0] }, { status: 201, headers: noStore });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
