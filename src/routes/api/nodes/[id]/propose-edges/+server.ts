/**
 * POST /api/nodes/[id]/propose-edges
 * Run edge proposals only — assumes node already has components and embedding.
 */

import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getDB, serialize, serializeAll } from '$lib/db';
import { env } from '$env/dynamic/private';
import { proposeEdges } from '$lib/ollama';
import { withRetry } from '$lib/llm-agent';
import { getActiveSettings, resolveTextProvider } from '$lib/settings';
import type { CompendiumNode } from '$lib/types';

const q = <T>(v: unknown): T => v as unknown as T;

export const POST: RequestHandler = async ({ params }) => {
	const db = await getDB();
	const baseUrl = env.OLLAMA_URL ?? 'http://localhost:11434';
	const settings = await getActiveSettings(db, env as Parameters<typeof getActiveSettings>[1]);
	const provider = withRetry(
		resolveTextProvider(settings.text_model, {
			OLLAMA_URL: baseUrl,
			OLLAMA_CLOUD_URL: env.OLLAMA_CLOUD_URL ?? 'https://ollama.com',
			OLLAMA_CLOUD_API_KEY: env.OLLAMA_CLOUD_API_KEY,
			GEMINI_API_KEY: env.GEMINI_API_KEY ?? ''
		}),
		{ maxRetries: 2 }
	);

	const [nodeRows] = q<[CompendiumNode[]]>(await db.query('SELECT * FROM type::record($id)', { id: `node:${params.id}` }));
	const node = serialize<CompendiumNode>(nodeRows?.[0] as CompendiumNode);
	if (!node?.id) throw error(404, 'Node not found');

	const [existingRows] = q<[CompendiumNode[]]>(
		await db.query("SELECT * FROM node WHERE status = 'processed' AND id != $id", {
			id: `node:${params.id}`
		})
	);
	const existingNodes = serializeAll<CompendiumNode>((existingRows ?? []) as CompendiumNode[]);

	const proposals = await proposeEdges(
		{ id: node.id, type: node.type, content: node.content, components: node.components, embedding: node.embedding },
		existingNodes,
		provider
	);

	// Avoid duplicate edges — check existing edges first
	const [edgeRows] = q<[{ from_node: string; to_node: string }[]]>(
		await db.query('SELECT from_node, to_node FROM edge WHERE from_node = type::record($id) OR to_node = type::record($id)', {
			id: `node:${params.id}`
		})
	);
	const existingPairs = new Set(
		(edgeRows ?? []).map((e) => `${e.from_node}|${e.to_node}`)
	);

	let created = 0;
	for (const proposal of proposals) {
		const from = proposal._flipped ? proposal._originalTarget! : node.id;
		const to = proposal._flipped ? node.id : proposal.to_node_id;
		const fwd = `${from}|${to}`;
		const rev = `${to}|${from}`;
		if (existingPairs.has(fwd) || existingPairs.has(rev)) continue;

		await db.query(
			'CREATE edge SET from_node = type::record($from), to_node = type::record($to), relation = $relation, reasoning = $reasoning, status = $status, created_at = time::now()',
			{ from, to, relation: proposal.relation, reasoning: proposal.reasoning, status: 'proposed' }
		);
		created++;
	}

	return json({ edgesProposed: created });
};
