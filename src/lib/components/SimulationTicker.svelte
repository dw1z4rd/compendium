<script lang="ts">
	import { useTask } from '@threlte/core';

	type Simulation = { alpha(): number; alphaMin(): number; tick(): void } | null;
	let { getSimulation }: { getSimulation: () => Simulation } = $props();

	useTask(() => {
		const sim = getSimulation();
		if (sim && sim.alpha() > sim.alphaMin()) {
			sim.tick();
		}
	});
</script>
