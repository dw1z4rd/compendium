// vite.config.ts
import { sveltekit } from "file:///mnt/c/Users/tooln/dev/compendium/node_modules/@sveltejs/kit/src/exports/vite/index.js";
import { defineConfig } from "file:///mnt/c/Users/tooln/dev/compendium/node_modules/vite/dist/node/index.js";
var vite_config_default = defineConfig({
  plugins: [sveltekit()],
  ssr: {
    // surrealdb uses Node-specific APIs; keep it server-side only
    noExternal: ["surrealdb"]
  },
  build: {
    chunkSizeWarningLimit: 800,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("node_modules/three/")) return "three";
          if (id.includes("node_modules/@threlte/") || id.includes("node_modules/threlte")) return "threlte";
          if (id.includes("node_modules/d3") || id.includes("node_modules/three-mesh-bvh")) return "d3-three-extras";
        }
      }
    }
  }
});
export {
  vite_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCIvbW50L2MvVXNlcnMvdG9vbG4vZGV2L2NvbXBlbmRpdW1cIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfZmlsZW5hbWUgPSBcIi9tbnQvYy9Vc2Vycy90b29sbi9kZXYvY29tcGVuZGl1bS92aXRlLmNvbmZpZy50c1wiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9pbXBvcnRfbWV0YV91cmwgPSBcImZpbGU6Ly8vbW50L2MvVXNlcnMvdG9vbG4vZGV2L2NvbXBlbmRpdW0vdml0ZS5jb25maWcudHNcIjtpbXBvcnQgeyBzdmVsdGVraXQgfSBmcm9tICdAc3ZlbHRlanMva2l0L3ZpdGUnO1xuaW1wb3J0IHsgZGVmaW5lQ29uZmlnIH0gZnJvbSAndml0ZSc7XG5cbmV4cG9ydCBkZWZhdWx0IGRlZmluZUNvbmZpZyh7XG5cdHBsdWdpbnM6IFtzdmVsdGVraXQoKV0sXG5cdHNzcjoge1xuXHRcdC8vIHN1cnJlYWxkYiB1c2VzIE5vZGUtc3BlY2lmaWMgQVBJczsga2VlcCBpdCBzZXJ2ZXItc2lkZSBvbmx5XG5cdFx0bm9FeHRlcm5hbDogWydzdXJyZWFsZGInXVxuXHR9LFxuXHRidWlsZDoge1xuXHRcdGNodW5rU2l6ZVdhcm5pbmdMaW1pdDogODAwLFxuXHRcdHJvbGx1cE9wdGlvbnM6IHtcblx0XHRcdG91dHB1dDoge1xuXHRcdFx0XHRtYW51YWxDaHVua3MoaWQpIHtcblx0XHRcdFx0XHRpZiAoaWQuaW5jbHVkZXMoJ25vZGVfbW9kdWxlcy90aHJlZS8nKSkgcmV0dXJuICd0aHJlZSc7XG5cdFx0XHRcdFx0aWYgKGlkLmluY2x1ZGVzKCdub2RlX21vZHVsZXMvQHRocmVsdGUvJykgfHwgaWQuaW5jbHVkZXMoJ25vZGVfbW9kdWxlcy90aHJlbHRlJykpIHJldHVybiAndGhyZWx0ZSc7XG5cdFx0XHRcdFx0aWYgKGlkLmluY2x1ZGVzKCdub2RlX21vZHVsZXMvZDMnKSB8fCBpZC5pbmNsdWRlcygnbm9kZV9tb2R1bGVzL3RocmVlLW1lc2gtYnZoJykpIHJldHVybiAnZDMtdGhyZWUtZXh0cmFzJztcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH1cblx0fVxufSk7XG4iXSwKICAibWFwcGluZ3MiOiAiO0FBQXFSLFNBQVMsaUJBQWlCO0FBQy9TLFNBQVMsb0JBQW9CO0FBRTdCLElBQU8sc0JBQVEsYUFBYTtBQUFBLEVBQzNCLFNBQVMsQ0FBQyxVQUFVLENBQUM7QUFBQSxFQUNyQixLQUFLO0FBQUE7QUFBQSxJQUVKLFlBQVksQ0FBQyxXQUFXO0FBQUEsRUFDekI7QUFBQSxFQUNBLE9BQU87QUFBQSxJQUNOLHVCQUF1QjtBQUFBLElBQ3ZCLGVBQWU7QUFBQSxNQUNkLFFBQVE7QUFBQSxRQUNQLGFBQWEsSUFBSTtBQUNoQixjQUFJLEdBQUcsU0FBUyxxQkFBcUIsRUFBRyxRQUFPO0FBQy9DLGNBQUksR0FBRyxTQUFTLHdCQUF3QixLQUFLLEdBQUcsU0FBUyxzQkFBc0IsRUFBRyxRQUFPO0FBQ3pGLGNBQUksR0FBRyxTQUFTLGlCQUFpQixLQUFLLEdBQUcsU0FBUyw2QkFBNkIsRUFBRyxRQUFPO0FBQUEsUUFDMUY7QUFBQSxNQUNEO0FBQUEsSUFDRDtBQUFBLEVBQ0Q7QUFDRCxDQUFDOyIsCiAgIm5hbWVzIjogW10KfQo=
