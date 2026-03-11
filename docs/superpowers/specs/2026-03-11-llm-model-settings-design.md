# LLM Model Settings Panel — Design Spec
Date: 2026-03-11 (revised v3)

## Overview

Add a global settings panel to Compendium that lets the user switch the active Ollama models (text, vision, embed) at any time without editing `.env`. The selected models persist in SurrealDB. A hardcoded `MODEL_CATALOG` defines all available cloud models (Ollama cloud + Gemini); locally pulled models are fetched dynamically from the local Ollama instance.

## Goals

- Replace hard-coded `.env` model reads in processing routes with DB-backed config
- Surface locally pulled Ollama models and a curated list of cloud models in the UI
- Persist settings to SurrealDB so they survive page reloads and work across devices
- Zero breaking changes — `.env` values remain the fallback when no DB setting exists

## Out of Scope

- Switching cloud providers (Gemini/Anthropic) via the existing per-node cloud process flow — unchanged
- Per-node model override — global only
- Pulling new models from within the UI
- Cloud vision models — vision model selector shows local Ollama models only
- Cloud embed models — embed model selector shows local Ollama models only
- The `transcribeAudio` whisper model (hardcoded `"whisper"` in `ollama.ts`) — future spec

---

## New Environment Variables

```
OLLAMA_CLOUD_URL=https://ollama.com        # base URL for Ollama cloud models
OLLAMA_CLOUD_API_KEY=                      # optional auth key for Ollama cloud
```

Add both to `.env.example`. `OLLAMA_CLOUD_URL` defaults to `https://ollama.com` if absent.

---

## Model Catalog (`src/lib/model-catalog.ts`)

A plain `src/lib/` module with **no `$env` imports** — env values are injected by callers.

```ts
export interface ModelDef {
  name: string;         // display label
  color: string;        // hex color for UI badge
  group: 'ollama-cloud' | 'gemini';
}

export interface CatalogEnv {
  OLLAMA_CLOUD_URL: string;
  OLLAMA_CLOUD_API_KEY?: string;
  GEMINI_API_KEY: string;
}

// Returns the full model catalog as a plain data structure.
// makeProvider is resolved by resolveTextProvider in settings.ts (server-side).
export function buildCatalog(): Record<string, ModelDef> {
  return {
    "deepseek-v3.1:671b-cloud": { name: "DeepSeek V3.1",    color: "#4B8BF5", group: "ollama-cloud" },
    "deepseek-v3.2-cloud":      { name: "DeepSeek V3.2",    color: "#3B7BFF", group: "ollama-cloud" },
    "devstral-small-2:24b-cloud":{ name: "Devstral Small 2", color: "#FF7000", group: "ollama-cloud" },
    "kimi-k2:1t-cloud":         { name: "Kimi K2 1T",       color: "#A78BFA", group: "ollama-cloud" },
    "gemini-2.5-flash":         { name: "Gemini 2.5 Flash", color: "#1A73E8", group: "gemini"       },
    "gemini-2.0-flash":         { name: "Gemini 2.0 Flash", color: "#4285F4", group: "gemini"       },
  };
}
```

`buildCatalog()` returns only metadata (name, color, group). Provider construction is done server-side in `settings.ts` using injected env values.

---

## `OllamaConfig` change (`src/lib/ollama.ts`)

Add optional `apiKey` to the existing interface:

```ts
export interface OllamaConfig {
  baseUrl: string;
  model?: string;
  apiKey?: string;      // NEW — for Ollama cloud auth
}
```

When `apiKey` is set, include `Authorization: Bearer <apiKey>` in the `headers` of every `fetch` call inside `createOllamaProvider`, `describeImage`, `generateEmbedding`, and `transcribeAudio`.

---

## Data Layer

### SurrealDB: `settings:main`

```json
{
  "text_model":   "llama3.1:8b",
  "vision_model": "llava",
  "embed_model":  "nomic-embed-text"
}
```

- `text_model`: any local model name or a catalog key (e.g. `"kimi-k2:1t-cloud"`)
- `vision_model`: local Ollama model name only
- `embed_model`: local Ollama model name only
- Created on first `PATCH /api/settings` call
- Falls back to `OLLAMA_TEXT_MODEL` / `OLLAMA_VISION_MODEL` / `OLLAMA_EMBED_MODEL` env vars, then hardcoded defaults (`llama3.2`, `llava`, `nomic-embed-text`)
- `PATCH` uses SurrealDB `MERGE` — only provided fields are updated. The endpoint always writes all three fields on the first write to avoid missing-field errors on `SCHEMAFULL` records.

### Schema addition (`schema.surql`)

```sql
DEFINE TABLE settings SCHEMAFULL;
DEFINE FIELD text_model   ON TABLE settings TYPE string DEFAULT 'llama3.2';
DEFINE FIELD vision_model ON TABLE settings TYPE string DEFAULT 'llava';
DEFINE FIELD embed_model  ON TABLE settings TYPE string DEFAULT 'nomic-embed-text';
```

DEFAULTs ensure a `MERGE` with only one field creates a valid record.

---

## Shared Helpers (`src/lib/settings.ts`)

This file imports `$env/dynamic/private` (server-side only, imported by `+server.ts` files).

```ts
import type { Surreal } from 'surrealdb';
import type { LLMProvider } from '$lib/llm-agent';
import { buildCatalog, type CatalogEnv } from '$lib/model-catalog';

export interface ModelSettings {
  text_model: string;
  vision_model: string;
  embed_model: string;
}
```

> `ModelSettings` is also added to `src/lib/types.ts` and imported from there in `settings.ts`.

### `getActiveSettings(db: Surreal): Promise<ModelSettings>`

Queries `settings:main`. Wraps the DB read in try/catch — on any failure returns env var values / hardcoded defaults. Never throws.

### `resolveTextProvider(modelKey: string, env: CatalogEnv): LLMProvider`

Resolves a text model key to an `LLMProvider`:
- If `modelKey` is a key in `buildCatalog()` with `group: 'ollama-cloud'` → `createOllamaProvider({ baseUrl: env.OLLAMA_CLOUD_URL, apiKey: env.OLLAMA_CLOUD_API_KEY, model: modelKey })`
- If `modelKey` is a key in `buildCatalog()` with `group: 'gemini'` → `createGeminiProvider({ apiKey: env.GEMINI_API_KEY, model: modelKey })`
- Otherwise → `createOllamaProvider({ baseUrl: env.OLLAMA_URL, model: modelKey })` (local)

### `resolveEmbedConfig(embedKey: string, ollamaUrl: string): { baseUrl: string; embedModel: string }`

Always returns a local Ollama embed config. Embed never uses cloud:
- Returns `{ baseUrl: ollamaUrl, embedModel: embedKey }`
- If `embedKey` is a catalog key (shouldn't happen via UI, but defensively handled) → returns `{ baseUrl: ollamaUrl, embedModel: DEFAULT_EMBED_MODEL }`

---

## API Layer

### `GET /api/settings`

Returns the current active model config. Calls `getActiveSettings(db)`. Always returns a valid object.

### `PATCH /api/settings`

Upserts model preferences.

**Validation:**
- Any provided field must be a non-empty string
- `vision_model` and `embed_model` must not be catalog keys (reject 400 if they are)
- Unknown fields silently ignored
- Returns 400 on invalid input, 500 on DB failure

**First-write behavior:** if `settings:main` does not yet exist, the endpoint writes all three fields (merging request values with env/default fallbacks for any omitted fields) to ensure the `SCHEMAFULL` record is complete.

### `GET /api/ollama/models`

Returns model lists for the settings UI:

```json
{
  "local": ["llama3.1:8b", "nomic-embed-text"],
  "cloud": [
    { "key": "kimi-k2:1t-cloud", "name": "Kimi K2 1T", "color": "#A78BFA", "group": "ollama-cloud" },
    { "key": "gemini-2.0-flash",  "name": "Gemini 2.0 Flash", "color": "#4285F4", "group": "gemini" }
  ]
}
```

- `local`: fetched from `GET {OLLAMA_URL}/api/tags` → `models[].name`. Returns `[]` if unreachable.
- `cloud`: `Object.entries(buildCatalog()).map(([key, def]) => ({ key, ...def }))`. Always available (no network call).

### Modified processing routes

All three routes (`/process`, `/process-cloud`, `/propose-edges`) replace direct `env.*` model reads:

```ts
const settings = await getActiveSettings(db);
const env = { OLLAMA_URL, OLLAMA_CLOUD_URL, OLLAMA_CLOUD_API_KEY, GEMINI_API_KEY };
const textProvider = resolveTextProvider(settings.text_model, env);
const embedCfg = resolveEmbedConfig(settings.embed_model, OLLAMA_URL);
// vision: describeImage(base64, { baseUrl: OLLAMA_URL, visionModel: settings.vision_model })
```

---

## UI Layer

### Settings button

A gear icon (⚙) added to the top bar in `+page.svelte`, to the right of the Ollama status indicator.

### `src/lib/components/SettingsPanel.svelte`

A centered modal overlay.

**On open:**
1. `GET /api/settings` → populate current selections
2. `GET /api/ollama/models` → populate dropdowns

**Dropdown structure:**

| Selector | Available options |
|----------|-------------------|
| Text Model | Local (from `/api/tags`) + Ollama Cloud + Gemini optgroups |
| Vision Model | Local only (from `/api/tags`) |
| Embed Model | Local only (from `/api/tags`) |

Text Model shows `<optgroup label="Local">`, `<optgroup label="Ollama Cloud">`, `<optgroup label="Gemini">`.
Vision and Embed show only `<optgroup label="Local">`.

Cloud options show their display name from the catalog, not the raw key.

**Actions:**
- **Save** — `PATCH /api/settings` with all three values, then close
- **Cancel / click outside** — close without saving

**Loading & error states:**
- Dropdowns show disabled `"Loading…"` while fetches are in-flight
- If `GET /api/settings` fails: selections default to hardcoded defaults; inline error shown
- If local Ollama is unreachable: Local optgroups are empty; cloud optgroup in Text Model still renders
- Save button disabled while any fetch or the PATCH is in-flight

---

## Files Touched

| File | Change |
|------|--------|
| `.env.example` | Add `OLLAMA_CLOUD_URL`, `OLLAMA_CLOUD_API_KEY` |
| `src/lib/types.ts` | Add `ModelSettings` interface |
| `src/lib/ollama.ts` | Add `apiKey` to `OllamaConfig`; pass `Authorization` header when set |
| `src/lib/model-catalog.ts` | New — `buildCatalog()`, `ModelDef`, `CatalogEnv` (no `$env` imports) |
| `src/lib/settings.ts` | New — `getActiveSettings`, `resolveTextProvider`, `resolveEmbedConfig` |
| `src/routes/api/settings/+server.ts` | New — GET + PATCH |
| `src/routes/api/ollama/models/+server.ts` | New — local + cloud model list |
| `src/routes/api/nodes/[id]/process/+server.ts` | Use settings helpers |
| `src/routes/api/nodes/[id]/process-cloud/+server.ts` | Use `getActiveSettings` for embed |
| `src/routes/api/nodes/[id]/propose-edges/+server.ts` | Use settings helpers |
| `src/lib/components/SettingsPanel.svelte` | New — modal UI |
| `src/routes/+page.svelte` | Add gear button + mount SettingsPanel |
| `schema.surql` | Add `settings` table definition with DEFAULT values |
