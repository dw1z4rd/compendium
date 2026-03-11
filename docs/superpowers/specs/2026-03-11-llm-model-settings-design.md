# LLM Model Settings Panel — Design Spec
Date: 2026-03-11

## Overview

Add a global settings panel to Compendium that lets the user switch the active Ollama models (text, vision, embed) at any time without editing `.env`. The selected models persist in SurrealDB and are used by all processing routes.

## Goals

- Replace hard-coded `.env` model reads in processing routes with DB-backed config
- Surface locally pulled Ollama models and cloud-hosted Ollama models in a single UI
- Persist settings to SurrealDB so they survive page reloads and work across devices
- Zero breaking changes — `.env` values remain the fallback when no DB setting exists

## Out of Scope

- Switching cloud providers (Gemini/Anthropic) — unchanged
- Per-node model override — global only
- Pulling new models from within the UI
- The `transcribeAudio` whisper model (hardcoded `"whisper"` in `ollama.ts`) — left for a future spec

---

## Data Layer

### SurrealDB: `settings:main`

A single record in a new `settings` table:

```json
{
  "text_model":   "llama3.1:8b",
  "vision_model": "llava",
  "embed_model":  "nomic-embed-text"
}
```

- Created on first `PATCH /api/settings` call
- If absent, all reads fall back to `OLLAMA_TEXT_MODEL`, `OLLAMA_VISION_MODEL`, `OLLAMA_EMBED_MODEL` env vars, then hardcoded defaults (`llama3.2`, `llava`, `nomic-embed-text`)
- **Partial MERGE semantics**: `PATCH` only overwrites fields that are present in the request body; absent fields retain their current DB value

### Schema addition (`schema.surql`)

```sql
DEFINE TABLE settings SCHEMAFULL;
DEFINE FIELD text_model   ON TABLE settings TYPE string;
DEFINE FIELD vision_model ON TABLE settings TYPE string;
DEFINE FIELD embed_model  ON TABLE settings TYPE string;
```

This must be applied to the SurrealDB instance before the feature is used.

---

## Shared Helper: `src/lib/settings.ts`

```ts
import type { Surreal } from 'surrealdb';

export async function getActiveSettings(db: Surreal): Promise<ModelSettings>
```

Reads `settings:main`; falls back to env vars / hardcoded defaults per field. Used by all three processing routes to keep fallback logic in one place.

> `ModelSettings` is defined in `src/lib/types.ts` (alongside other domain interfaces):
> ```ts
> export interface ModelSettings {
>   text_model: string;
>   vision_model: string;
>   embed_model: string;
> }
> ```

---

## API Layer

### `GET /api/settings`

Returns the current active model config.

**Response:**
```json
{
  "text_model": "llama3.1:8b",
  "vision_model": "llava",
  "embed_model": "nomic-embed-text"
}
```

Logic: call `getActiveSettings(db)` — always returns a valid object (env/default fallback on DB failure).

---

### `PATCH /api/settings`

Upserts model preferences. Uses SurrealDB `MERGE` so only provided fields are updated.

**Request body** (all fields optional, but any provided field must be a non-empty string):
```json
{
  "text_model": "deepseek-v3:latest"
}
```

**Validation:**
- Reject with 400 if any provided field is not a non-empty string
- Reject unknown fields (ignore silently — no extra DB writes)

**Response:** updated full settings record (same shape as GET).

**Error:** 500 on DB write failure.

---

### `GET /api/ollama/models`

Fetches and merges available models from two sources:

**1. Local** — `GET {OLLAMA_URL}/api/tags`

Response shape (from Ollama docs):
```json
{ "models": [{ "name": "llama3.1:8b", ... }, ...] }
```
Extract `models[].name`.

**2. Cloud** — `GET https://ollama.com/api/search?q=&limit=100&sort=featured`

This is Ollama's public library search endpoint (used by their website). It is not a formally documented API and has no stability guarantee. The implementation must wrap it in a `try/catch` and return `cloud: []` on any failure. Expected response shape (best-effort):
```json
{ "models": [{ "name": "deepseek-v3", "tags": [...], ... }] }
```
Model names from this source may not include a tag (e.g. `"deepseek-v3"` rather than `"deepseek-v3:latest"`). The implementation should append `:latest` if no colon is present.

**Response:**
```json
{
  "local": ["llama3.1:8b", "nomic-embed-text"],
  "cloud": ["deepseek-v3:latest", "kimi-k2-1t-cloud:latest"]
}
```

Graceful degradation:
- If Ollama is unreachable → `local: []`
- If Ollama library API is unreachable → `cloud: []`
- Never throws — always returns the partial result

---

### Modified: `POST /api/nodes/[id]/process`

Replace direct `env.*` model reads with `getActiveSettings(db)`:

```ts
const settings = await getActiveSettings(db);
// use settings.text_model, settings.vision_model, settings.embed_model
```

---

### Modified: `POST /api/nodes/[id]/process-cloud`

Use `getActiveSettings(db)` for the embed model (cloud routes still use Gemini/Anthropic for text/vision).

---

### Modified: `POST /api/nodes/[id]/propose-edges`

This route also reads `env.OLLAMA_TEXT_MODEL` directly. Replace with `getActiveSettings(db).text_model`.

---

## UI Layer

### Settings button

A gear icon (⚙) added to the existing top bar in `+page.svelte`, to the right of the Ollama status indicator. Always visible.

### Settings modal (`src/lib/components/SettingsPanel.svelte`)

A centered modal overlay. Opens when the gear icon is clicked.

**On open:**
1. `GET /api/settings` — populate current selections
2. `GET /api/ollama/models` — populate dropdown options

**Contents:**

| Label | Dropdown options |
|-------|-----------------|
| Text Model | Local group + Cloud group |
| Vision Model | Local group + Cloud group |
| Embed Model | Local group + Cloud group |

Each `<select>` uses `<optgroup label="Local">` and `<optgroup label="Cloud">` to visually separate the two sources.

**Actions:**
- **Save** — `PATCH /api/settings` with all three current selections, then close modal
- **Cancel / click outside** — close without saving

**Loading & error states:**
- Dropdowns show a disabled `"Loading…"` option while fetches are in-flight
- If `GET /api/settings` fails, selections default to the hardcoded defaults and a non-blocking inline error message is shown
- If `GET /api/ollama/models` fails entirely, both optgroups are empty but the dropdown still renders with a disabled `"Could not load models"` option
- Save button is disabled while fetches are in-flight or while the PATCH is in-flight

---

## Files Touched

| File | Change |
|------|--------|
| `src/lib/types.ts` | Add `ModelSettings` interface |
| `src/lib/settings.ts` | New — `getActiveSettings(db: Surreal)` helper |
| `src/routes/api/settings/+server.ts` | New — GET + PATCH |
| `src/routes/api/ollama/models/+server.ts` | New — GET (local + cloud merge) |
| `src/routes/api/nodes/[id]/process/+server.ts` | Use `getActiveSettings()` |
| `src/routes/api/nodes/[id]/process-cloud/+server.ts` | Use `getActiveSettings()` for embed model |
| `src/routes/api/nodes/[id]/propose-edges/+server.ts` | Use `getActiveSettings()` for text model |
| `src/lib/components/SettingsPanel.svelte` | New — modal UI |
| `src/routes/+page.svelte` | Add gear button + mount SettingsPanel |
| `schema.surql` | Add `settings` table definition |
