import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getDB, serialize } from '$lib/db';
import type { CompendiumNode } from '$lib/types';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const q = <T>(v: unknown): T => v as unknown as T;

export const GET: RequestHandler = async ({ params }) => {
	try {
		const db = await getDB();
		const [rows] = q<[CompendiumNode[]]>(await db.query('SELECT * FROM type::record($id)', { id: `node:${params.id}` }));
		const node = rows?.[0];
		if (!node) throw error(404, 'Node not found');
		return json(serialize<CompendiumNode>(node));
	} catch (e: unknown) {
		if (e instanceof Error && 'status' in e) throw e;
		console.error('[GET /api/nodes/:id]', e);
		throw error(500, 'Failed to fetch node');
	}
};

export const PATCH: RequestHandler = async ({ params, request }) => {
	let body: Record<string, unknown>;
	try {
		body = await request.json();
	} catch {
		throw error(400, 'Invalid JSON');
	}
	try {
		const db = await getDB();
		await db.query('UPDATE type::record($id) MERGE $data', { id: `node:${params.id}`, data: body });
		const [rows] = q<[CompendiumNode[]]>(await db.query('SELECT * FROM type::record($id)', { id: `node:${params.id}` }));
		const updated = rows?.[0];
		return json(serialize<CompendiumNode>(updated));
	} catch (e) {
		console.error('[PATCH /api/nodes/:id]', e);
		throw error(500, 'Failed to update node');
	}
};

export const DELETE: RequestHandler = async ({ params }) => {
	try {
		const db = await getDB();
		await db.query('DELETE type::record($id)', { id: `node:${params.id}` });
		return new Response(null, { status: 204 });
	} catch (e) {
		console.error('[DELETE /api/nodes/:id]', e);
		throw error(500, 'Failed to delete node');
	}
};
