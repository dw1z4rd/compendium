/**
 * Ollama integration — implements LLMProvider from @llm/agent so you get
 * withRetry / withSystemPrompt for free, same as Gemini/Anthropic.
 *
 * Also provides vision (LLaVA), embeddings, audio transcription (Whisper),
 * component extraction, and edge proposal logic.
 */

import { withRetry, withSystemPrompt } from '$lib/llm-agent';
import type { LLMProvider, LLMOptions } from '$lib/llm-agent';
import type { CompendiumNode, RelationType, ProposedEdge } from '$lib/types';
import { ALL_RELATION_TYPES } from '$lib/types';

// ─── Defaults ─────────────────────────────────────────────────────────────────

const DEFAULT_TEXT_MODEL = 'llama3.2';
const DEFAULT_VISION_MODEL = 'llava';
const DEFAULT_EMBED_MODEL = 'nomic-embed-text';

// ─── Availability check ───────────────────────────────────────────────────────

export async function isOllamaAvailable(baseUrl: string): Promise<boolean> {
	try {
		const res = await fetch(`${baseUrl}/api/tags`, {
			signal: AbortSignal.timeout(3000)
		});
		return res.ok;
	} catch {
		return false;
	}
}

// ─── Text provider (implements LLMProvider) ───────────────────────────────────

export interface OllamaConfig {
	baseUrl: string;
	model?: string;
	apiKey?: string;
}

function authHeaders(config: { apiKey?: string }): Record<string, string> {
	return config.apiKey ? { Authorization: `Bearer ${config.apiKey}` } : {};
}

/**
 * Creates an LLMProvider backed by a local Ollama instance.
 * Compatible with withRetry() and withSystemPrompt() from @llm/agent.
 */
export function createOllamaProvider(config: OllamaConfig): LLMProvider {
	const model = config.model ?? DEFAULT_TEXT_MODEL;
	return {
		async generateText(prompt: string, options?: LLMOptions): Promise<string | null> {
			try {
				const body: Record<string, unknown> = { model, prompt, stream: false };
				if (options?.systemPrompt) body.system = options.systemPrompt;
				if (options?.maxTokens || options?.temperature !== undefined) {
					body.options = {
						...(options.maxTokens ? { num_predict: options.maxTokens } : {}),
						...(options.temperature !== undefined ? { temperature: options.temperature } : {})
					};
				}
				const res = await fetch(`${config.baseUrl}/api/generate`, {
					method: 'POST',
					headers: { 'Content-Type': 'application/json', ...authHeaders(config) },
					body: JSON.stringify(body)
				});
				if (!res.ok) return null;
				const data = await res.json();
				return (data.response as string)?.trim() || null;
			} catch {
				return null;
			}
		}
	};
}

// ─── Vision (LLaVA) ───────────────────────────────────────────────────────────

/**
 * Describe an image using LLaVA via Ollama.
 * @param base64Image  Raw base64 (no data URL prefix)
 */
export async function describeImage(
	base64Image: string,
	config: OllamaConfig & { visionModel?: string }
): Promise<{ description: string; components: string[] } | null> {
	const model = config.visionModel ?? DEFAULT_VISION_MODEL;
	const prompt =
		'Describe this image in detail. Then on a new line starting with "Components:", ' +
		'list 3–8 key conceptual primitives as a comma-separated list.';
	try {
		const res = await fetch(`${config.baseUrl}/api/generate`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json', ...authHeaders(config) },
			body: JSON.stringify({ model, prompt, images: [base64Image], stream: false })
		});
		if (!res.ok) return null;
		const data = await res.json();
		const text: string = (data.response as string)?.trim();
		if (!text) return null;

		const componentMatch = text.match(/components?:\s*(.+)/i);
		const components = componentMatch
			? componentMatch[1]
					.split(',')
					.map((s) => s.trim())
					.filter(Boolean)
			: [];
		return { description: text, components };
	} catch {
		return null;
	}
}

// ─── Embeddings ───────────────────────────────────────────────────────────────

export async function generateEmbedding(
	text: string,
	config: OllamaConfig & { embedModel?: string }
): Promise<number[] | null> {
	const model = config.embedModel ?? DEFAULT_EMBED_MODEL;
	try {
		const res = await fetch(`${config.baseUrl}/api/embeddings`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json', ...authHeaders(config) },
			body: JSON.stringify({ model, prompt: text })
		});
		if (!res.ok) return null;
		const data = await res.json();
		return (data.embedding as number[]) ?? null;
	} catch {
		return null;
	}
}

// ─── Audio transcription (Whisper via Ollama) ─────────────────────────────────

/**
 * Transcribe audio using a Whisper-compatible model loaded in Ollama.
 * The audio should be base64-encoded PCM or WAV data.
 * Note: Requires a whisper model pulled in Ollama (e.g. `ollama pull whisper`).
 */
export async function transcribeAudio(
	audioBase64: string,
	config: OllamaConfig
): Promise<string | null> {
	try {
		const res = await fetch(`${config.baseUrl}/api/generate`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json', ...authHeaders(config) },
			body: JSON.stringify({
				model: 'whisper',
				prompt: '',
				images: [audioBase64], // Ollama passes audio via the images field for whisper
				stream: false
			})
		});
		if (!res.ok) return null;
		const data = await res.json();
		return (data.response as string)?.trim() || null;
	} catch {
		return null;
	}
}

// ─── Component extraction ─────────────────────────────────────────────────────

const COMPONENT_SYSTEM = `You extract conceptual primitives from text.
Return ONLY a JSON array of 3–8 short strings (key concepts, themes, entities).
Example: ["coffee", "anxiety", "causation", "health habits"]
No explanation. Just the JSON array.`;

export async function extractComponents(
	content: string,
	provider: LLMProvider
): Promise<string[]> {
	const p = withSystemPrompt(provider, COMPONENT_SYSTEM);
	const result = await p.generateText(content, { maxTokens: 200, temperature: 0.2 });
	if (!result) return [];
	try {
		const match = result.match(/\[[\s\S]*?\]/);
		if (!match) return [];
		const parsed = JSON.parse(match[0]);
		return Array.isArray(parsed) ? parsed.filter((s) => typeof s === 'string') : [];
	} catch {
		return [];
	}
}

// ─── Edge proposal ────────────────────────────────────────────────────────────

function cosineSimilarity(a: number[], b: number[]): number {
	if (!a.length || !b.length || a.length !== b.length) return 0;
	let dot = 0,
		normA = 0,
		normB = 0;
	for (let i = 0; i < a.length; i++) {
		dot += a[i] * b[i];
		normA += a[i] ** 2;
		normB += b[i] ** 2;
	}
	return dot / (Math.sqrt(normA) * Math.sqrt(normB) || 1);
}

const EDGE_PROPOSAL_SYSTEM = `You are a knowledge graph editor connecting personal memories, beliefs, and thoughts.
Rules:
- Propose an edge only when the relationship is clearly evident from the specific content of both nodes.
- Memories and beliefs often connect causally: a traumatic memory may be the origin of a belief about oneself or others.
- The reasoning MUST cite specific content from BOTH nodes — not tone, domain, or inferred themes.
- Do NOT connect nodes based on mood, tone, or vague thematic similarity.
- Do NOT infer unstated connections. If the link isn't explicit in the text, do not propose it.
- Return [] when no direct relationship is evident. This is the correct and expected response most of the time.
- Return ONLY a valid JSON array. No explanation outside the array.`;

export async function proposeEdges(
	newNode: Pick<CompendiumNode, 'id' | 'type' | 'content' | 'components' | 'embedding'>,
	existingNodes: CompendiumNode[],
	provider: LLMProvider,
	maxComparisons = 20
): Promise<ProposedEdge[]> {
	if (!existingNodes.length) return [];

	// Rank candidates by embedding similarity; fall back to recency
	const candidates =
		newNode.embedding.length > 0
			? existingNodes
					.filter((n) => n.embedding.length > 0)
					.map((n) => ({
						node: n,
						sim: cosineSimilarity(newNode.embedding, n.embedding)
					}))
					.sort((a, b) => b.sim - a.sim)
					.slice(0, maxComparisons)
					.map((x) => x.node)
			: existingNodes.slice(-maxComparisons);

	const summary = candidates
		.map(
			(n, i) =>
				`${i + 1}. ID: ${n.id}\n   Type: ${n.type}\n   Content: ${n.content.slice(0, 300)}\n   Components: ${n.components.join(', ')}`
		)
		.join('\n\n');


	const prompt = `New node:
Type: ${newNode.type}
Content: ${newNode.content}
Components: ${newNode.components.join(', ')}

Existing nodes:
${summary}

Relationship taxonomy: ${ALL_RELATION_TYPES.join(', ')}

The edge direction is: NEW NODE --[relation]--> EXISTING NODE.
Choose the relation so this direction makes sense. If the existing node is the origin/cause and the new node is the effect, use "responds_to" or "contradicts" etc. rather than "origin_of".
Only use "origin_of" if the NEW NODE is literally the source/cause of the EXISTING NODE.

For each relationship, return an object:
{"to_node_id": "<exact id from above>", "relation": "<taxonomy term>", "reasoning": "<one sentence, must cite specific content from both nodes>"}

Be conservative. Most nodes will have no relationship. Return [] if no direct relationship is evident.`;

	console.log('[proposeEdges] candidates:', candidates.length);
	const p = withSystemPrompt(withRetry(provider, { maxRetries: 2 }), EDGE_PROPOSAL_SYSTEM);
	const result = await p.generateText(prompt, { maxTokens: 1200, temperature: 0.3 });
	console.log('[proposeEdges] LLM result:', result?.slice(0, 500));
	if (!result) return [];

	try {
		const match = result.match(/\[[\s\S]*\]/);
		if (!match) return [];
		const parsed = JSON.parse(match[0]);
		if (!Array.isArray(parsed)) return [];

		const candidateMap = new Map(candidates.map((n) => [n.id, n]));

		const causalRelations = ['origin_of', 'causes', 'enables', 'evokes'];
		const causalSources = ['memory', 'conversation'];
		const causalTargets = ['belief', 'thought'];

		return parsed
			.filter((e): e is ProposedEdge =>
				typeof e.to_node_id === 'string' &&
				typeof e.relation === 'string' &&
				typeof e.reasoning === 'string' &&
				(ALL_RELATION_TYPES as string[]).includes(e.relation)
			)
			.map((e): ProposedEdge => {
				const targetNode = candidateMap.get(e.to_node_id);
				if (!targetNode) return e;

				const isCausal = causalRelations.includes(e.relation);
				const newIsCausalSource = causalSources.includes(newNode.type);
				const targetIsCausalSource = causalSources.includes(targetNode.type);

				// Flip if causal direction is wrong: e.g. belief origin_of memory → memory origin_of belief
				if (isCausal && !newIsCausalSource && targetIsCausalSource) {
					return { ...e, _flipped: true, _originalTarget: e.to_node_id } as ProposedEdge;
				}

				return e;
			});
	} catch {
		return [];
	}
}
