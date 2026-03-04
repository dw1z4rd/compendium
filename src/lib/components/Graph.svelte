<script lang="ts">
	import { Canvas, T, useTask } from '@threlte/core';
	import { OrbitControls } from '@threlte/extras';
	import { forceSimulation, forceLink, forceManyBody, forceCenter } from 'd3-force-3d';
	import type { SimNode, SimLink } from 'd3-force-3d';
	import { nodes, edges, filteredNodeIds, selectedNodeId } from '$lib/graph-store';
	import type { CompendiumEdge, GraphNode } from '$lib/types';
	import GraphNodeComponent from './GraphNode.svelte';
	import GraphEdgeComponent from './GraphEdge.svelte';

	// ─── Force-directed layout ──────────────────────────────────────────────────

	// These are plain objects that d3-force mutates in place.
	// We map from them back to GraphNode data each render.
	type FNode = SimNode & { id: string };
	type FLink = SimLink<FNode>;

	let simNodes: FNode[] = $state([]);
	let simLinks: FLink[] = $state([]);
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	let simulation: ReturnType<typeof forceSimulation<FNode>> | null = null;

	// Rebuild simulation when graph data changes
	$effect(() => {
		const currentNodes = $nodes;
		const currentEdges = $edges;

		// Preserve existing positions to avoid re-layout on data refresh
		const posMap = new Map(simNodes.map((n) => [n.id, { x: n.x, y: n.y, z: n.z }]));

		simNodes = currentNodes.map((n) => ({
			id: n.id,
			x: posMap.get(n.id)?.x ?? (Math.random() - 0.5) * 120,
			y: posMap.get(n.id)?.y ?? (Math.random() - 0.5) * 120,
			z: posMap.get(n.id)?.z ?? (Math.random() - 0.5) * 120,
			vx: 0,
			vy: 0,
			vz: 0
		}));

		simLinks = currentEdges
			.filter((e) => e.status !== 'rejected')
			.map((e) => ({ source: e.from_node, target: e.to_node }));

		simulation?.stop();

		simulation = forceSimulation<FNode>(simNodes)
			.numDimensions(3)
			.force(
				'link',
				forceLink<FNode, FLink>(simLinks)
					.id((d) => d.id)
					.distance(45)
					.strength(0.4)
			)
			.force('charge', forceManyBody<FNode>().strength(-90).distanceMax(300))
			.force('center', forceCenter<FNode>(0, 0, 0).strength(0.05))
			.alphaDecay(0.015)
			.stop();
	});

	// Tick the simulation inside Threlte's render loop
	useTask(() => {
		if (simulation && simulation.alpha() > simulation.alphaMin()) {
			simulation.tick();
		}
	});

	// ─── Connection count ───────────────────────────────────────────────────────

	let connectionCounts = $derived(
		new Map(
			$nodes.map((n) => [
				n.id,
				$edges.filter(
					(e) => (e.from_node === n.id || e.to_node === n.id) && e.status !== 'rejected'
				).length
			])
		)
	);

	// ─── Node lookup for edge rendering ────────────────────────────────────────

	let nodePositionMap = $derived(new Map(simNodes.map((n) => [n.id, n])));

	function getGraphNode(nodeId: string): GraphNode | null {
		const base = $nodes.find((n) => n.id === nodeId);
		const pos = nodePositionMap.get(nodeId);
		if (!base || !pos) return null;
		return {
			...base,
			x: pos.x ?? 0,
			y: pos.y ?? 0,
			z: pos.z ?? 0,
			vx: pos.vx ?? 0,
			vy: pos.vy ?? 0,
			vz: pos.vz ?? 0,
			connectionCount: connectionCounts.get(nodeId) ?? 0
		};
	}
</script>

<div class="graph-container">
	<Canvas>
		<T.PerspectiveCamera makeDefault position={[0, 0, 280]} fov={55}>
			<OrbitControls enableDamping dampingFactor={0.08} />
		</T.PerspectiveCamera>

		<T.AmbientLight intensity={0.5} />
		<T.DirectionalLight position={[60, 80, 60]} intensity={0.9} />
		<T.PointLight position={[-80, -60, -80]} intensity={0.4} color="#4466ff" />

		<!-- Nodes -->
		{#each simNodes as simNode (simNode.id)}
			{@const base = $nodes.find((n) => n.id === simNode.id)}
			{#if base}
				{@const graphNode: GraphNode = {
					...base,
					x: simNode.x ?? 0,
					y: simNode.y ?? 0,
					z: simNode.z ?? 0,
					vx: simNode.vx ?? 0,
					vy: simNode.vy ?? 0,
					vz: simNode.vz ?? 0,
					connectionCount: connectionCounts.get(base.id) ?? 0
				}}
				<GraphNodeComponent
					node={graphNode}
					dimmed={$filteredNodeIds !== null && !$filteredNodeIds.has(base.id)}
					onclick={(n) => selectedNodeId.set(n.id)}
				/>
			{/if}
		{/each}

		<!-- Edges -->
		{#each $edges as edge (edge.id)}
			{@const fromNode = getGraphNode(edge.from_node)}
			{@const toNode = getGraphNode(edge.to_node)}
			{#if fromNode && toNode}
				<GraphEdgeComponent
					from={fromNode}
					to={toNode}
					{edge}
					dimmed={$filteredNodeIds !== null &&
						(!$filteredNodeIds.has(edge.from_node) || !$filteredNodeIds.has(edge.to_node))}
				/>
			{/if}
		{/each}
	</Canvas>
</div>

<style>
	.graph-container {
		width: 100%;
		height: 100%;
		position: absolute;
		inset: 0;
	}
</style>
