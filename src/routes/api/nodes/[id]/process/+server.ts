/**
 * POST /api/nodes/[id]/process
 * Full Ollama processing pipeline on a pending node.
 */

import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getDB, serialize, serializeAll } from '$lib/db';
import { env } from '$env/dynamic/private';
import {
	createOllamaProvider,
	describeImage,
	generateEmbedding,
	extractComponents,
	proposeEdges
} from '$lib/ollama';
import { withRetry } from '$lib/llm-agent';
import type { CompendiumNode, ProcessResult } from '$lib/types';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const q = <T>(v: unknown): T => v as unknown as T;

export const POST: RequestHandler = async ({ params }) => {
	const db = await getDB();
	const baseUrl = env.OLLAMA_URL ?? 'http://localhost:11434';
	const textModel = env.OLLAMA_TEXT_MODEL ?? undefined;
	const visionModel = env.OLLAMA_VISION_MODEL ?? undefined;
	const embedModel = env.OLLAMA_EMBED_MODEL ?? undefined;

	const rows = q<CompendiumNode[]>(await db.select(`node:${params.id}`));
	const node = serialize<CompendiumNode>((Array.isArray(rows) ? rows[0] : rows) as CompendiumNode);
	if (!node?.id) throw error(404, 'Node not found');

	const provider = withRetry(createOllamaProvider({ baseUrl, model: textModel }), {
		maxRetries: 2
	});

	let content = node.content;
	let components: string[] = node.components ?? [];

	if (node.type === 'image' && node.raw_media) {
		const base64 = (node.raw_media as string).replace(/^data:[^;]+;base64,/, '');
		const result = await describeImage(base64, { baseUrl, visionModel });
		if (result) {
			content = result.description;
			components = result.components;
		}
	} else {
		components = await extractComponents(content, provider);
	}

	const embedding =
		(await generateEmbedding(content, { baseUrl, embedModel })) ?? node.embedding ?? [];

	const [existingRows] = q<[CompendiumNode[]]>(
		await db.query("SELECT * FROM node WHERE status = 'processed' AND id != $id", {
			id: `node:${params.id}`
		})
	);
	const existingNodes = serializeAll<CompendiumNode>((existingRows ?? []) as CompendiumNode[]);

	const proposals = await proposeEdges(
		{ id: `node:${params.id}`, content, components, embedding },
		existingNodes,
		provider
	);

	for (const proposal of proposals) {
		await db.create('edge', {
			from_node: `node:${params.id}`,
			to_node: proposal.to_node_id,
			relation: proposal.relation,
			reasoning: proposal.reasoning,
			status: 'proposed',
			created_at: new Date().toISOString()
		});
	}

	await db.merge(`node:${params.id}`, { content, components, embedding, status: 'processed' });
	const updatedRows = q<CompendiumNode[]>(await db.select(`node:${params.id}`));
	const updated = serialize<CompendiumNode>(
		(Array.isArray(updatedRows) ? updatedRows[0] : updatedRows) as CompendiumNode
	);

	const result: ProcessResult = { node: updated, edgesProposed: proposals.length };
	return json(result);
};
