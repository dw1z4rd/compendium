// ─── Generic LLM Provider Interface ──────────────────────────────────────────

export interface LLMOptions {
	readonly maxTokens?: number;
	readonly temperature?: number;
	readonly systemPrompt?: string;
}

export interface LLMProvider {
	generateText(prompt: string, options?: LLMOptions): Promise<string | null>;
}

// ─── Retry Configuration ─────────────────────────────────────────────────────

export interface RetryConfig {
	readonly maxRetries: number;
	readonly initialDelayMs?: number;
	readonly backoffFactor?: number;
	readonly onRetryableFailure?: (attempt: number, error?: unknown) => void;
}

// ─── OpenAI-Specific Types ────────────────────────────────────────────────────

export interface OpenAIProviderConfig {
	readonly apiKey: string;
	readonly model?: string;
}

export interface OpenAIMessage {
	readonly role: 'system' | 'user' | 'assistant';
	readonly content: string;
}

export interface OpenAIChoice {
	readonly message: { readonly content: string | null };
}

export interface OpenAIResponse {
	readonly choices?: readonly OpenAIChoice[];
}

// ─── Anthropic-Specific Types ─────────────────────────────────────────────────

export interface AnthropicProviderConfig {
	readonly apiKey: string;
	readonly model?: string;
}

export interface AnthropicContentBlock {
	readonly type: string;
	readonly text?: string;
}

export interface AnthropicResponse {
	readonly content?: readonly AnthropicContentBlock[];
}

// ─── Gemini-Specific Types ────────────────────────────────────────────────────

export interface GeminiContentPart {
	readonly text?: string;
}

export interface GeminiContent {
	readonly role?: string;
	readonly parts: readonly GeminiContentPart[];
}

export interface GeminiCandidate {
	readonly content: {
		readonly parts: readonly GeminiContentPart[];
	};
}

export interface GeminiResponse {
	readonly candidates?: readonly GeminiCandidate[];
}

export interface GeminiProviderConfig {
	readonly apiKey: string;
	readonly model?: string;
}
