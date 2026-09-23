import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { AIOrchestrator, inferComplexity, isPremiumEligible, planFromBillingCode } from "../../lib/server/ai/orchestrator.ts";
import type { AIProvider, AIProviderRequest, AIProviderResult } from "../../lib/server/ai/types.ts";

const result=(provider:string,model:string):AIProviderResult=>({text:`${provider} result`,citations:[],usage:{inputTokens:10,outputTokens:5,estimatedCostUsd:0},provider,model});
class FakeProvider implements AIProvider{
  configured=true;defaultModel="standard";premiumModel="premium";capabilities={reasoning:true,structuredOutput:true,longContext:true,tools:false,images:false,sensitiveData:true,customerDocuments:true};
  readonly id:string;private fail:boolean;
  constructor(id:string,fail=false){this.id=id;this.fail=fail;}
  async generateText(request:AIProviderRequest){if(this.fail)throw new Error("rate limited 429");return result(this.id,request.model);}
  generateStructuredOutput(request:AIProviderRequest){return this.generateText(request);} reason(request:AIProviderRequest){return this.generateText(request);} classify(request:AIProviderRequest){return this.generateText(request);} summarize(request:AIProviderRequest){return this.generateText(request);}
  async healthCheck(){return{status:"active" as const,latencyMs:1};} estimateCost(){return 0;}
}

test("task complexity and plan mapping preserve premium boundaries",()=>{assert.equal(inferComplexity({taskType:"company_classification",messages:[],plan:"FREE"}),"LOW");assert.equal(inferComplexity({taskType:"deep_tender_analysis",messages:[],plan:"PREMIUM",requestedMode:"standard"}),"HIGH");assert.equal(planFromBillingCode("pro_monthly"),"STANDARD");assert.equal(planFromBillingCode("premium_monthly"),"PREMIUM");assert.equal(planFromBillingCode("platinum_monthly"),"PLATINUM");assert.equal(isPremiumEligible("STANDARD"),false);assert.equal(isPremiumEligible("PREMIUM"),true);});

test("deterministic results bypass every provider",async()=>{const providers=[new FakeProvider("groq",true)];const orchestrator=new AIOrchestrator(providers);const deterministic=result("rules","deterministic-v1");const output=await orchestrator.execute({taskType:"company_classification",messages:[],plan:"FREE",deterministicResult:deterministic});assert.equal(output.source,"rule");assert.equal(output.provider,"rules");});

test("Groq failure falls back to Gemini without exposing the failure",async()=>{const orchestrator=new AIOrchestrator([new FakeProvider("groq",true),new FakeProvider("gemini")]);const output=await orchestrator.execute({taskType:"tender_summary",messages:[{role:"user",content:"Summarise"}],plan:"STANDARD"});assert.equal(output.provider,"gemini");assert.equal(output.fallbackCount,1);});

test("free users cannot force deep premium reasoning",async()=>{const orchestrator=new AIOrchestrator([new FakeProvider("openai")]);await assert.rejects(()=>orchestrator.execute({taskType:"deep_tender_analysis",messages:[],plan:"FREE",requestedMode:"deep"}),/Premium and Platinum/);});

test("premium routing selects a reasoning-capable premium provider",async()=>{const orchestrator=new AIOrchestrator([new FakeProvider("openai")]);const output=await orchestrator.execute({taskType:"deep_tender_analysis",messages:[{role:"user",content:"Compare documents"}],plan:"PREMIUM",requestedMode:"deep"});assert.equal(output.provider,"openai");assert.equal(output.premiumReasoning,true);assert.equal(output.model,"premium");});

test("identified customer analysis never reads or writes the shared AI cache",async()=>{
  const orchestrator=new AIOrchestrator([new FakeProvider("gemini")]);
  let cacheCalls=0;
  Object.assign(orchestrator,{
    cacheGet:async()=>{cacheCalls++;return result("cache","old");},
    cacheSet:async()=>{cacheCalls++;},
    enforceLimits:async()=>{},route:async()=>null,models:async()=>[],providerStates:async()=>new Map(),maxTokens:async()=>1000,log:async()=>{},
  });
  const output=await orchestrator.execute({taskType:"tender_summary",messages:[{role:"user",content:"private assessment"}],plan:"STANDARD",userId:"member-1"});
  assert.equal(output.source,"provider");
  assert.equal(cacheCalls,0);
});

test("orchestration schema protects secrets and supplies registries, cache, jobs and RLS",()=>{const migration=readFileSync("supabase/migrations/20260916210000_multi_provider_ai_orchestration.sql","utf8");for(const table of ["ai_providers","ai_models","ai_feature_routes","ai_usage_logs","ai_cache","ai_jobs","company_ai_classifications","ai_budget_settings","ai_user_usage","ai_provider_health"])assert.match(migration,new RegExp(`create table if not exists public\\.${table}`));assert.match(migration,/enable row level security/g);assert.doesNotMatch(migration,/(sk-|gsk_|AIza)[A-Za-z0-9_-]{12,}/);});

test("Groq uses a current production model with explicit pricing",()=>{const providers=readFileSync("lib/server/ai/providers.ts","utf8");const migration=readFileSync("supabase/migrations/20260916220000_update_groq_production_model.sql","utf8");assert.match(providers,/openai\/gpt-oss-20b/);assert.match(providers,/max_completion_tokens/);assert.match(providers,/maxOutputTokens:128/);assert.match(migration,/0\.075/);assert.match(migration,/0\.30/);assert.doesNotMatch(providers,/defaultModel:process\.env\.BIDSCOPE_GROQ_MODEL\|\|"llama-3\.3-70b-versatile"/);});

test("administrator AI routing uses hard-wired dropdown presets",()=>{const ui=readFileSync("components/admin/ai-admin.tsx","utf8");const route=readFileSync("app/api/admin/ai/routes/route.ts","utf8");assert.match(ui,/<select/);assert.match(ui,/routePresets/);assert.doesNotMatch(ui,/standard\.split\(","\)/);assert.match(route,/approvedOrders/);assert.match(route,/Choose one of the approved provider routes/);});
