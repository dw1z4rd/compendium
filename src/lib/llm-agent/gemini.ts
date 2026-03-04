import type { GeminiResponse, GeminiProviderConfig, LLMProvider, LLMOptions } from './types';
import { redactKey } from './utils';

const DEFAULT_MODEL = 'gemini-2.0-flash';

const buildGeminiUrl = (model: string) =>
	`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

export async function callGemini<T = GeminiResponse>(
	apiKey: string,
	body: unknown,
	model: string = DEFAULT_MODEL
): Promise<T | null> {
	const url = `${buildGeminiUrl(model)}?key=${apiKey}`;
	try {
		const response = await fetch(url, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(body)
		});
		if (!response.ok) {
			const text = await response.text();
			console.error(`[Gemini] API Error ${response.status}:`, redactKey(text, apiKey).slice(0, 500));
			return null;
		}
		return (await response.json()) as T;
	} catch (e: unknown) {
		const msg = e instanceof Error ? e.message : String(e);
		console.error('[Gemini] Network Error:', redactKey(msg, apiKey));
		return null;
	}
}

export const extractGeminiText = (data: GeminiResponse | null | undefined): string | null =>
	data?.candidates?.[0]?.content?.parts?.[0]?.text ?? null;

export const extractCleanGeminiText = (data: GeminiResponse | null | undefined): string | null => {
	const text = extractGeminiText(data);
	return text ? text.trim().replace(/^["']|["']$/g, '') : null;
};

export const createGeminiProvider = (config: GeminiProviderConfig): LLMProvider => ({
	generateText: async (prompt: string, options?: LLMOptions): Promise<string | null> => {
		const data = await callGemini<GeminiResponse>(
			config.apiKey,
			{
				...(options?.systemPrompt != null
					? { systemInstruction: { parts: [{ text: options.systemPrompt }] } }
					: {}),
				contents: [{ role: 'user', parts: [{ text: prompt }] }],
				generationConfig: {
					...(options?.maxTokens != null ? { maxOutputTokens: options.maxTokens } : {}),
					...(options?.temperature != null ? { temperature: options.temperature } : {})
				}
			},
			config.model
		);
		return extractCleanGeminiText(data);
	}
});
