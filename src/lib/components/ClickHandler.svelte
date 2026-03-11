<script lang="ts">
	import { useThrelte } from '@threlte/core';
	import { onMount } from 'svelte';
	import { Vector2, Raycaster, Vector3 } from 'three';

	type FNode = { id: string; x?: number; y?: number; z?: number };
	let { simNodes, onNodeClick }: { simNodes: FNode[]; onNodeClick: (id: string) => void } = $props();

	const { camera, renderer } = useThrelte();

	function handleClick(event: MouseEvent) {
		const canvas = renderer.domElement;
		const rect = canvas.getBoundingClientRect();
		const mouse = new Vector2(
			((event.clientX - rect.left) / rect.width) * 2 - 1,
			-((event.clientY - rect.top) / rect.height) * 2 + 1
		);

		const raycaster = new Raycaster();
		raycaster.setFromCamera(mouse, camera.current);
		const ray = raycaster.ray;

		let closestId: string | null = null;
		let closestDist = Infinity;

		for (const node of simNodes) {
			const pos = new Vector3(node.x ?? 0, node.y ?? 0, node.z ?? 0);
			const dist = ray.distanceToPoint(pos);
			if (dist < 6 && dist < closestDist) {
				closestDist = dist;
				closestId = node.id;
			}
		}
		if (closestId) onNodeClick(closestId);
	}

	onMount(() => {
		const target = renderer.domElement.parentElement ?? renderer.domElement;
		target.addEventListener('click', handleClick);
		return () => target.removeEventListener('click', handleClick);
	});
</script>
