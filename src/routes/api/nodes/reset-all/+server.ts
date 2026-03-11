import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getDB } from '$lib/db';

export const POST: RequestHandler = async () => {
	try {
		const db = await getDB();
		await db.query("UPDATE node SET status = 'pending', components = [], embedding = []");
		await db.query('DELETE edge');
		return json({ ok: true });
	} catch (e) {
		console.error('[POST /api/nodes/reset-all]', e);
		throw error(500, 'Failed to reset nodes');
	}
};
