import { z } from "zod";
import { apiErrorResponse } from "@/lib/server/api-error";
import { requireUser } from "@/lib/server/auth";
import { getEntitlement, primaryOrganization } from "@/lib/server/entitlements";
import {
  fallbackHelpReply,
  findHelpAnswer,
  HELP_ASSISTANT_SYSTEM_PROMPT,
  tenderEvaluationRedirect,
  type HelpAssistantReply,
} from "@/lib/server/help-assistant";
import { ai, planFromBillingCode } from "@/lib/server/ai/orchestrator";

export const dynamic = "force-dynamic";

const inputSchema = z.object({
  question: z.string().trim().min(2).max(1000),
  currentPath: z.string().trim().max(500).optional(),
});

function safeLinks(reply: HelpAssistantReply) {
  return reply.links.filter((link) => link.href.startsWith("/") && !link.href.startsWith("//"));
}

export async function POST(request: Request) {
  try {
    const { user } = await requireUser(request);
    const input = inputSchema.parse(await request.json());

    const redirect = tenderEvaluationRedirect(input.question, input.currentPath);
    if (redirect) {
      return Response.json({ data: redirect }, { headers: { "Cache-Control": "private, no-store" } });
    }

    const known = findHelpAnswer(input.question);
    if (known) {
      return Response.json({ data: known }, { headers: { "Cache-Control": "private, no-store" } });
    }

    let reply = fallbackHelpReply();
    try {
      const membership = await primaryOrganization(user.id);
      const entitlement = membership ? await getEntitlement(membership.organization_id, user) : null;
      const result = await ai.execute({
        taskType: "help_assistant",
        userId: user.id,
        organizationId: membership?.organization_id,
        plan: planFromBillingCode(entitlement?.plan.code, entitlement?.adminOverride),
        complexity: "LOW",
        messages: [
          { role: "system", content: HELP_ASSISTANT_SYSTEM_PROMPT },
          {
            role: "user",
            content: `Current page: ${input.currentPath || "/customer/help"}\nQuestion: ${input.question}`,
          },
        ],
        cacheTtlSeconds: 3600,
        metadata: { feature: "product_help" },
      });
      const modelDetectedTenderRequest = /(?:\/customer\/ai|tender evaluation tool)/i.test(result.text);
      reply = modelDetectedTenderRequest
        ? tenderEvaluationRedirect("explain this tender", input.currentPath) || fallbackHelpReply()
        : {
            category: "general",
            routedToTenderEvaluation: false,
            answer: result.text.slice(0, 1600),
            links: fallbackHelpReply().links,
          };
    } catch {
      // Product help must remain available when an external model is unavailable.
    }

    return Response.json(
      { data: { ...reply, links: safeLinks(reply) } },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    return apiErrorResponse(error);
  }
}
