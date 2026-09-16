export type AIProviderId = "groq" | "gemini" | "openrouter" | "openai" | (string & {});
export type AIComplexity = "LOW" | "MEDIUM" | "HIGH" | "PREMIUM_REASONING";
export type AIPlan = "FREE" | "STANDARD" | "PREMIUM" | "PLATINUM";
export type AIHealth = "active" | "degraded" | "rate_limited" | "offline" | "not_configured" | "invalid_key";

export type AIMessage = { role: "system" | "user" | "assistant"; content: string };
export type AICitation = { label: string; url?: string | null };
export type AIUsage = { inputTokens: number; outputTokens: number; estimatedCostUsd: number };
export type AIProviderResult = { text: string; structured?: unknown; citations: AICitation[]; usage: AIUsage; provider: AIProviderId; model: string };

export type AICapabilities = {
  reasoning: boolean;
  structuredOutput: boolean;
  longContext: boolean;
  tools: boolean;
  images: boolean;
  sensitiveData: boolean;
  customerDocuments: boolean;
};

export type AIProviderRequest = {
  model: string;
  messages: AIMessage[];
  maxOutputTokens: number;
  temperature?: number;
  jsonSchema?: Record<string, unknown>;
  enableWebResearch?: boolean;
};

export interface AIProvider {
  readonly id: AIProviderId;
  readonly configured: boolean;
  readonly defaultModel: string;
  readonly premiumModel?: string;
  readonly capabilities: AICapabilities;
  generateText(request: AIProviderRequest): Promise<AIProviderResult>;
  generateStructuredOutput(request: AIProviderRequest): Promise<AIProviderResult>;
  reason(request: AIProviderRequest): Promise<AIProviderResult>;
  classify(request: AIProviderRequest): Promise<AIProviderResult>;
  summarize(request: AIProviderRequest): Promise<AIProviderResult>;
  healthCheck(): Promise<{ status: AIHealth; latencyMs: number; detail?: string }>;
  estimateCost(model: string, inputTokens: number, outputTokens: number): number;
}

export type AITaskInput = {
  taskType: string;
  messages: AIMessage[];
  userId?: string;
  organizationId?: string;
  plan: AIPlan;
  complexity?: AIComplexity;
  documentCount?: number;
  estimatedInputTokens?: number;
  requestedMode?: "standard" | "deep";
  requiresStructuredOutput?: boolean;
  requiresLongContext?: boolean;
  containsSensitiveData?: boolean;
  containsCustomerDocuments?: boolean;
  cacheTtlSeconds?: number;
  classificationVersion?: string;
  deterministicResult?: AIProviderResult | null;
  metadata?: Record<string, unknown>;
};

export type AIOrchestrationResult = AIProviderResult & {
  source: "rule" | "cache" | "provider";
  complexity: AIComplexity;
  premiumReasoning: boolean;
  fallbackCount: number;
  cacheKey: string;
};
