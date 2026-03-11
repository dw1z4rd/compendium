import type { Surreal } from 'surrealdb';
import type { LLMProvider } from '$lib/llm-agent';
import { createGeminiProvider } from '$lib/llm-agent';
import { createOllamaProvider } from '$lib/ollama';
import { buildCatalog, type CatalogEnv } from '$lib/model-catalog';
import type { ModelSettings } from '$lib/types';

export type { ModelSettings, CatalogEnv };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const q = <T>(v: unknown): T => v as unknown as T;

const DEFAULT_TEXT_MODEL = 'llama3.2';
const DEFAULT_VISION_MODEL = 'llava';
const DEFAULT_EMBED_MODEL = 'nomic-embed-text';

// ─── DB helper ────────────────────────────────────────────────────────────────

/**
 * Read settings:main from SurrealDB, with env var / hardcoded fallback.
 * The env parameter accepts the $env/dynamic/private object from the caller.
 * Never throws — returns defaults on any DB failure.
 */
export async function getActiveSettings(
	db: Surreal,
	env: { OLLAMA_TEXT_MODEL?: string; OLLAMA_VISION_MODEL?: string; OLLAMA_EMBED_MODEL?: string }
): Promise<ModelSettings> {
	const defaults: ModelSettings = {
		text_model: env.OLLAMA_TEXT_MODEL ?? DEFAULT_TEXT_MODEL,
		vision_model: env.OLLAMA_VISION_MODEL ?? DEFAULT_VISION_MODEL,
		embed_model: env.OLLAMA_EMBED_MODEL ?? DEFAULT_EMBED_MODEL
	};

	try {
		const [rows] = q<[ModelSettings[]]>(
			await db.query('SELECT * FROM settings:main')
		);
		const record = rows?.[0];
		if (!record) return defaults;
		return {
			text_model: record.text_model || defaults.text_model,
			vision_model: record.vision_model || defaults.vision_model,
			embed_model: record.embed_model || defaults.embed_model
		};
	} catch {
		return defaults;
	}
}

// ─── Provider resolution ──────────────────────────────────────────────────────

/**
 * Resolve a text model key to an LLMProvider.
 * - Catalog key with group 'ollama-cloud' → Ollama cloud provider
 * - Catalog key with group 'gemini'       → Gemini provider
 * - Anything else                         → local Ollama provider
 */
export function resolveTextProvider(modelKey: string, env: CatalogEnv): LLMProvider {
	const catalog = buildCatalog();
	const def = catalog[modelKey];

	if (def?.group === 'ollama-cloud') {
		return createOllamaProvider({
			baseUrl: env.OLLAMA_CLOUD_URL,
			model: modelKey,
			apiKey: env.OLLAMA_CLOUD_API_KEY || undefined
		});
	}

	if (def?.group === 'gemini') {
		return createGeminiProvider({
			apiKey: env.GEMINI_API_KEY,
			model: modelKey
		});
	}

	return createOllamaProvider({ baseUrl: env.OLLAMA_URL, model: modelKey });
}

/**
 * Resolve an embed model key to a local Ollama config.
 * Embed always uses local Ollama — cloud models are not supported for embedding.
 * Defensively falls back to nomic-embed-text if a catalog key is passed.
 */
export function resolveEmbedConfig(
	embedKey: string,
	ollamaUrl: string
): { baseUrl: string; embedModel: string } {
	const catalog = buildCatalog();
	if (catalog[embedKey]) {
		return { baseUrl: ollamaUrl, embedModel: DEFAULT_EMBED_MODEL };
	}
	return { baseUrl: ollamaUrl, embedModel: embedKey };
}
