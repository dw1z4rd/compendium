<script lang="ts">
	import { nodes, edges, selectedNodeId } from '$lib/graph-store';

	let node = $derived($nodes.find((n) => n.id === $selectedNodeId) ?? null);
	let nodeEdges = $derived(
		$edges.filter(
			(e) => (e.from_node === $selectedNodeId || e.to_node === $selectedNodeId) && e.status !== 'rejected'
		)
	);

	function getOtherNode(edge: typeof nodeEdges[0]) {
		const otherId = edge.from_node === $selectedNodeId ? edge.to_node : edge.from_node;
		return $nodes.find((n) => n.id === otherId);
	}

	function direction(edge: typeof nodeEdges[0]) {
		return edge.from_node === $selectedNodeId ? '→' : '←';
	}
</script>

{#if node}
	<div class="panel">
		<div class="header">
			<span class="type-badge" data-type={node.type}>{node.type}</span>
			<button class="close" onclick={() => selectedNodeId.set(null)}>✕</button>
		</div>

		<p class="content">{node.content}</p>

		{#if node.components.length}
			<div class="components">
				{#each node.components as c}
					<span class="chip">{c}</span>
				{/each}
			</div>
		{/if}

		{#if nodeEdges.length}
			<div class="edges-section">
				<p class="edges-label">Connections</p>
				{#each nodeEdges as edge}
					{@const other = getOtherNode(edge)}
					<div class="edge-row">
						<span class="dir">{direction(edge)}</span>
						<span class="relation">{edge.relation}</span>
						<span class="other">{other?.content.slice(0, 60) ?? '?'}{(other?.content.length ?? 0) > 60 ? '…' : ''}</span>
					</div>
				{/each}
			</div>
		{/if}
	</div>
{/if}

<style>
	.panel {
		background: rgba(10, 10, 20, 0.92);
		border: 1px solid rgba(255, 255, 255, 0.1);
		border-radius: 14px;
		padding: 16px;
		width: 300px;
		max-height: 70vh;
		overflow-y: auto;
		display: flex;
		flex-direction: column;
		gap: 12px;
		backdrop-filter: blur(16px);
	}
	.header {
		display: flex;
		justify-content: space-between;
		align-items: center;
	}
	.type-badge {
		font-size: 11px;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		padding: 3px 8px;
		border-radius: 20px;
		background: rgba(255, 255, 255, 0.08);
		color: rgba(255, 255, 255, 0.5);
	}
	.type-badge[data-type="thought"] { color: #4488ff; background: rgba(68,136,255,0.15); }
	.type-badge[data-type="belief"]  { color: #ff8844; background: rgba(255,136,68,0.15); }
	.type-badge[data-type="memory"]  { color: #aa44ff; background: rgba(170,68,255,0.15); }
	.type-badge[data-type="conversation"] { color: #ff4444; background: rgba(255,68,68,0.15); }
	.type-badge[data-type="image"]   { color: #44ff88; background: rgba(68,255,136,0.15); }
	.close {
		background: none;
		border: none;
		color: rgba(255,255,255,0.3);
		cursor: pointer;
		font-size: 14px;
		padding: 2px 6px;
	}
	.close:hover { color: rgba(255,255,255,0.7); }
	.content {
		font-size: 14px;
		color: rgba(255,255,255,0.85);
		line-height: 1.6;
		margin: 0;
	}
	.components {
		display: flex;
		flex-wrap: wrap;
		gap: 5px;
	}
	.chip {
		font-size: 11px;
		color: rgba(255,255,255,0.4);
		background: rgba(255,255,255,0.06);
		border-radius: 12px;
		padding: 2px 8px;
	}
	.edges-section {
		display: flex;
		flex-direction: column;
		gap: 6px;
	}
	.edges-label {
		font-size: 11px;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		color: rgba(255,255,255,0.25);
		margin: 0;
	}
	.edge-row {
		display: grid;
		grid-template-columns: 16px auto 1fr;
		gap: 6px;
		align-items: start;
		font-size: 12px;
	}
.dir { color: rgba(255,255,255,0.3); }
	.relation {
		color: #4488ff;
		font-style: italic;
		white-space: nowrap;
	}
	.other { color: rgba(255,255,255,0.6); }
</style>
