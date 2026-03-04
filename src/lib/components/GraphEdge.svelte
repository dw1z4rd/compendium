<script lang="ts">
	import { T } from '@threlte/core';
	import * as THREE from 'three';
	import type { CompendiumEdge, GraphNode } from '$lib/types';
	import { RELATION_CATEGORIES } from '$lib/types';

	interface Props {
		from: GraphNode;
		to: GraphNode;
		edge: CompendiumEdge;
		dimmed: boolean;
	}
	let { from, to, edge, dimmed }: Props = $props();

	// ─── Visual encoding ────────────────────────────────────────────────────────

	const CATEGORY_COLORS: Record<string, string> = {
		logical: '#88aaff',
		taxonomic: '#aa88ff',
		causal: '#ff8866',
		experiential: '#44ffcc',
		generative: '#ffee44'
	};

	let category = $derived(RELATION_CATEGORIES[edge.relation] ?? 'logical');
	let color = $derived(CATEGORY_COLORS[category] ?? '#ffffff');
	let opacity = $derived(
		dimmed ? 0.03 : edge.status === 'accepted' ? 0.7 : edge.status === 'rejected' ? 0.1 : 0.3
	);

	// ─── Dynamic line geometry ──────────────────────────────────────────────────
	// Use a BufferGeometry with DynamicDrawUsage so positions update every frame
	// without reallocating geometry.

	const positions = new Float32Array(6); // [x0,y0,z0, x1,y1,z1]
	const geometry = new THREE.BufferGeometry();
	const posAttr = new THREE.Float32BufferAttribute(positions, 3);
	posAttr.setUsage(THREE.DynamicDrawUsage);
	geometry.setAttribute('position', posAttr);

	$effect(() => {
		posAttr.setXYZ(0, from.x ?? 0, from.y ?? 0, from.z ?? 0);
		posAttr.setXYZ(1, to.x ?? 0, to.y ?? 0, to.z ?? 0);
		posAttr.needsUpdate = true;
		geometry.computeBoundingSphere();
		return () => geometry.dispose();
	});
</script>

<T is={THREE.Line} {geometry}>
	<T.LineBasicMaterial {color} transparent {opacity} linewidth={1} />
</T>
