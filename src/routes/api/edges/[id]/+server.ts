import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getDB, serialize } from '$lib/db';
import type { CompendiumEdge, EdgeStatus } from '$lib/types';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const q = <T>(v: unknown): T => v as unknown as T;

export const PATCH: RequestHandler = async ({ params, request }) => {
	let body: { status?: EdgeStatus; annotation?: string };
	try {
		body = await request.json();
	} catch {
		throw error(400, 'Invalid JSON');
	}

	const allowed: EdgeStatus[] = ['proposed', 'accepted', 'rejected'];
	if (body.status && !allowed.includes(body.status)) {
		throw error(400, `status must be one of: ${allowed.join(', ')}`);
	}

	try {
		const db = await getDB();
		const update: Partial<CompendiumEdge> = {};
		if (body.status) update.status = body.status;
		if (body.annotation !== undefined) update.annotation = body.annotation;

		await db.merge(`edge:${params.id}`, update);
		const rows = q<CompendiumEdge[]>(await db.select(`edge:${params.id}`));
		const updated = Array.isArray(rows) ? rows[0] : rows;
		return json(serialize<CompendiumEdge>(updated as CompendiumEdge));
	} catch (e) {
		console.error('[PATCH /api/edges/:id]', e);
		throw error(500, 'Failed to update edge');
	}
};
