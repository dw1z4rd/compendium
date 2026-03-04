<script lang="ts">
	import { searchQuery, filteredNodeIds } from '$lib/graph-store';

	let inputValue = $state('');
	let debounceTimer: ReturnType<typeof setTimeout>;

	function onInput(e: Event) {
		inputValue = (e.target as HTMLInputElement).value;
		clearTimeout(debounceTimer);
		debounceTimer = setTimeout(() => {
			searchQuery.set(inputValue);
		}, 200);
	}

	function clear() {
		inputValue = '';
		searchQuery.set('');
	}

	let matchCount = $derived($filteredNodeIds?.size ?? null);
</script>

<div class="search-bar">
	<span class="icon">⌕</span>
	<input
		type="text"
		placeholder="Search nodes…"
		value={inputValue}
		oninput={onInput}
		class:active={inputValue.length > 0}
	/>
	{#if inputValue}
		<span class="count">{matchCount ?? '—'}</span>
		<button class="clear" onclick={clear} aria-label="Clear search">✕</button>
	{/if}
</div>

<style>
	.search-bar {
		display: flex;
		align-items: center;
		gap: 8px;
		background: rgba(255, 255, 255, 0.06);
		border: 1px solid rgba(255, 255, 255, 0.12);
		border-radius: 10px;
		padding: 8px 14px;
		backdrop-filter: blur(12px);
		width: 320px;
	}
	.icon {
		color: rgba(255, 255, 255, 0.4);
		font-size: 18px;
		line-height: 1;
	}
	input {
		flex: 1;
		background: none;
		border: none;
		outline: none;
		color: #fff;
		font-size: 14px;
		font-family: inherit;
	}
	input::placeholder {
		color: rgba(255, 255, 255, 0.3);
	}
	.count {
		font-size: 12px;
		color: rgba(255, 255, 255, 0.4);
	}
	.clear {
		background: none;
		border: none;
		color: rgba(255, 255, 255, 0.4);
		cursor: pointer;
		font-size: 12px;
		padding: 0;
		line-height: 1;
	}
	.clear:hover {
		color: #fff;
	}
</style>
