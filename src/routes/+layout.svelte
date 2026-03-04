<script lang="ts">
	let { children } = $props();
</script>

<svelte:head>
	<title>Compendium</title>
</svelte:head>

{@render children()}

<style>
	:global(*) {
		box-sizing: border-box;
	}
	:global(body) {
		margin: 0;
		font-family:
			-apple-system,
			BlinkMacSystemFont,
			'Segoe UI',
			system-ui,
			sans-serif;
		background: #0a0a0f;
		color: #fff;
		overflow: hidden;
	}
</style>
