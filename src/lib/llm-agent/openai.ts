import type { LLMProvider, LLMOptions, OpenAIProviderConfig, OpenAIResponse } from './types';
import { redactKey } from './utils';

const DEFAULT_MODEL = 'gpt-4o';
const OPENAI_URL = 'https://api.openai.com/v1/chat/completions';

export const createOpenAIProvider = (config: OpenAIProviderConfig): LLMProvider => ({
	generateText: async (prompt: string, options?: LLMOptions): Promise<string | null> => {
		try {
			const messages = [
				...(options?.systemPrompt
					? [{ role: 'system' as const, content: options.systemPrompt }]
					: []),
				{ role: 'user' as const, content: prompt }
			];
			const response = await fetch(OPENAI_URL, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					Authorization: `Bearer ${config.apiKey}`
				},
				body: JSON.stringify({
					model: config.model ?? DEFAULT_MODEL,
					messages,
					...(options?.maxTokens ? { max_tokens: options.maxTokens } : {}),
					...(options?.temperature !== undefined ? { temperature: options.temperature } : {})
				})
			});
			if (!response.ok) {
				const text = await response.text();
				console.error(
					`[OpenAI] API Error ${response.status}:`,
					redactKey(text, config.apiKey).slice(0, 500)
				);
				return null;
			}
			const data = (await response.json()) as OpenAIResponse;
			return data.choices?.[0]?.message?.content ?? null;
		} catch (e: unknown) {
			const msg = e instanceof Error ? e.message : String(e);
			console.error('[OpenAI] Network Error:', redactKey(msg, config.apiKey));
			return null;
		}
	}
});
