import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { env } from '$env/dynamic/private';
import { buildCatalog } from '$lib/model-catalog';

export const GET: RequestHandler = async () => {
	const ollamaUrl = env.OLLAMA_URL ?? 'http://localhost:11434';

	// ─── Local models ─────────────────────────────────────────────────────────
	let local: string[] = [];
	try {
		const res = await fetch(`${ollamaUrl}/api/tags`, {
			signal: AbortSignal.timeout(3000)
		});
		if (res.ok) {
			const data = await res.json();
			local = (data.models ?? []).map((m: { name: string }) => m.name);
		}
	} catch {
		// Ollama unreachable — return empty local list
	}

	// ─── Cloud models (from catalog — no network call) ────────────────────────
	const catalog = buildCatalog();
	const cloud = Object.entries(catalog).map(([key, def]) => ({
		key,
		name: def.name,
		color: def.color,
		group: def.group
	}));

	return json({ local, cloud });
};
