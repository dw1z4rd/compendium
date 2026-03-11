/**
 * POST /api/nodes/[id]/process
 * Full Ollama processing pipeline on a pending node.
 */

import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getDB, serialize, serializeAll } from '$lib/db';
import { env } from '$env/dynamic/private';
import {
	describeImage,
	generateEmbedding,
	extractComponents,
	proposeEdges
} from '$lib/ollama';
import { withRetry } from '$lib/llm-agent';
import { getActiveSettings, resolveTextProvider, resolveEmbedConfig } from '$lib/settings';
import type { CompendiumNode, ProcessResult } from '$lib/types';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
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
	const embedCfg = resolveEmbedConfig(settings.embed_model, baseUrl);

	const [nodeRows] = q<[CompendiumNode[]]>(await db.query('SELECT * FROM type::record($id)', { id: `node:${params.id}` }));
	const node = serialize<CompendiumNode>(nodeRows?.[0] as CompendiumNode);
	if (!node?.id) throw error(404, 'Node not found');

	let content = node.content;
	let components: string[] = node.components ?? [];

	if (node.type === 'image' && node.raw_media) {
		const base64 = (node.raw_media as string).replace(/^data:[^;]+;base64,/, '');
		const result = await describeImage(base64, { baseUrl, visionModel: settings.vision_model });
		if (result) {
			content = result.description;
			components = result.components;
		}
	} else {
		components = await extractComponents(content, provider);
	}

	const embedding =
		(await generateEmbedding(content, embedCfg)) ?? node.embedding ?? [];

	const [existingRows] = q<[CompendiumNode[]]>(
		await db.query("SELECT * FROM node WHERE status = 'processed' AND id != $id", {
			id: `node:${params.id}`
		})
	);
	const existingNodes = serializeAll<CompendiumNode>((existingRows ?? []) as CompendiumNode[]);

	console.log('[process] node:', params.id, '| embedding:', embedding.length, '| components:', components, '| existing:', existingNodes.length);
	const proposals = await proposeEdges(
		{ id: `node:${params.id}`, type: node.type, content, components, embedding },
		existingNodes,
		provider
	);

	for (const proposal of proposals) {
		const from = proposal._flipped ? proposal._originalTarget! : `node:${params.id}`;
		const to = proposal._flipped ? `node:${params.id}` : proposal.to_node_id;
		await db.query(
			'CREATE edge SET from_node = type::record($from), to_node = type::record($to), relation = $relation, reasoning = $reasoning, status = $status, created_at = time::now()',
			{ from, to, relation: proposal.relation, reasoning: proposal.reasoning, status: 'proposed' }
		);
	}

	await db.query('UPDATE type::record($id) MERGE $data', {
		id: `node:${params.id}`,
		data: { content, components, embedding, status: 'processed' }
	});
	const [updatedRows] = q<[CompendiumNode[]]>(await db.query('SELECT * FROM type::record($id)', { id: `node:${params.id}` }));
	const updated = serialize<CompendiumNode>(updatedRows?.[0] as CompendiumNode);

	const result: ProcessResult = { node: updated, edgesProposed: proposals.length };
	return json(result);
};
