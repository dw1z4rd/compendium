import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { env } from '$env/dynamic/private';
import { transcribeAudio } from '$lib/ollama';

export const POST: RequestHandler = async ({ request }) => {
	let body: { audio: string };
	try {
		body = await request.json();
	} catch {
		throw error(400, 'Invalid JSON');
	}
	if (!body.audio) throw error(400, 'Missing audio field (base64)');

	const baseUrl = env.OLLAMA_URL ?? 'http://localhost:11434';
	const text = await transcribeAudio(body.audio, { baseUrl });

	if (!text) throw error(502, 'Transcription failed or Whisper model not available');
	return json({ text });
};
