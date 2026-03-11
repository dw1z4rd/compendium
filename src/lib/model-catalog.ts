// ─── Model catalog ─────────────────────────────────────────────────────────────
// Pure data — no $env imports.
// Provider construction happens in settings.ts with injected env values.

export type ModelGroup = 'ollama-cloud' | 'gemini';

export interface ModelDef {
	name: string;
	color: string;
	group: ModelGroup;
}

/**
 * Env values needed to construct cloud providers.
 * Passed in from +server.ts files that have access to $env/dynamic/private.
 */
export interface CatalogEnv {
	OLLAMA_URL: string;
	OLLAMA_CLOUD_URL: string;
	OLLAMA_CLOUD_API_KEY?: string;
	GEMINI_API_KEY: string;
}

export function buildCatalog(): Record<string, ModelDef> {
	return {
		// ─── Ollama Cloud ───────────────────────────────────────────────────────────
		'deepseek-v3.1:671b-cloud': {
			name: 'DeepSeek V3.1',
			color: '#4B8BF5',
			group: 'ollama-cloud'
		},
		'deepseek-v3.2-cloud': {
			name: 'DeepSeek V3.2',
			color: '#3B7BFF',
			group: 'ollama-cloud'
		},
		'devstral-small-2:24b-cloud': {
			name: 'Devstral Small 2',
			color: '#FF7000',
			group: 'ollama-cloud'
		},
		'kimi-k2:1t-cloud': {
			name: 'Kimi K2 1T',
			color: '#A78BFA',
			group: 'ollama-cloud'
		},
		// ─── Gemini ────────────────────────────────────────────────────────────────
		'gemini-2.5-flash': {
			name: 'Gemini 2.5 Flash',
			color: '#1A73E8',
			group: 'gemini'
		},
		'gemini-2.0-flash': {
			name: 'Gemini 2.0 Flash',
			color: '#4285F4',
			group: 'gemini'
		}
	};
}
