/**
 * POST /api/nodes/[id]/process-cloud
 * Cloud LLM processing — opt-in, never automatic.
 * Body: { provider?: 'gemini' | 'anthropic', apiKey?: string }
 */

import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getDB, serialize, serializeAll } from '$lib/db';
import { env } from '$env/dynamic/private';
import { createCloudProvider, describeImageCloud } from '$lib/llm.js';
import { generateEmbedding, extractComponents, proposeEdges } from '$lib/ollama';
import { getActiveSettings, resolveEmbedConfig } from '$lib/settings';
import type { CompendiumNode, ProcessResult } from '$lib/types';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const q = <T>(v: unknown): T => v as unknown as T;

export const POST: RequestHandler = async ({ params, request }) => {
	let body: { provider?: string; apiKey?: string } = {};
	try {
		body = await request.json();
	} catch {
		/* body is optional */
	}

	const provider = (body.provider ?? 'gemini') as 'gemini' | 'anthropic';
	const apiKey =
		body.apiKey ??
		(provider === 'gemini' ? env.GEMINI_API_KEY : env.ANTHROPIC_API_KEY) ??
		'';
	if (!apiKey) throw error(400, `No API key provided for ${provider}`);

	const db = await getDB();
	const ollamaUrl = env.OLLAMA_URL ?? 'http://localhost:11434';
	const settings = await getActiveSettings(db, env as Parameters<typeof getActiveSettings>[1]);
	const embedCfg = resolveEmbedConfig(settings.embed_model, ollamaUrl);

	const [nodeRows] = q<[CompendiumNode[]]>(await db.query('SELECT * FROM type::record($id)', { id: `node:${params.id}` }));
	const node = serialize<CompendiumNode>(nodeRows?.[0] as CompendiumNode);
	if (!node?.id) throw error(404, 'Node not found');

	const llm = createCloudProvider({ provider, apiKey });

	let content = node.content;
	let components: string[] = node.components ?? [];

	if (node.type === 'image' && node.raw_media && provider === 'gemini') {
		const base64 = (node.raw_media as string).replace(/^data:([^;]+);base64,/, '');
		const mimeMatch = (node.raw_media as string).match(/^data:([^;]+);/);
		const mimeType = mimeMatch?.[1] ?? 'image/jpeg';
		const result = await describeImageCloud(base64, mimeType, apiKey);
		if (result) {
			content = result.description;
			components = result.components;
		}
	} else {
		components = await extractComponents(content, llm);
	}

	const embedding =
		(await generateEmbedding(content, embedCfg)) ??
		node.embedding ??
		[];

	const [existingRows] = q<[CompendiumNode[]]>(
		await db.query("SELECT * FROM node WHERE status = 'processed' AND id != $id", {
			id: `node:${params.id}`
		})
	);
	const existingNodes = serializeAll<CompendiumNode>((existingRows ?? []) as CompendiumNode[]);

	const proposals = await proposeEdges(
		{ id: `node:${params.id}`, type: node.type, content, components, embedding },
		existingNodes,
		llm
	);

	for (const proposal of proposals) {
		await db.query(
			'CREATE edge SET from_node = type::record($from), to_node = type::record($to), relation = $relation, reasoning = $reasoning, status = $status, created_at = time::now()',
			{
				from: `node:${params.id}`,
				to: proposal.to_node_id,
				relation: proposal.relation,
				reasoning: proposal.reasoning,
				status: 'proposed'
			}
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
