<script lang="ts">
	import { T, useTask } from '@threlte/core';
	import type { GraphNode } from '$lib/types';

	interface Props {
		node: GraphNode;
		/** True when search is active and this node doesn't match */
		dimmed: boolean;
		onclick?: (node: GraphNode) => void;
	}
	let { node, dimmed, onclick }: Props = $props();

	// ─── Visual encoding ────────────────────────────────────────────────────────

	const TYPE_COLORS: Record<string, string> = {
		thought: '#4488ff',
		belief: '#ff8844',
		image: '#44ff88',
		memory: '#aa44ff',
		conversation: '#ff4444'
	};

	let color = $derived(TYPE_COLORS[node.type] ?? '#aaaaaa');
	let baseRadius = $derived(Math.max(2.5, Math.sqrt(node.connectionCount ?? 0) * 1.8 + 3));

	// pending = dim + pulse; filtered-out = very dim; processed = full opacity
	let targetOpacity = $derived(dimmed ? 0.08 : node.status === 'pending' ? 0.35 : 1.0);

	// ─── Pulse animation for pending nodes ─────────────────────────────────────

	let pulseScale = $state(1);
	let animOpacity = $state(1);
	let t = 0;

	useTask((delta) => {
		if (node.status !== 'pending') {
			pulseScale = 1;
			animOpacity = targetOpacity;
			return;
		}
		t += delta;
		pulseScale = 1 + 0.12 * Math.sin(t * 3);
		animOpacity = targetOpacity + 0.12 * Math.sin(t * 3 + Math.PI / 4);
	});
</script>

<T.Mesh
	position={[node.x ?? 0, node.y ?? 0, node.z ?? 0]}
	scale={pulseScale}
	onclick={() => onclick?.(node)}
>
	<T.SphereGeometry args={[baseRadius, 16, 12]} />
	<T.MeshStandardMaterial
		{color}
		transparent
		opacity={animOpacity}
		emissive={node.status === 'pending' ? color : '#000000'}
		emissiveIntensity={node.status === 'pending' ? 0.25 : 0}
		roughness={0.4}
		metalness={0.1}
	/>
</T.Mesh>
