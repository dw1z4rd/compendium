import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getDB, serialize, serializeAll } from '$lib/db';
import type { CreateNodeInput, CompendiumNode } from '$lib/types';

// Shorthand: drop surrealdb generic constraints via unknown cast
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const q = <T>(v: unknown): T => v as unknown as T;

export const GET: RequestHandler = async () => {
	try {
		const db = await getDB();
		const [rows] = q<[CompendiumNode[]]>(
			await db.query('SELECT * FROM node ORDER BY created_at DESC')
		);
		return json(serializeAll<CompendiumNode>(rows ?? []));
	} catch (e) {
		console.error('[GET /api/nodes]', e);
		throw error(500, 'Failed to fetch nodes');
	}
};

export const POST: RequestHandler = async ({ request }) => {
	let body: CreateNodeInput;
	try {
		body = await request.json();
	} catch {
		throw error(400, 'Invalid JSON');
	}

	const { type, content, source, raw_media } = body;
	if (!type || !content || !source) throw error(400, 'Missing required fields');

	try {
		const db = await getDB();
		const [created] = q<[CompendiumNode[]]>(
			await db.query('CREATE node CONTENT $data', {
				data: {
					type,
					content,
					source,
					components: [],
					embedding: [],
					status: 'pending',
					created_at: new Date(),
					...(raw_media ? { raw_media } : {})
				}
			})
		);
		const node = created[0];
		return json(serialize<CompendiumNode>(node), { status: 201 });
	} catch (e) {
		console.error('[POST /api/nodes]', e);
		throw error(500, 'Failed to create node');
	}
};
