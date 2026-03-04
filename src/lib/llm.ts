/**
 * Cloud LLM providers — opt-in per node, never automatic.
 * Uses the vendored @llm/agent library.
 */

import {
	createGeminiProvider,
	createAnthropicProvider,
	callGemini,
	withRetry,
	withSystemPrompt
} from '$lib/llm-agent';
import type { LLMProvider, GeminiResponse } from '$lib/llm-agent';

const COMPENDIUM_SYSTEM = `You are an intelligent knowledge graph assistant.
You help organise and connect ideas, memories, beliefs, and observations.
Be analytical, precise, and insightful in your analysis.`;

// ─── Generic cloud provider factory ──────────────────────────────────────────

export function createCloudProvider(config: {
	provider: 'gemini' | 'anthropic';
	apiKey: string;
	model?: string;
}): LLMProvider {
	const base =
		config.provider === 'gemini'
			? createGeminiProvider({ apiKey: config.apiKey, model: config.model })
			: createAnthropicProvider({ apiKey: config.apiKey, model: config.model });

	return withRetry(withSystemPrompt(base, COMPENDIUM_SYSTEM), {
		maxRetries: 3,
		initialDelayMs: 500,
		backoffFactor: 2
	});
}

// ─── Gemini vision (cloud image description fallback) ────────────────────────
// callGemini() gives raw API access, which supports multimodal content
// unlike createGeminiProvider() which is text-only.

export async function describeImageCloud(
	base64Image: string,
	mimeType: string,
	apiKey: string,
	model = 'gemini-2.0-flash'
): Promise<{ description: string; components: string[] } | null> {
	const response = await callGemini<GeminiResponse>(
		apiKey,
		{
			systemInstruction: {
				parts: [
					{
						text:
							'Describe this image in detail. Then on a new line starting with "Components:", ' +
							'list 3–8 key conceptual primitives as a comma-separated list.'
					}
				]
			},
			contents: [
				{
					role: 'user',
					parts: [
						{ inlineData: { mimeType, data: base64Image } },
						{ text: 'Describe this image and list its key conceptual components.' }
					]
				}
			],
			generationConfig: { maxOutputTokens: 600 }
		},
		model
	);

	const text = response?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
	if (!text) return null;

	const componentMatch = text.match(/components?:\s*(.+)/i);
	const components = componentMatch
		? componentMatch[1]
				.split(',')
				.map((s) => s.trim())
				.filter(Boolean)
		: [];

	return { description: text, components };
}
