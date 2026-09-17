import type { AIProvider, AIProviderId, AIProviderRequest, AIProviderResult, AICapabilities, AIHealth } from "./types.ts";

type ProviderConfig = { id: AIProviderId; key?: string; baseUrl: string; defaultModel: string; premiumModel?: string; maxTokenField?: "max_tokens"|"max_completion_tokens"; capabilities: AICapabilities };
const zeroUsage = { inputTokens: 0, outputTokens: 0, estimatedCostUsd: 0 };
const textFromMessages = (request: AIProviderRequest) => request.messages.map(message => `${message.role.toUpperCase()}: ${message.content}`).join("\n\n");

abstract class BaseProvider implements AIProvider {
  readonly id: AIProviderId;
  readonly configured: boolean;
  readonly capabilities: AICapabilities;
  protected readonly key?: string;
  protected readonly baseUrl: string;
  protected readonly maxTokenField: "max_tokens"|"max_completion_tokens";
  readonly defaultModel: string;
  readonly premiumModel?: string;
  constructor(config: ProviderConfig) { this.id=config.id; this.key=config.key; this.configured=Boolean(config.key); this.baseUrl=config.baseUrl; this.defaultModel=config.defaultModel; this.premiumModel=config.premiumModel; this.maxTokenField=config.maxTokenField||"max_tokens"; this.capabilities=config.capabilities; }
  abstract generateText(request: AIProviderRequest): Promise<AIProviderResult>;
  generateStructuredOutput(request: AIProviderRequest) { return this.generateText(request); }
  reason(request: AIProviderRequest) { return this.generateText(request); }
  classify(request: AIProviderRequest) { return this.generateText(request); }
  summarize(request: AIProviderRequest) { return this.generateText(request); }
  estimateCost(...args: [model: string, inputTokens: number, outputTokens: number]) { void args; return 0; }
  async healthCheck(): Promise<{ status: AIHealth; latencyMs: number; detail?: string }> {
    if (!this.configured) return { status: "not_configured", latencyMs: 0 };
    const started=Date.now();
    try { await this.generateText({ model:this.defaultModel, messages:[{role:"user",content:"Reply with only the word OK."}], maxOutputTokens:128, temperature:0 }); return {status:"active",latencyMs:Date.now()-started}; }
    catch(error){const detail=error instanceof Error?error.message:"Provider check failed";return{status:/401|403|key/i.test(detail)?"invalid_key":/429|rate/i.test(detail)?"rate_limited":"offline",latencyMs:Date.now()-started,detail:detail.slice(0,180)};}
  }
  protected ensureConfigured(){if(!this.key)throw new Error(`${this.id} is not configured`);return this.key;}
}

class OpenAICompatibleProvider extends BaseProvider {
  private readonly headers:(key:string)=>Record<string,string>;
  constructor(config:ProviderConfig, headers:(key:string)=>Record<string,string>){super(config);this.headers=headers;}
  async generateText(request: AIProviderRequest): Promise<AIProviderResult> {
    const key=this.ensureConfigured();
    const response=await fetch(`${this.baseUrl}/chat/completions`,{method:"POST",headers:{"Content-Type":"application/json",...this.headers(key)},body:JSON.stringify({model:request.model,messages:request.messages,temperature:request.temperature??0.2,[this.maxTokenField]:request.maxOutputTokens,...(request.jsonSchema?{response_format:{type:"json_object"}}:{})}),signal:AbortSignal.timeout(45000)});
    if(!response.ok){const body=await response.text();throw new Error(`${this.id} returned ${response.status}: ${safeProviderError(body)}`);}
    const body=await response.json() as {choices?:Array<{message?:{content?:string}}> ;usage?:{prompt_tokens?:number;completion_tokens?:number}};
    const text=body.choices?.[0]?.message?.content?.trim();if(!text)throw new Error(`${this.id} returned an empty response`);
    const inputTokens=body.usage?.prompt_tokens||0,outputTokens=body.usage?.completion_tokens||0;
    return{text,structured:request.jsonSchema?safeJson(text):undefined,citations:[],usage:{inputTokens,outputTokens,estimatedCostUsd:this.estimateCost(request.model,inputTokens,outputTokens)},provider:this.id,model:request.model};
  }
}

export class GeminiProvider extends BaseProvider {
  async generateText(request:AIProviderRequest):Promise<AIProviderResult>{
    const key=this.ensureConfigured();const system=request.messages.filter(x=>x.role==="system").map(x=>x.content).join("\n");const user=request.messages.filter(x=>x.role!=="system").map(x=>x.content).join("\n\n");
    const response=await fetch(`${this.baseUrl}/models/${encodeURIComponent(request.model)}:generateContent`,{method:"POST",headers:{"x-goog-api-key":key,"Content-Type":"application/json"},body:JSON.stringify({system_instruction:system?{parts:[{text:system}]}:undefined,contents:[{role:"user",parts:[{text:user}]}],...(request.enableWebResearch?{tools:[{url_context:{}},{google_search:{}}]}:{}),generationConfig:{temperature:request.temperature??0.2,maxOutputTokens:request.maxOutputTokens,...(request.jsonSchema?{responseMimeType:"application/json"}:{})}}),signal:AbortSignal.timeout(45000)});
    if(!response.ok){const body=await response.text();throw new Error(`gemini returned ${response.status}: ${safeProviderError(body)}`);}const body=await response.json() as {candidates?:Array<{content?:{parts?:Array<{text?:string}>};groundingMetadata?:{groundingChunks?:Array<{web?:{uri?:string;title?:string}}>}}> ;usageMetadata?:{promptTokenCount?:number;candidatesTokenCount?:number}};
    const text=(body.candidates||[]).flatMap(x=>x.content?.parts||[]).map(x=>x.text||"").join("\n").trim();if(!text)throw new Error("gemini returned an empty response");const inputTokens=body.usageMetadata?.promptTokenCount||0,outputTokens=body.usageMetadata?.candidatesTokenCount||0;
    const citations=(body.candidates||[]).flatMap(x=>x.groundingMetadata?.groundingChunks||[]).flatMap(x=>x.web?.uri?[{label:x.web.title||"Web research source",url:x.web.uri}]:[]);
    return{text,structured:request.jsonSchema?safeJson(text):undefined,citations,usage:{inputTokens,outputTokens,estimatedCostUsd:this.estimateCost(request.model,inputTokens,outputTokens)},provider:this.id,model:request.model};
  }
}

export class OpenAIProvider extends BaseProvider {
  async generateText(request:AIProviderRequest):Promise<AIProviderResult>{
    const key=this.ensureConfigured();const response=await fetch(`${this.baseUrl}/responses`,{method:"POST",headers:{Authorization:`Bearer ${key}`,"Content-Type":"application/json"},body:JSON.stringify({model:request.model,input:request.messages.map(message=>({role:message.role==="system"?"developer":message.role,content:message.content})),max_output_tokens:request.maxOutputTokens}),signal:AbortSignal.timeout(60000)});if(!response.ok)throw new Error(`openai returned ${response.status}`);const body=await response.json() as {output_text?:string;usage?:{input_tokens?:number;output_tokens?:number}};if(!body.output_text)throw new Error("openai returned an empty response");const inputTokens=body.usage?.input_tokens||0,outputTokens=body.usage?.output_tokens||0;return{text:body.output_text,structured:request.jsonSchema?safeJson(body.output_text):undefined,citations:[],usage:{inputTokens,outputTokens,estimatedCostUsd:this.estimateCost(request.model,inputTokens,outputTokens)},provider:this.id,model:request.model};
  }
}

const standardCapabilities:AICapabilities={reasoning:false,structuredOutput:true,longContext:true,tools:false,images:false,sensitiveData:false,customerDocuments:false};
export function configuredProviders():AIProvider[]{
  return[
    new OpenAICompatibleProvider({id:"groq",key:process.env.GROQ_API_KEY,baseUrl:"https://api.groq.com/openai/v1",defaultModel:process.env.BIDSCOPE_GROQ_MODEL||"openai/gpt-oss-20b",maxTokenField:"max_completion_tokens",capabilities:{...standardCapabilities,longContext:true}},key=>({Authorization:`Bearer ${key}`})),
    new GeminiProvider({id:"gemini",key:process.env.GOOGLE_GEMINI_API_KEY||process.env.GEMINI_API_KEY,baseUrl:"https://generativelanguage.googleapis.com/v1beta",defaultModel:process.env.BIDSCOPE_GEMINI_MODEL||"gemini-2.5-flash",premiumModel:process.env.BIDSCOPE_GEMINI_REASONING_MODEL||"gemini-2.5-pro",capabilities:{...standardCapabilities,reasoning:true,tools:true,customerDocuments:true}}),
    new OpenAICompatibleProvider({id:"openrouter",key:process.env.OPENROUTER_API_KEY,baseUrl:"https://openrouter.ai/api/v1",defaultModel:process.env.BIDSCOPE_OPENROUTER_MODEL||"google/gemini-2.5-flash",premiumModel:process.env.BIDSCOPE_OPENROUTER_REASONING_MODEL,capabilities:{...standardCapabilities,reasoning:true}},key=>({Authorization:`Bearer ${key}`,"HTTP-Referer":"https://www.bidscopeghana.com","X-Title":"BidScope"})),
    new OpenAIProvider({id:"openai",key:process.env.OPENAI_API_KEY,baseUrl:"https://api.openai.com/v1",defaultModel:process.env.BIDSCOPE_OPENAI_MODEL||"gpt-4.1-mini",premiumModel:process.env.BIDSCOPE_OPENAI_REASONING_MODEL||"o3",capabilities:{...standardCapabilities,reasoning:true,structuredOutput:true,customerDocuments:true,sensitiveData:true}}),
  ];
}

function safeJson(text:string){try{return JSON.parse(text);}catch{return undefined;}}
function safeProviderError(text:string){return text.replace(/(?:sk-|gsk_|AIza|Bearer\s+)[A-Za-z0-9._-]+/gi,"[redacted]").replace(/\s+/g," ").slice(0,160);}
export { zeroUsage, textFromMessages };
