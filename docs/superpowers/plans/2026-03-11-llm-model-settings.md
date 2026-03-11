# LLM Model Settings Panel Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a global settings panel that lets the user switch active Ollama text/vision/embed models at any time, persisted in SurrealDB, with a hardcoded catalog of cloud models.

**Architecture:** A `MODEL_CATALOG` (pure data, no env imports) defines cloud models by key. A `settings.ts` server-only helper reads active model keys from `settings:main` in SurrealDB and resolves them to `LLMProvider` instances or embed configs. All three processing routes delegate to these helpers instead of reading `env.*` directly.

**Tech Stack:** SvelteKit 2, Svelte 5, TypeScript, SurrealDB v2.0.2 (`surrealdb` npm), Bun

**Verification:** No test infrastructure exists — use `bun run check` after each task for type safety. API routes verified via curl smoke tests. **No unit tests are added** (YAGNI).

**Spec:** `docs/superpowers/specs/2026-03-11-llm-model-settings-design.md`

---

## Chunk 1: Foundation

Schema, env vars, `ModelSettings` type, `OllamaConfig.apiKey`, model catalog.

---

### Task 1: Apply schema change + add env vars

**Files:**
- Modify: `schema.surql`
- Modify: `.env.example`

- [ ] **Step 1: Add settings table to schema.surql**

Append at the end of `schema.surql`:

```sql
DEFINE TABLE settings SCHEMAFULL;
DEFINE FIELD text_model   ON TABLE settings TYPE string DEFAULT 'llama3.2';
DEFINE FIELD vision_model ON TABLE settings TYPE string DEFAULT 'llava';
DEFINE FIELD embed_model  ON TABLE settings TYPE string DEFAULT 'nomic-embed-text';
```

- [ ] **Step 2: Apply to running SurrealDB**

```bash
surreal sql --endpoint wss://surreal.ianhas.one \
  --user root --pass <SURREAL_PASS> \
  --ns compendium --db compendium <<'EOF'
DEFINE TABLE settings SCHEMAFULL;
DEFINE FIELD text_model   ON TABLE settings TYPE string DEFAULT 'llama3.2';
DEFINE FIELD vision_model ON TABLE settings TYPE string DEFAULT 'llava';
DEFINE FIELD embed_model  ON TABLE settings TYPE string DEFAULT 'nomic-embed-text';
EOF
```

Or paste the 4 lines into SurrealDB Studio.

- [ ] **Step 3: Add env vars to .env.example**

After the `OLLAMA_EMBED_MODEL` line, add:

```
OLLAMA_CLOUD_URL=https://ollama.com
OLLAMA_CLOUD_API_KEY=
```

- [ ] **Step 4: Commit**

```bash
git add schema.surql .env.example
git commit -m "feat: add settings table schema and cloud env vars"
```

---

### Task 2: Add ModelSettings to types.ts

**Files:**
- Modify: `src/lib/types.ts`

- [ ] **Step 1: Add interface after ProcessResult**

In `src/lib/types.ts`, after the `ProcessResult` interface (currently the last interface), add:

```ts
export interface ModelSettings {
	text_model: string;
	vision_model: string;
	embed_model: string;
}
```

- [ ] **Step 2: Type-check**

```bash
bun run check
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/types.ts
git commit -m "feat: add ModelSettings type"
```

---

### Task 3: Add apiKey support to OllamaConfig

**Files:**
- Modify: `src/lib/ollama.ts`

- [ ] **Step 1: Add apiKey to OllamaConfig interface**

Find the `OllamaConfig` interface and add `apiKey`:

```ts
export interface OllamaConfig {
	baseUrl: string;
	model?: string;
	apiKey?: string;
}
```

- [ ] **Step 2: Add authHeaders helper after the interface**

Directly after the `OllamaConfig` interface, add:

```ts
function authHeaders(config: { apiKey?: string }): Record<string, string> {
	return config.apiKey ? { Authorization: `Bearer ${config.apiKey}` } : {};
}
```

- [ ] **Step 3: Update all four fetch calls to spread authHeaders**

There are four `fetch` calls in `ollama.ts` — in `createOllamaProvider`, `describeImage`, `generateEmbedding`, and `transcribeAudio`. Each has `headers: { 'Content-Type': 'application/json' }`. Change each to:

```ts
headers: { 'Content-Type': 'application/json', ...authHeaders(config) },
```

For `transcribeAudio`, the function signature currently takes `config: OllamaConfig`. The `authHeaders(config)` call works as-is since `OllamaConfig` now has `apiKey`.

- [ ] **Step 4: Type-check**

```bash
bun run check
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/lib/ollama.ts
git commit -m "feat: add apiKey support to OllamaConfig with Authorization header"
```

---

### Task 4: Create model-catalog.ts

**Files:**
- Create: `src/lib/model-catalog.ts`

`model-catalog.ts` is pure data — no `$env` imports. Provider construction is done in `settings.ts` using env values injected by the calling server route.

- [ ] **Step 1: Create the file**

Create `src/lib/model-catalog.ts`:

```ts
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
 * OLLAMA_URL is kept separate (not here) because it's a local-Ollama concern.
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
```

- [ ] **Step 2: Type-check**

```bash
bun run check
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/model-catalog.ts
git commit -m "feat: add MODEL_CATALOG with cloud model definitions"
```

---

## Chunk 2: Settings helpers + API routes

---

### Task 5: Create settings.ts

**Files:**
- Create: `src/lib/settings.ts`

`settings.ts` is server-only (imported only from `+server.ts` files). It imports `$env/dynamic/private` for the `getActiveSettings` fallback path.

- [ ] **Step 1: Create the file**

Create `src/lib/settings.ts`:

```ts
import type { Surreal } from 'surrealdb';
import type { LLMProvider } from '$lib/llm-agent';
import { withRetry } from '$lib/llm-agent';
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
			await db.query('SELECT * FROM type::record($id)', { id: 'settings:main' })
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
```

- [ ] **Step 2: Type-check**

```bash
bun run check
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/settings.ts
git commit -m "feat: add settings helpers (getActiveSettings, resolveTextProvider, resolveEmbedConfig)"
```

---

### Task 6: Create /api/settings route

**Files:**
- Create: `src/routes/api/settings/+server.ts`

- [ ] **Step 1: Create directory and file**

```bash
mkdir -p src/routes/api/settings
```

Create `src/routes/api/settings/+server.ts`:

```ts
import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getDB } from '$lib/db';
import { env } from '$env/dynamic/private';
import { getActiveSettings, type ModelSettings } from '$lib/settings';
import { buildCatalog } from '$lib/model-catalog';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const q = <T>(v: unknown): T => v as unknown as T;

export const GET: RequestHandler = async () => {
	const db = await getDB();
	const settings = await getActiveSettings(db, env);
	return json(settings);
};

export const PATCH: RequestHandler = async ({ request }) => {
	let body: Partial<ModelSettings>;
	try {
		body = await request.json();
	} catch {
		throw error(400, 'Invalid JSON');
	}

	const allowed = ['text_model', 'vision_model', 'embed_model'] as const;
	const catalog = buildCatalog();

	for (const key of allowed) {
		const val = body[key];
		if (val !== undefined) {
			if (typeof val !== 'string' || val.trim() === '') {
				throw error(400, `${key} must be a non-empty string`);
			}
			if ((key === 'vision_model' || key === 'embed_model') && catalog[val]) {
				throw error(400, `${key} must be a local model — cloud models are not supported for vision/embed`);
			}
		}
	}

	const update: Partial<ModelSettings> = {};
	for (const key of allowed) {
		if (body[key] !== undefined) update[key] = body[key];
	}
	if (Object.keys(update).length === 0) {
		throw error(400, 'No valid fields to update');
	}

	try {
		const db = await getDB();
		// Merge with current values to ensure all three fields exist (SCHEMAFULL requires all fields)
		const current = await getActiveSettings(db, env);
		const merged: ModelSettings = { ...current, ...update };

		await db.query('UPDATE type::record($id) MERGE $data', {
			id: 'settings:main',
			data: merged
		});

		const [rows] = q<[ModelSettings[]]>(
			await db.query('SELECT * FROM type::record($id)', { id: 'settings:main' })
		);
		return json(rows?.[0] ?? merged);
	} catch (e) {
		console.error('[PATCH /api/settings]', e);
		throw error(500, 'Failed to save settings');
	}
};
```

- [ ] **Step 2: Type-check**

```bash
bun run check
```

Expected: no errors.

- [ ] **Step 3: Smoke test (requires running dev server: `bun run dev`)**

```bash
# GET — returns current defaults
curl http://localhost:5173/api/settings

# PATCH — switch text model to a cloud model
curl -X PATCH http://localhost:5173/api/settings \
  -H 'Content-Type: application/json' \
  -d '{"text_model": "kimi-k2:1t-cloud"}'

# Confirm persisted
curl http://localhost:5173/api/settings
# Expected: {"text_model":"kimi-k2:1t-cloud","vision_model":"llava","embed_model":"nomic-embed-text"}

# Confirm cloud embed is rejected
curl -X PATCH http://localhost:5173/api/settings \
  -H 'Content-Type: application/json' \
  -d '{"embed_model": "kimi-k2:1t-cloud"}'
# Expected: 400 error
```

- [ ] **Step 4: Commit**

```bash
git add src/routes/api/settings/+server.ts
git commit -m "feat: add /api/settings GET and PATCH endpoints"
```

---

### Task 7: Create /api/ollama/models route

**Files:**
- Create: `src/routes/api/ollama/models/+server.ts`

> The `src/routes/api/ollama/` directory already exists (for `/api/ollama/status`). Only create the `models/` subdirectory.

- [ ] **Step 1: Create directory and file**

```bash
mkdir -p src/routes/api/ollama/models
```

Create `src/routes/api/ollama/models/+server.ts`:

```ts
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { env } from '$env/dynamic/private';
import { buildCatalog } from '$lib/model-catalog';

export const GET: RequestHandler = async () => {
	const ollamaUrl = env.OLLAMA_URL ?? 'http://localhost:11434';

	// ─── Local models ─────────────────────────────────────────────────────────
	let local: string[] = [];
	try {
		const res = await fetch(`${ollamaUrl}/api/tags`, {
			signal: AbortSignal.timeout(3000)
		});
		if (res.ok) {
			const data = await res.json();
			local = (data.models ?? []).map((m: { name: string }) => m.name);
		}
	} catch {
		// Ollama unreachable — return empty local list
	}

	// ─── Cloud models (from catalog — no network call) ────────────────────────
	const catalog = buildCatalog();
	const cloud = Object.entries(catalog).map(([key, def]) => ({
		key,
		name: def.name,
		color: def.color,
		group: def.group
	}));

	return json({ local, cloud });
};
```

- [ ] **Step 2: Type-check**

```bash
bun run check
```

- [ ] **Step 3: Smoke test**

```bash
curl http://localhost:5173/api/ollama/models
# Expected: {"local":["llama3.1:8b","nomic-embed-text"],"cloud":[{...}, ...]}
```

- [ ] **Step 4: Commit**

```bash
git add src/routes/api/ollama/models/+server.ts
git commit -m "feat: add /api/ollama/models endpoint"
```

---

## Chunk 3: Update processing routes

---

### Task 8: Update /api/nodes/[id]/process

**Files:**
- Modify: `src/routes/api/nodes/[id]/process/+server.ts`

- [ ] **Step 1: Add new imports**

At the top of the file, add to the existing import block:

```ts
import { getActiveSettings, resolveTextProvider, resolveEmbedConfig } from '$lib/settings';
```

- [ ] **Step 2: Replace env model reads**

Find and remove these lines at the top of the POST handler:

```ts
const baseUrl = env.OLLAMA_URL ?? 'http://localhost:11434';
const textModel = env.OLLAMA_TEXT_MODEL ?? undefined;
const visionModel = env.OLLAMA_VISION_MODEL ?? undefined;
const embedModel = env.OLLAMA_EMBED_MODEL ?? undefined;
```

Replace with:

```ts
const baseUrl = env.OLLAMA_URL ?? 'http://localhost:11434';
const settings = await getActiveSettings(db, env);
const provider = withRetry(
	resolveTextProvider(settings.text_model, {
		OLLAMA_URL: baseUrl,
		OLLAMA_CLOUD_URL: env.OLLAMA_CLOUD_URL ?? 'https://ollama.com',
		OLLAMA_CLOUD_API_KEY: env.OLLAMA_CLOUD_API_KEY,
		GEMINI_API_KEY: env.GEMINI_API_KEY ?? ''
	}),
	{ maxRetries: 2 }
);
const embedCfg = resolveEmbedConfig(settings.embed_model, baseUrl);
```

- [ ] **Step 3: Remove the old provider construction line**

Remove:

```ts
const provider = withRetry(createOllamaProvider({ baseUrl, model: textModel }), {
	maxRetries: 2
});
```

(Replaced above — `provider` is now from `resolveTextProvider`.)

- [ ] **Step 4: Update vision and embed calls**

Vision — find:
```ts
const result = await describeImage(base64, { baseUrl, visionModel });
```
Change to:
```ts
const result = await describeImage(base64, { baseUrl, visionModel: settings.vision_model });
```

Embed — find:
```ts
const embedding = (await generateEmbedding(content, { baseUrl, embedModel })) ?? node.embedding ?? [];
```
Change to:
```ts
const embedding = (await generateEmbedding(content, embedCfg)) ?? node.embedding ?? [];
```

- [ ] **Step 5: Remove createOllamaProvider import if no longer used directly**

Check if `createOllamaProvider` is still referenced in this file. If not, remove it from the import line:

```ts
import {
	// createOllamaProvider,   ← remove if unused
	describeImage,
	generateEmbedding,
	extractComponents,
	proposeEdges
} from '$lib/ollama';
```

- [ ] **Step 6: Type-check**

```bash
bun run check
```

Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add src/routes/api/nodes/[id]/process/+server.ts
git commit -m "feat: use settings helpers in /process route"
```

---

### Task 9: Update /api/nodes/[id]/process-cloud

**Files:**
- Modify: `src/routes/api/nodes/[id]/process-cloud/+server.ts`

This route uses Gemini/Anthropic for text. Only the embed model needs to come from settings.

- [ ] **Step 1: Add import**

Add to imports:

```ts
import { getActiveSettings, resolveEmbedConfig } from '$lib/settings';
```

- [ ] **Step 2: Replace embed model read**

Find:
```ts
const ollamaUrl = env.OLLAMA_URL ?? 'http://localhost:11434';
const embedModel = env.OLLAMA_EMBED_MODEL ?? undefined;
```

Replace with:
```ts
const ollamaUrl = env.OLLAMA_URL ?? 'http://localhost:11434';
const settings = await getActiveSettings(db, env);
const embedCfg = resolveEmbedConfig(settings.embed_model, ollamaUrl);
```

- [ ] **Step 3: Update embed call**

Find:
```ts
const embedding =
	(await generateEmbedding(content, { baseUrl: ollamaUrl, embedModel })) ??
	node.embedding ??
	[];
```

Change to:
```ts
const embedding =
	(await generateEmbedding(content, embedCfg)) ??
	node.embedding ??
	[];
```

- [ ] **Step 4: Type-check + commit**

```bash
bun run check
git add src/routes/api/nodes/[id]/process-cloud/+server.ts
git commit -m "feat: use settings embed config in /process-cloud route"
```

---

### Task 10: Update /api/nodes/[id]/propose-edges

**Files:**
- Modify: `src/routes/api/nodes/[id]/propose-edges/+server.ts`

- [ ] **Step 1: Add imports**

```ts
import { getActiveSettings, resolveTextProvider } from '$lib/settings';
```

- [ ] **Step 2: Replace model reads**

Find:
```ts
const baseUrl = env.OLLAMA_URL ?? 'http://localhost:11434';
const textModel = env.OLLAMA_TEXT_MODEL ?? undefined;
```

Replace with:
```ts
const baseUrl = env.OLLAMA_URL ?? 'http://localhost:11434';
const settings = await getActiveSettings(db, env);
const provider = withRetry(
	resolveTextProvider(settings.text_model, {
		OLLAMA_URL: baseUrl,
		OLLAMA_CLOUD_URL: env.OLLAMA_CLOUD_URL ?? 'https://ollama.com',
		OLLAMA_CLOUD_API_KEY: env.OLLAMA_CLOUD_API_KEY,
		GEMINI_API_KEY: env.GEMINI_API_KEY ?? ''
	}),
	{ maxRetries: 2 }
);
```

- [ ] **Step 3: Remove old provider construction**

Remove:
```ts
const provider = withRetry(createOllamaProvider({ baseUrl, model: textModel }), { maxRetries: 2 });
```

- [ ] **Step 4: Remove createOllamaProvider import if unused**

Check if `createOllamaProvider` is still used in this file. If not, remove it from the import.

- [ ] **Step 5: Type-check + commit**

```bash
bun run check
git add src/routes/api/nodes/[id]/propose-edges/+server.ts
git commit -m "feat: use settings helpers in /propose-edges route"
```

---

## Chunk 4: UI — Settings Panel

---

### Task 11: Create SettingsPanel.svelte

**Files:**
- Create: `src/lib/components/SettingsPanel.svelte`

- [ ] **Step 1: Create the component**

Create `src/lib/components/SettingsPanel.svelte`:

```svelte
<script lang="ts">
	let isOpen = $state(false);

	type CloudModel = { key: string; name: string; color: string; group: 'ollama-cloud' | 'gemini' };

	let localModels = $state<string[]>([]);
	let cloudModels = $state<CloudModel[]>([]);
	let textModel = $state('');
	let visionModel = $state('');
	let embedModel = $state('');
	let loading = $state(false);
	let saving = $state(false);
	let loadError = $state('');

	async function open() {
		isOpen = true;
		loading = true;
		loadError = '';
		try {
			const [settingsRes, modelsRes] = await Promise.all([
				fetch('/api/settings'),
				fetch('/api/ollama/models')
			]);
			if (settingsRes.ok) {
				const s = await settingsRes.json();
				textModel = s.text_model;
				visionModel = s.vision_model;
				embedModel = s.embed_model;
			} else {
				loadError = 'Could not load current settings.';
				textModel = 'llama3.2';
				visionModel = 'llava';
				embedModel = 'nomic-embed-text';
			}
			if (modelsRes.ok) {
				const m = await modelsRes.json();
				localModels = m.local ?? [];
				cloudModels = m.cloud ?? [];
			}
		} catch {
			loadError = 'Failed to load settings.';
		} finally {
			loading = false;
		}
	}

	function close() {
		isOpen = false;
	}

	async function save() {
		saving = true;
		try {
			const res = await fetch('/api/settings', {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ text_model: textModel, vision_model: visionModel, embed_model: embedModel })
			});
			if (res.ok) {
				close();
			} else {
				loadError = 'Save failed — check console.';
			}
		} catch {
			loadError = 'Save failed — network error.';
		} finally {
			saving = false;
		}
	}

	function cloudByGroup(group: 'ollama-cloud' | 'gemini') {
		return cloudModels.filter((m) => m.group === group);
	}
</script>

<button class="gear-btn" onclick={open} title="Model settings" aria-label="Open model settings">⚙</button>

{#if isOpen}
	<div class="backdrop" onclick={close} role="presentation"></div>

	<div class="modal" role="dialog" aria-modal="true" aria-label="Model settings">
		<header>
			<span>Model Settings</span>
			<button class="close-btn" onclick={close}>✕</button>
		</header>

		{#if loadError}
			<p class="error">{loadError}</p>
		{/if}

		<div class="fields">
			<label>
				<span class="field-label">Text Model</span>
				<select bind:value={textModel} disabled={loading || saving}>
					{#if loading}
						<option disabled>Loading…</option>
					{:else}
						{#if localModels.length}
							<optgroup label="Local">
								{#each localModels as m}
									<option value={m}>{m}</option>
								{/each}
							</optgroup>
						{/if}
						{#if cloudByGroup('ollama-cloud').length}
							<optgroup label="Ollama Cloud">
								{#each cloudByGroup('ollama-cloud') as m}
									<option value={m.key}>{m.name}</option>
								{/each}
							</optgroup>
						{/if}
						{#if cloudByGroup('gemini').length}
							<optgroup label="Gemini">
								{#each cloudByGroup('gemini') as m}
									<option value={m.key}>{m.name}</option>
								{/each}
							</optgroup>
						{/if}
					{/if}
				</select>
			</label>

			<label>
				<span class="field-label">Vision Model <span class="local-only">(local only)</span></span>
				<select bind:value={visionModel} disabled={loading || saving}>
					{#if loading}
						<option disabled>Loading…</option>
					{:else if localModels.length === 0}
						<option disabled>No local models found</option>
					{:else}
						{#each localModels as m}
							<option value={m}>{m}</option>
						{/each}
					{/if}
				</select>
			</label>

			<label>
				<span class="field-label">Embed Model <span class="local-only">(local only)</span></span>
				<select bind:value={embedModel} disabled={loading || saving}>
					{#if loading}
						<option disabled>Loading…</option>
					{:else if localModels.length === 0}
						<option disabled>No local models found</option>
					{:else}
						{#each localModels as m}
							<option value={m}>{m}</option>
						{/each}
					{/if}
				</select>
			</label>
		</div>

		<div class="actions">
			<button class="btn-cancel" onclick={close} disabled={saving}>Cancel</button>
			<button class="btn-save" onclick={save} disabled={loading || saving}>
				{saving ? 'Saving…' : 'Save'}
			</button>
		</div>
	</div>
{/if}

<style>
	.gear-btn {
		background: rgba(255, 255, 255, 0.06);
		border: 1px solid rgba(255, 255, 255, 0.12);
		border-radius: 8px;
		color: rgba(255, 255, 255, 0.5);
		padding: 6px 10px;
		cursor: pointer;
		font-size: 16px;
		line-height: 1;
		transition: color 0.2s, background 0.2s;
	}
	.gear-btn:hover {
		color: rgba(255, 255, 255, 0.85);
		background: rgba(255, 255, 255, 0.1);
	}
	.backdrop {
		position: fixed;
		inset: 0;
		z-index: 50;
	}
	.modal {
		position: fixed;
		top: 50%;
		left: 50%;
		transform: translate(-50%, -50%);
		z-index: 51;
		width: 380px;
		background: rgba(10, 10, 20, 0.96);
		border: 1px solid rgba(255, 255, 255, 0.12);
		border-radius: 14px;
		backdrop-filter: blur(20px);
		padding: 20px;
		display: flex;
		flex-direction: column;
		gap: 16px;
	}
	header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		font-size: 14px;
		font-weight: 600;
		color: rgba(255, 255, 255, 0.85);
	}
	.close-btn {
		background: none;
		border: none;
		color: rgba(255, 255, 255, 0.4);
		cursor: pointer;
		font-size: 14px;
		padding: 2px 6px;
	}
	.close-btn:hover { color: rgba(255, 255, 255, 0.7); }
	.error {
		font-size: 12px;
		color: #ff6666;
		margin: 0;
		padding: 8px;
		background: rgba(255, 68, 68, 0.1);
		border-radius: 6px;
	}
	.fields {
		display: flex;
		flex-direction: column;
		gap: 12px;
	}
	label {
		display: flex;
		flex-direction: column;
		gap: 5px;
	}
	.field-label {
		font-size: 11px;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		color: rgba(255, 255, 255, 0.35);
	}
	.local-only {
		font-size: 10px;
		text-transform: none;
		letter-spacing: 0;
		color: rgba(255, 255, 255, 0.2);
	}
	select {
		background: rgba(255, 255, 255, 0.06);
		border: 1px solid rgba(255, 255, 255, 0.12);
		border-radius: 8px;
		color: rgba(255, 255, 255, 0.85);
		padding: 8px 10px;
		font-size: 13px;
		cursor: pointer;
		outline: none;
	}
	select:focus { border-color: rgba(68, 136, 255, 0.5); }
	select:disabled { opacity: 0.4; cursor: not-allowed; }
	.actions {
		display: flex;
		justify-content: flex-end;
		gap: 8px;
	}
	.btn-cancel {
		background: rgba(255, 255, 255, 0.06);
		border: 1px solid rgba(255, 255, 255, 0.1);
		border-radius: 8px;
		color: rgba(255, 255, 255, 0.5);
		padding: 8px 16px;
		font-size: 13px;
		cursor: pointer;
	}
	.btn-save {
		background: rgba(68, 136, 255, 0.2);
		border: 1px solid rgba(68, 136, 255, 0.4);
		border-radius: 8px;
		color: #4488ff;
		padding: 8px 16px;
		font-size: 13px;
		font-weight: 600;
		cursor: pointer;
	}
	.btn-save:disabled, .btn-cancel:disabled { opacity: 0.4; cursor: not-allowed; }
</style>
```

- [ ] **Step 2: Type-check**

```bash
bun run check
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/components/SettingsPanel.svelte
git commit -m "feat: add SettingsPanel component"
```

---

### Task 12: Add gear button to +page.svelte

**Files:**
- Modify: `src/routes/+page.svelte`

- [ ] **Step 1: Add import**

In the `<script>` block, add:

```ts
import SettingsPanel from '$lib/components/SettingsPanel.svelte';
```

- [ ] **Step 2: Mount in top bar**

Find the `.status-indicators` div (lines ~79–92). Add `<SettingsPanel />` immediately after its closing `</div>`:

```html
		<div class="status-indicators">
			<span
				class="ollama-dot"
				class:online={$ollamaAvailable === true}
				class:offline={$ollamaAvailable === false}
				title={$ollamaAvailable === true
					? 'Ollama online'
					: $ollamaAvailable === false
						? 'Ollama offline'
						: 'Checking Ollama…'}
			></span>
			<span class="count-label">{$nodes.length} nodes · {$edges.length} edges</span>
		</div>
		<SettingsPanel />
```

- [ ] **Step 3: Type-check**

```bash
bun run check
```

Expected: no errors.

- [ ] **Step 4: Manual smoke test**

```bash
bun run dev
```

1. ⚙ gear button appears in top bar
2. Click it — modal opens, dropdowns load with local models + cloud catalog
3. Change Text Model to a cloud model (e.g. "Kimi K2 1T")
4. Click Save — modal closes
5. Re-open settings — cloud model is still selected (persisted to DB)
6. Process a node — check server logs confirm the new model name is used

- [ ] **Step 5: Commit**

```bash
git add src/routes/+page.svelte
git commit -m "feat: add settings gear button to top bar"
```

---

## Final checklist

- [ ] `bun run check` passes clean
- [ ] Schema applied to SurrealDB instance
- [ ] `OLLAMA_CLOUD_URL` / `OLLAMA_CLOUD_API_KEY` set in `.env` if using cloud models
- [ ] ⚙ button visible in top bar
- [ ] Modal opens and populates correctly
- [ ] Selecting and saving a cloud model persists (`GET /api/settings` confirms)
- [ ] Processing a node uses the saved model (server logs confirm)
