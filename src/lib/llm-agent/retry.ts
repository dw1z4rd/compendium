import type { LLMProvider, LLMOptions, RetryConfig } from './types';

const DEFAULT_MAX_RETRIES = 3;
const DEFAULT_INITIAL_DELAY_MS = 500;
const DEFAULT_BACKOFF_FACTOR = 2;

export const withRetry = (provider: LLMProvider, config?: RetryConfig): LLMProvider => ({
	generateText: async (prompt: string, options?: LLMOptions): Promise<string | null> => {
		const maxRetries = config?.maxRetries ?? DEFAULT_MAX_RETRIES;
		const initialDelayMs = config?.initialDelayMs ?? DEFAULT_INITIAL_DELAY_MS;
		const backoffFactor = config?.backoffFactor ?? DEFAULT_BACKOFF_FACTOR;

		for (let attempt = 1; attempt <= maxRetries; attempt++) {
			try {
				const text = await provider.generateText(prompt, options);
				if (text && text.length > 0) return text;
				config?.onRetryableFailure?.(attempt);
			} catch (e) {
				config?.onRetryableFailure?.(attempt, e);
			}
			if (attempt < maxRetries) {
				const delay = initialDelayMs * backoffFactor ** (attempt - 1);
				await new Promise((resolve) => setTimeout(resolve, delay));
			}
		}
		return null;
	}
});

export const withSystemPrompt = (provider: LLMProvider, systemPrompt: string): LLMProvider => ({
	generateText: (prompt: string, options?: LLMOptions) =>
		provider.generateText(prompt, {
			...options,
			systemPrompt: options?.systemPrompt ?? systemPrompt
		})
});
