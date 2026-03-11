<script lang="ts">
	import { onMount } from 'svelte';
	import Graph from '$lib/components/Graph.svelte';
	import SearchBar from '$lib/components/SearchBar.svelte';
	import InputPanel from '$lib/components/InputPanel.svelte';
	import EdgeReviewPanel from '$lib/components/EdgeReviewPanel.svelte';
	import NodeDetailPanel from '$lib/components/NodeDetailPanel.svelte';
	import {
		nodes,
		edges,
		isLoading,
		ollamaAvailable,
		upsertNode,
		upsertEdge
	} from '$lib/graph-store';
	import type { CompendiumNode, CompendiumEdge, GraphNode } from '$lib/types';

	function toGraphNode(n: CompendiumNode): GraphNode {
		return { ...n, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, connectionCount: 0 };
	}

	onMount(() => {
		isLoading.set(true);
		let statusInterval: ReturnType<typeof setInterval>;

		(async () => {
		try {
			// Load data and check Ollama in parallel
			const [nodesRes, edgesRes, ollamaRes] = await Promise.all([
				fetch('/api/nodes'),
				fetch('/api/edges'),
				fetch('/api/ollama/status')
			]);

			if (nodesRes.ok) {
				const data: CompendiumNode[] = await nodesRes.json();
				nodes.set(data.map(toGraphNode));
			}
			if (edgesRes.ok) {
				const data: CompendiumEdge[] = await edgesRes.json();
				edges.set(data);
			}
			if (ollamaRes.ok) {
				const { available } = await ollamaRes.json();
				ollamaAvailable.set(available);
			}
		} catch (e) {
			console.error('Failed to load initial data:', e);
		} finally {
			isLoading.set(false);
		}

		// Poll Ollama status every 30s
		statusInterval = setInterval(async () => {
			try {
				const res = await fetch('/api/ollama/status');
				if (res.ok) {
					const { available } = await res.json();
					ollamaAvailable.set(available);
				}
			} catch {
				ollamaAvailable.set(false);
			}
		}, 30_000);
		})();

		return () => clearInterval(statusInterval);
	});
</script>

<!-- Full-screen 3D graph -->
<Graph />

<!-- HUD overlays -->
<div class="hud">
	<!-- Top bar: search + status -->
	<div class="top-bar">
		<SearchBar />
		<div class="status-indicators">
			<span
				class="ollama-dot"
				class:online={$ollamaAvailable === true}
				class:offline={$ollamaAvailable === false}
				title={$ollamaAvailable === true
					? 'Ollama online'
					: $ollamaAvailable === false
						? 'Ollama offline'
						: 'Checking Ollama…'}
			></span>
			<span class="count-label">{$nodes.length} nodes · {$edges.length} edges</span>
		</div>
	</div>

	<!-- Bottom: input panel (left) + edge review (right) -->
	<div class="bottom-bar">
		<InputPanel />
		<div class="review-wrapper">
			<NodeDetailPanel />
			<EdgeReviewPanel />
		</div>
	</div>
</div>

{#if $isLoading}
	<div class="loading-overlay">Loading graph…</div>
{/if}

<style>
	.hud {
		position: fixed;
		inset: 0;
		pointer-events: none;
		display: flex;
		flex-direction: column;
		justify-content: space-between;
		padding: 20px;
		z-index: 10;
	}
	.hud > * {
		pointer-events: auto;
	}
	.top-bar {
		display: flex;
		align-items: center;
		gap: 14px;
	}
	.status-indicators {
		display: flex;
		align-items: center;
		gap: 8px;
	}
	.ollama-dot {
		width: 8px;
		height: 8px;
		border-radius: 50%;
		background: rgba(255, 255, 255, 0.25);
		display: inline-block;
		transition: background 0.3s;
	}
	.ollama-dot.online {
		background: #44ff88;
		box-shadow: 0 0 6px #44ff88;
	}
	.ollama-dot.offline {
		background: #ff4444;
	}
	.count-label {
		font-size: 12px;
		color: rgba(255, 255, 255, 0.35);
	}
	.bottom-bar {
		display: flex;
		justify-content: space-between;
		align-items: flex-end;
	}
	.review-wrapper {
		position: relative;
	}
	.loading-overlay {
		position: fixed;
		inset: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		background: rgba(0, 0, 0, 0.6);
		color: rgba(255, 255, 255, 0.6);
		font-size: 14px;
		z-index: 100;
		pointer-events: none;
	}
</style>
