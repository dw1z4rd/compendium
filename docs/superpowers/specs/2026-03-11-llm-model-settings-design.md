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

---

## Data Layer

### SurrealDB: `settings:main`

A single record in a `settings` table:

```json
{
  "text_model":   "llama3.1:8b",
  "vision_model": "llava",
  "embed_model":  "nomic-embed-text"
}
```

- Created on first `PATCH /api/settings` call
- If absent, all reads fall back to `OLLAMA_TEXT_MODEL`, `OLLAMA_VISION_MODEL`, `OLLAMA_EMBED_MODEL` env vars (then hardcoded defaults)
- No schema migration required — SurrealDB creates the record on first upsert

---

## API Layer

### `GET /api/settings`

Returns current active model config.

**Response:**
```json
{
  "text_model": "llama3.1:8b",
  "vision_model": "llava",
  "embed_model": "nomic-embed-text"
}
```

Logic: read `settings:main` from DB; if absent, return env var values / hardcoded defaults.

---

### `PATCH /api/settings`

Upserts model preferences.

**Request body** (all fields optional):
```json
{
  "text_model": "deepseek-v3:latest",
  "vision_model": "llava",
  "embed_model": "nomic-embed-text"
}
```

**Response:** updated settings record.

---

### `GET /api/ollama/models`

Fetches and merges available models from two sources:

1. **Local** — `GET {OLLAMA_URL}/api/tags` → extract `models[].name`
2. **Cloud** — `GET https://ollama.com/api/search?q=&limit=100&sort=featured` (or equivalent) → filter for models with cloud availability

Returns:
```json
{
  "local": ["llama3.1:8b", "nomic-embed-text"],
  "cloud": ["deepseek-v3:latest", "kimi-k2-1t-cloud", "..."]
}
```

If the Ollama library API is unreachable, `cloud` is an empty array (graceful degradation).

---

### Modified: `POST /api/nodes/[id]/process`

At the start of the handler, resolve active models:

```ts
const settings = await getActiveSettings(db);
const textModel = settings.text_model;
const visionModel = settings.vision_model;
const embedModel = settings.embed_model;
```

`getActiveSettings(db)` is a shared helper (e.g. `src/lib/settings.ts`) that:
1. Queries `settings:main` from DB
2. Falls back to env vars / hardcoded defaults per field

The same helper is used in `process-cloud` for the embed model (which still uses Ollama even in cloud mode).

---

## UI Layer

### Settings button

A gear icon (⚙) added to the existing top bar in `+page.svelte`, to the right of the Ollama status indicator. Always visible.

### Settings modal (`SettingsPanel.svelte`)

A centered modal overlay. Opens when the gear icon is clicked.

**On open:**
1. `GET /api/settings` — populate current selections
2. `GET /api/ollama/models` — populate dropdown options

**Contents:**

| Label | Dropdown options |
|-------|-----------------|
| Text Model | Local group + Cloud group |
| Vision Model | Local group + Cloud group |
| Embed Model | Local group (cloud embed models unlikely but included if returned) |

Each `<select>` uses `<optgroup>` to visually separate Local vs Cloud models.

**Actions:**
- **Save** — `PATCH /api/settings` with all three values, then close modal
- **Cancel / click outside** — close without saving

**Loading states:**
- Dropdowns show a disabled "Loading…" option while fetching
- Save button is disabled while the PATCH is in-flight

---

## Shared Helper: `src/lib/settings.ts`

```ts
export interface ModelSettings {
  text_model: string;
  vision_model: string;
  embed_model: string;
}

export async function getActiveSettings(db): Promise<ModelSettings>
```

Used by both processing routes to keep the fallback logic in one place.

---

## Error Handling

- `GET /api/ollama/models`: if Ollama is unreachable, `local: []`; if Ollama library API is unreachable, `cloud: []`. Never throws — UI degrades gracefully.
- `GET /api/settings`: if DB read fails, returns env/default values.
- `PATCH /api/settings`: returns 500 on DB write failure with error message.

---

## Files Touched

| File | Change |
|------|--------|
| `src/lib/settings.ts` | New — `getActiveSettings()` helper |
| `src/routes/api/settings/+server.ts` | New — GET + PATCH |
| `src/routes/api/ollama/models/+server.ts` | New — GET |
| `src/routes/api/nodes/[id]/process/+server.ts` | Use `getActiveSettings()` instead of `env.*` |
| `src/routes/api/nodes/[id]/process-cloud/+server.ts` | Use `getActiveSettings()` for embed model |
| `src/lib/components/SettingsPanel.svelte` | New — modal UI |
| `src/routes/+page.svelte` | Add gear button + mount SettingsPanel |
