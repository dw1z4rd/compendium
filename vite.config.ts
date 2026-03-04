import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [sveltekit()],
	ssr: {
		// surrealdb uses Node-specific APIs; keep it server-side only
		noExternal: ['surrealdb']
	}
});
