import type { LLMProvider, LLMOptions, AnthropicProviderConfig, AnthropicResponse } from './types';
import { redactKey } from './utils';

const DEFAULT_MODEL = 'claude-sonnet-4-6';
const DEFAULT_MAX_TOKENS = 1024;
const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_VERSION = '2023-06-01';

export const createAnthropicProvider = (config: AnthropicProviderConfig): LLMProvider => ({
	generateText: async (prompt: string, options?: LLMOptions): Promise<string | null> => {
		try {
			const response = await fetch(ANTHROPIC_URL, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'x-api-key': config.apiKey,
					'anthropic-version': ANTHROPIC_VERSION
				},
				body: JSON.stringify({
					model: config.model ?? DEFAULT_MODEL,
					messages: [{ role: 'user', content: prompt }],
					max_tokens: options?.maxTokens ?? DEFAULT_MAX_TOKENS,
					...(options?.systemPrompt != null ? { system: options.systemPrompt } : {}),
					...(options?.temperature != null ? { temperature: options.temperature } : {})
				})
			});
			if (!response.ok) {
				const text = await response.text();
				console.error(
					`[Anthropic] API Error ${response.status}:`,
					redactKey(text, config.apiKey).slice(0, 500)
				);
				return null;
			}
			const data = (await response.json()) as AnthropicResponse;
			return data.content?.[0]?.text ?? null;
		} catch (e: unknown) {
			const msg = e instanceof Error ? e.message : String(e);
			console.error('[Anthropic] Network Error:', redactKey(msg, config.apiKey));
			return null;
		}
	}
});
