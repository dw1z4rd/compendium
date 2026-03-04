import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getDB, serializeAll } from '$lib/db';
import type { CompendiumEdge, EdgeStatus } from '$lib/types';

export const GET: RequestHandler = async ({ url }) => {
	const status = url.searchParams.get('status') as EdgeStatus | null;
	try {
		const db = await getDB();
		const query = status
			? 'SELECT * FROM edge WHERE status = $status ORDER BY created_at DESC'
			: 'SELECT * FROM edge ORDER BY created_at DESC';
		const vars = status ? { status } : {};
		const [rows] = await db.query<[CompendiumEdge[]]>(query, vars);
		return json(serializeAll((rows ?? []) as unknown as Record<string, unknown>[]));
	} catch (e) {
		console.error('[GET /api/edges]', e);
		throw error(500, 'Failed to fetch edges');
	}
};
