import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [sveltekit()],
	ssr: {
		// surrealdb uses Node-specific APIs; keep it server-side only
		// @threlte packages use conditional exports that SSR bundler can't resolve externally
		noExternal: ['surrealdb', '@threlte/core', '@threlte/extras']
	},
	build: {
		chunkSizeWarningLimit: 800,
		rollupOptions: {
			output: {
				manualChunks(id) {
					if (id.includes('node_modules/three/')) return 'three';
					if (id.includes('node_modules/@threlte/') || id.includes('node_modules/threlte')) return 'threlte';
					if (id.includes('node_modules/d3') || id.includes('node_modules/three-mesh-bvh')) return 'd3-three-extras';
				}
			}
		}
	}
});
