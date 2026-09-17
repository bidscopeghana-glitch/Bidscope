import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  findHelpAnswer,
  isTenderEvaluationRequest,
  tenderEvaluationHref,
  tenderEvaluationRedirect,
} from "../../lib/server/help-assistant.ts";

test("tender-specific research is routed to paid AI Tender Evaluation", () => {
  const questions = [
    "Explain this tender and all its key requirements",
    "Can my company qualify for this opportunity?",
    "What documents and bid security does the tender require?",
    "Research the eligibility details for reference number GH-2026-14",
    "What are the eligibility requirements for bidders?",
    "Tell me which mandatory documents I need",
    "Should we bid for this contract?",
  ];
  for (const question of questions) {
    assert.equal(isTenderEvaluationRequest(question), true, question);
    const reply = tenderEvaluationRedirect(question);
    assert.equal(reply?.routedToTenderEvaluation, true);
    assert.equal(reply?.links[0].href, "/customer/ai");
  }
});

test("product navigation questions remain in the Help Assistant", () => {
  const questions = [
    "How do I search tenders?",
    "How do I create a tender alert?",
    "How do I use AI Tender Evaluation?",
    "Where can I compare subscription plans?",
    "How do I upload a certificate to my profile?",
    "What does eligibility mean?",
  ];
  for (const question of questions) {
    assert.equal(isTenderEvaluationRequest(question), false, question);
  }
  assert.equal(findHelpAnswer("How do I create a tender alert?")?.links[0].href, "/customer/alerts");
  assert.equal(findHelpAnswer("How do I use AI Tender Evaluation?")?.links[0].href, "/customer/ai");
});

test("an opportunity page generates a direct evaluator link", () => {
  assert.equal(
    tenderEvaluationHref("/customer/opportunity/road-works-123?returnTo=%2Fcustomer"),
    "/customer/ai?opportunity=road-works-123",
  );
  assert.equal(tenderEvaluationHref("/customer/help"), "/customer/ai");
});

test("help API enforces authentication and checks tender intent before orchestration", () => {
  const source = readFileSync("app/api/ai/help/route.ts", "utf8");
  assert.match(source, /await requireUser\(request\)/);
  assert.ok(source.indexOf("tenderEvaluationRedirect") < source.indexOf("ai.execute"));
  assert.match(source, /taskType: "help_assistant"/);
  assert.match(source, /Cache-Control.*private, no-store/);
});

test("help route migration activates provider routing without changing tender routes", () => {
  const sql = readFileSync("supabase/migrations/20260917203000_help_assistant_route.sql", "utf8");
  assert.match(sql, /'help_assistant'/);
  assert.match(sql, /array_append\(task_types, 'help_assistant'\)/);
  assert.doesNotMatch(sql, /delete from public\.ai_feature_routes/i);
});
