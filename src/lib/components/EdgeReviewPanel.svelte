<script lang="ts">
	import { edges, nodes, pendingEdgeCount, upsertEdge } from '$lib/graph-store';
	import type { CompendiumEdge, CompendiumNode } from '$lib/types';
	import { RELATION_CATEGORIES } from '$lib/types';

	let isOpen = $state(false);
	let annotating = $state<string | null>(null);
	let annotationText = $state('');

	let proposedEdges = $derived($edges.filter((e) => e.status === 'proposed'));

	function nodeById(id: string): CompendiumNode | undefined {
		return $nodes.find((n) => n.id === id);
	}

	async function setStatus(edge: CompendiumEdge, status: 'accepted' | 'rejected', annotation?: string) {
		const res = await fetch(`/api/edges/${edge.id.split(':')[1]}`, {
			method: 'PATCH',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ status, ...(annotation ? { annotation } : {}) })
		});
		if (res.ok) {
			const updated = await res.json();
			upsertEdge(updated);
		}
		annotating = null;
		annotationText = '';
	}

	function startAnnotate(edgeId: string) {
		annotating = edgeId;
		annotationText = '';
	}

	async function submitAnnotation(edge: CompendiumEdge) {
		await setStatus(edge, 'rejected', annotationText);
	}

	const CATEGORY_COLORS: Record<string, string> = {
		logical: '#88aaff',
		taxonomic: '#aa88ff',
		causal: '#ff8866',
		experiential: '#44ffcc',
		generative: '#ffee44'
	};
</script>

<!-- Badge button -->
<button
	class="badge-btn"
	onclick={() => (isOpen = !isOpen)}
	class:has-pending={$pendingEdgeCount > 0}
>
	Review {#if $pendingEdgeCount > 0}<span class="badge">{$pendingEdgeCount}</span>{/if}
</button>

{#if isOpen}
	<div class="panel">
		<header>
			<span>Edge Review Queue</span>
			<button class="close" onclick={() => (isOpen = false)}>✕</button>
		</header>

		<div class="list">
			{#if proposedEdges.length === 0}
				<p class="empty">No proposed edges. Process some nodes to generate connections.</p>
			{:else}
				{#each proposedEdges as edge (edge.id)}
					{@const from = nodeById(edge.from_node)}
					{@const to = nodeById(edge.to_node)}
					{@const cat = RELATION_CATEGORIES[edge.relation]}
					<div class="edge-card">
						<div class="nodes-row">
							<span class="node-label" title={from?.content}
								>{from?.content.slice(0, 40) ?? edge.from_node}…</span
							>
							<span
								class="relation-pill"
								style:background={CATEGORY_COLORS[cat] + '22'}
								style:color={CATEGORY_COLORS[cat]}
							>
								{edge.relation.replace(/_/g, ' ')}
							</span>
							<span class="node-label" title={to?.content}
								>{to?.content.slice(0, 40) ?? edge.to_node}…</span
							>
						</div>

						<p class="reasoning">{edge.reasoning}</p>

						{#if annotating === edge.id}
							<div class="annotate-row">
								<input
									type="text"
									placeholder="Why do you disagree?"
									bind:value={annotationText}
									autofocus
								/>
								<button class="btn-reject" onclick={() => submitAnnotation(edge)}>Reject</button>
								<button class="btn-cancel" onclick={() => (annotating = null)}>Cancel</button>
							</div>
						{:else}
							<div class="actions">
								<button class="btn-accept" onclick={() => setStatus(edge, 'accepted')}
									>✓ Accept</button
								>
								<button class="btn-annotate" onclick={() => startAnnotate(edge.id)}
									>✎ Reject + Note</button
								>
								<button class="btn-reject-plain" onclick={() => setStatus(edge, 'rejected')}
									>✕ Reject</button
								>
							</div>
						{/if}
					</div>
				{/each}
			{/if}
		</div>
	</div>
{/if}

<style>
	.badge-btn {
		background: rgba(255, 255, 255, 0.06);
		border: 1px solid rgba(255, 255, 255, 0.12);
		border-radius: 10px;
		color: rgba(255, 255, 255, 0.7);
		padding: 8px 16px;
		cursor: pointer;
		font-size: 13px;
		display: flex;
		align-items: center;
		gap: 6px;
		backdrop-filter: blur(12px);
	}
	.badge-btn.has-pending {
		border-color: rgba(255, 136, 68, 0.5);
		color: #ff8844;
	}
	.badge {
		background: #ff8844;
		color: #000;
		border-radius: 20px;
		padding: 1px 7px;
		font-size: 11px;
		font-weight: 700;
	}
	.panel {
		position: absolute;
		bottom: 60px;
		right: 0;
		width: 420px;
		max-height: 60vh;
		background: rgba(10, 10, 20, 0.92);
		border: 1px solid rgba(255, 255, 255, 0.1);
		border-radius: 14px;
		backdrop-filter: blur(16px);
		display: flex;
		flex-direction: column;
		overflow: hidden;
	}
	header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 14px 16px;
		border-bottom: 1px solid rgba(255, 255, 255, 0.07);
		font-size: 13px;
		font-weight: 600;
		color: rgba(255, 255, 255, 0.8);
	}
	.close {
		background: none;
		border: none;
		color: rgba(255, 255, 255, 0.4);
		cursor: pointer;
		font-size: 14px;
	}
	.list {
		overflow-y: auto;
		padding: 12px;
		display: flex;
		flex-direction: column;
		gap: 10px;
	}
	.empty {
		color: rgba(255, 255, 255, 0.35);
		font-size: 13px;
		text-align: center;
		padding: 24px 0;
	}
	.edge-card {
		background: rgba(255, 255, 255, 0.04);
		border: 1px solid rgba(255, 255, 255, 0.07);
		border-radius: 10px;
		padding: 12px;
		display: flex;
		flex-direction: column;
		gap: 8px;
	}
	.nodes-row {
		display: flex;
		align-items: center;
		gap: 6px;
		flex-wrap: wrap;
	}
	.node-label {
		font-size: 12px;
		color: rgba(255, 255, 255, 0.7);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		max-width: 120px;
	}
	.relation-pill {
		font-size: 11px;
		font-weight: 600;
		padding: 2px 8px;
		border-radius: 20px;
		white-space: nowrap;
	}
	.reasoning {
		font-size: 12px;
		color: rgba(255, 255, 255, 0.5);
		line-height: 1.5;
		margin: 0;
	}
	.actions {
		display: flex;
		gap: 6px;
	}
	button {
		border-radius: 6px;
		padding: 5px 10px;
		font-size: 12px;
		cursor: pointer;
		border: none;
	}
	.btn-accept {
		background: rgba(68, 255, 136, 0.15);
		color: #44ff88;
	}
	.btn-reject-plain {
		background: rgba(255, 68, 68, 0.15);
		color: #ff4444;
	}
	.btn-annotate {
		background: rgba(255, 255, 255, 0.08);
		color: rgba(255, 255, 255, 0.6);
	}
	.annotate-row {
		display: flex;
		gap: 6px;
	}
	.annotate-row input {
		flex: 1;
		background: rgba(255, 255, 255, 0.06);
		border: 1px solid rgba(255, 255, 255, 0.15);
		border-radius: 6px;
		padding: 5px 10px;
		color: #fff;
		font-size: 12px;
		outline: none;
	}
	.btn-reject {
		background: rgba(255, 68, 68, 0.15);
		color: #ff4444;
	}
	.btn-cancel {
		background: rgba(255, 255, 255, 0.08);
		color: rgba(255, 255, 255, 0.5);
	}
</style>
