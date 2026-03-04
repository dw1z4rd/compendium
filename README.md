# Compendium

A personal knowledge graph. Anything you think, believe, remember, or photograph becomes a node. An LLM analyzes each new node and maps how it connects to existing ones using a structured relationship taxonomy. The primary interface is a 3D force-directed graph.

## Stack

| Layer | Tech |
|---|---|
| Frontend + API | SvelteKit 2 + Svelte 5 + TypeScript |
| 3D visualization | Threlte (Three.js for Svelte) + d3-force-3d |
| Database | SurrealDB (self-hosted on Linode) |
| Primary LLM | Ollama (local) |
| Cloud fallback | Gemini Flash or Claude — opt-in per node, never automatic |
| Voice transcription | Whisper via Ollama |
| Runtime | Bun |

## Data model

**Nodes** — `thought · belief · image · memory · conversation`

Each node has: `type`, `content`, `components` (extracted conceptual primitives), `embedding`, `status` (pending/processed), `source` (manual/voice/image/import), `created_at`, `raw_media?`

**Edges** — connect nodes with a typed relationship and LLM-generated reasoning

| Category | Relations |
|---|---|
| Logical | `supports` `contradicts` `implies` `requires` |
| Taxonomic | `is_a` `is_part_of` |
| Causal | `causes` `enables` `prevents` |
| Experiential | `evokes` `reframes` `parallels` |
| Generative | `origin_of` `responds_to` |

Edge statuses: `proposed` → `accepted` / `rejected` (with optional annotation)

## Processing pipeline

1. Node saved to SurrealDB immediately as `pending`
2. If image: LLaVA extracts description + conceptual components
3. Embedding generated via Ollama
4. LLM compares new node against existing nodes, proposes edges with taxonomy label + reasoning
5. Node becomes `processed`; proposed edges enter the review queue
6. User reviews edges: accept, reject, or reject with annotation

If Ollama is unreachable, the node stays `pending` until Ollama comes back online or the user taps **Process with cloud** (opt-in).

## Setup

### Prerequisites

- [Bun](https://bun.sh)
- [Ollama](https://ollama.com) running locally
- SurrealDB running on your Linode (behind nginx — see below)

### Install

```bash
bun install
```

### Environment

```bash
cp .env.example .env
```

Edit `.env`:

```env
SURREAL_URL=wss://surreal.ianhas.one
SURREAL_USER=root
SURREAL_PASS=your-password
SURREAL_NS=compendium
SURREAL_DB=compendium

OLLAMA_URL=http://localhost:11434
OLLAMA_TEXT_MODEL=llama3.2
OLLAMA_VISION_MODEL=llava
OLLAMA_EMBED_MODEL=nomic-embed-text

# Cloud fallback — only used when user explicitly requests it
GEMINI_API_KEY=
ANTHROPIC_API_KEY=
```

### Initialize SurrealDB schema

```bash
surreal import \
  --conn wss://surreal.ianhas.one \
  --user root --pass your-password \
  --ns compendium --db compendium \
  schema.surql
```

### Ollama models

Pull the models Compendium uses:

```bash
ollama pull llama3.2          # text reasoning + edge proposals
ollama pull llava             # image description (vision)
ollama pull nomic-embed-text  # embeddings
ollama pull whisper           # voice transcription (if available)
```

### Run

```bash
bun run dev      # development
bun run build    # production build
bun run preview  # preview production build
```

## nginx — SurrealDB proxy

SurrealDB runs on `127.0.0.1:8000` on the Linode. nginx terminates TLS and proxies the WebSocket connection.

**DNS:** add an `A` record for `surreal.ianhas.one` pointing to your Linode IP before running certbot.

```bash
# Deploy the config
sudo cp nginx-surreal.conf /etc/nginx/sites-available/surreal
sudo ln -s /etc/nginx/sites-available/surreal /etc/nginx/sites-enabled/

# Issue certificate
sudo certbot --nginx -d surreal.ianhas.one

# Reload
sudo nginx -t && sudo systemctl reload nginx
```

Make sure SurrealDB is bound to localhost only (`--bind 127.0.0.1:8000`), not `0.0.0.0`.

## LLM library

Uses a vendored copy of [`@llm/agent`](https://github.com/dw1z4rd/llm-agent) at `src/lib/llm-agent/`. Ollama is implemented as a custom `LLMProvider` so it gets `withRetry` and `withSystemPrompt` for free, identical to the built-in Gemini/Anthropic providers.

## Project structure

```
src/
├── lib/
│   ├── llm-agent/          ← vendored LLM provider library
│   ├── types.ts            ← Node, Edge, RelationType definitions
│   ├── db.ts               ← SurrealDB singleton connection
│   ├── ollama.ts           ← Ollama provider + vision + embeddings + edge proposal
│   ├── llm.ts              ← Cloud provider factory (Gemini / Anthropic)
│   ├── graph-store.ts      ← Svelte stores + search filter
│   └── components/
│       ├── Graph.svelte         ← 3D force-directed graph
│       ├── GraphNode.svelte     ← Node sphere (color = type, pulse = pending)
│       ├── GraphEdge.svelte     ← Edge line (color = relation category)
│       ├── SearchBar.svelte     ← Filters graph + expands taxonomic neighbors
│       ├── EdgeReviewPanel.svelte ← Accept / reject / annotate queue
│       └── InputPanel.svelte    ← Text / voice / image / import input
├── routes/
│   ├── +page.svelte
│   ├── api/nodes/               ← GET, POST, [id] GET/PATCH/DELETE
│   ├── api/nodes/[id]/process/       ← Ollama pipeline
│   ├── api/nodes/[id]/process-cloud/ ← Cloud fallback (opt-in)
│   ├── api/edges/[id]/          ← PATCH (accept/reject/annotate)
│   ├── api/ollama/status/       ← Availability check
│   └── api/transcribe/          ← Whisper transcription
└── types/
    └── d3-force-3d.d.ts    ← Type declarations for d3-force-3d
schema.surql                ← SurrealDB schema (tables, constraints, indexes)
nginx-surreal.conf          ← nginx WebSocket proxy config
```
