import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getDB } from '$lib/db';
import { env } from '$env/dynamic/private';
import { getActiveSettings, type ModelSettings } from '$lib/settings';
import { buildCatalog } from '$lib/model-catalog';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const q = <T>(v: unknown): T => v as unknown as T;

export const GET: RequestHandler = async () => {
	const db = await getDB();
	const settings = await getActiveSettings(db, env as Parameters<typeof getActiveSettings>[1]);
	return json(settings);
};

export const PATCH: RequestHandler = async ({ request }) => {
	let body: Partial<ModelSettings>;
	try {
		body = await request.json();
	} catch {
		throw error(400, 'Invalid JSON');
	}

	const allowed = ['text_model', 'vision_model', 'embed_model'] as const;
	const catalog = buildCatalog();

	for (const key of allowed) {
		const val = body[key];
		if (val !== undefined) {
			if (typeof val !== 'string' || val.trim() === '') {
				throw error(400, `${key} must be a non-empty string`);
			}
			if ((key === 'vision_model' || key === 'embed_model') && catalog[val]) {
				throw error(400, `${key} must be a local model — cloud models are not supported for vision/embed`);
			}
		}
	}

	const update: Partial<ModelSettings> = {};
	for (const key of allowed) {
		if (body[key] !== undefined) update[key] = (body[key] as string).trim();
	}
	if (Object.keys(update).length === 0) {
		throw error(400, 'No valid fields to update');
	}

	try {
		const db = await getDB();
		// Merge with current values to ensure all three fields exist (SCHEMAFULL requires all fields)
		const current = await getActiveSettings(db, env as Parameters<typeof getActiveSettings>[1]);
		const merged: ModelSettings = { ...current, ...update };

		await db.query('UPSERT settings:main MERGE $data', { data: merged });

		const [rows] = q<[ModelSettings[]]>(
			await db.query('SELECT * FROM settings:main')
		);
		return json(rows?.[0] ?? merged);
	} catch (e) {
		console.error('[PATCH /api/settings]', e);
		throw error(500, 'Failed to save settings');
	}
};
