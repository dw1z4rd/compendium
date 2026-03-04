import { json } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import { isOllamaAvailable } from '$lib/ollama';

export const GET = async () => {
	const baseUrl = env.OLLAMA_URL ?? 'http://localhost:11434';
	const available = await isOllamaAvailable(baseUrl);
	return json({ available, url: baseUrl });
};
