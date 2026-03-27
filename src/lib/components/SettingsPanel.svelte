<script lang="ts">
	import { cloudConfigured } from '$lib/graph-store';

	let isOpen = $state(false);

	type CloudModel = { key: string; name: string; color: string; group: 'ollama-cloud' | 'gemini' };

	let localModels = $state<string[]>([]);
	let cloudModels = $state<CloudModel[]>([]);
	let textModel = $state('');
	let visionModel = $state('');
	let embedModel = $state('');
	let loading = $state(false);
	let saving = $state(false);
	let loadError = $state('');

	async function open() {
		isOpen = true;
		loading = true;
		loadError = '';
		try {
			const [settingsRes, modelsRes] = await Promise.all([
				fetch('/api/settings'),
				fetch('/api/ollama/models')
			]);
			if (settingsRes.ok) {
				const s = await settingsRes.json();
				textModel = s.text_model;
				visionModel = s.vision_model;
				embedModel = s.embed_model;
			} else {
				loadError = 'Could not load current settings.';
				textModel = 'llama3.2';
				visionModel = 'llava';
				embedModel = 'nomic-embed-text';
			}
			if (modelsRes.ok) {
				const m = await modelsRes.json();
				localModels = m.local ?? [];
				cloudModels = m.cloud ?? [];
			}
		} catch {
			loadError = 'Failed to load settings.';
			textModel = 'llama3.2';
			visionModel = 'llava';
			embedModel = 'nomic-embed-text';
		} finally {
			loading = false;
		}
	}

	function close() {
		isOpen = false;
	}

	async function save() {
		saving = true;
		try {
			const res = await fetch('/api/settings', {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ text_model: textModel, vision_model: visionModel, embed_model: embedModel })
			});
			if (res.ok) {
				const s = await res.json();
				cloudConfigured.set(s.cloud_configured ?? false);
				close();
			} else {
				loadError = 'Save failed — check console.';
			}
		} catch {
			loadError = 'Save failed — network error.';
		} finally {
			saving = false;
		}
	}

	function cloudByGroup(group: 'ollama-cloud' | 'gemini') {
		return cloudModels.filter((m) => m.group === group);
	}
</script>

<button class="gear-btn" onclick={open} title="Model settings" aria-label="Open model settings">⚙</button>

{#if isOpen}
	<div class="backdrop" onclick={close} role="presentation"></div>

	<div class="modal" role="dialog" aria-modal="true" aria-label="Model settings">
		<header>
			<span>Model Settings</span>
			<button class="close-btn" onclick={close} aria-label="Close model settings">✕</button>
		</header>

		{#if loadError}
			<p class="error">{loadError}</p>
		{/if}

		<div class="fields">
			<label>
				<span class="field-label">Text Model</span>
				<select bind:value={textModel} disabled={loading || saving}>
					{#if loading}
						<option disabled>Loading…</option>
					{:else}
						{#if localModels.length}
							<optgroup label="Local">
								{#each localModels as m}
									<option value={m}>{m}</option>
								{/each}
							</optgroup>
						{/if}
						{#if cloudByGroup('ollama-cloud').length}
							<optgroup label="Ollama Cloud">
								{#each cloudByGroup('ollama-cloud') as m}
									<option value={m.key}>{m.name}</option>
								{/each}
							</optgroup>
						{/if}
						{#if cloudByGroup('gemini').length}
							<optgroup label="Gemini">
								{#each cloudByGroup('gemini') as m}
									<option value={m.key}>{m.name}</option>
								{/each}
							</optgroup>
						{/if}
					{/if}
				</select>
			</label>

			<label>
				<span class="field-label">Vision Model <span class="local-only">(local only)</span></span>
				<select bind:value={visionModel} disabled={loading || saving}>
					{#if loading}
						<option disabled>Loading…</option>
					{:else if localModels.length === 0}
						<option disabled>No local models found</option>
					{:else}
						{#each localModels as m}
							<option value={m}>{m}</option>
						{/each}
					{/if}
				</select>
			</label>

			<label>
				<span class="field-label">Embed Model <span class="local-only">(local only)</span></span>
				<select bind:value={embedModel} disabled={loading || saving}>
					{#if loading}
						<option disabled>Loading…</option>
					{:else if localModels.length === 0}
						<option disabled>No local models found</option>
					{:else}
						{#each localModels as m}
							<option value={m}>{m}</option>
						{/each}
					{/if}
				</select>
			</label>
		</div>

		<div class="actions">
			<button class="btn-cancel" onclick={close} disabled={saving}>Cancel</button>
			<button class="btn-save" onclick={save} disabled={loading || saving}>
				{saving ? 'Saving…' : 'Save'}
			</button>
		</div>
	</div>
{/if}

<style>
	.gear-btn {
		background: rgba(255, 255, 255, 0.06);
		border: 1px solid rgba(255, 255, 255, 0.12);
		border-radius: 8px;
		color: rgba(255, 255, 255, 0.5);
		padding: 6px 10px;
		cursor: pointer;
		font-size: 16px;
		line-height: 1;
		transition: color 0.2s, background 0.2s;
	}
	.gear-btn:hover {
		color: rgba(255, 255, 255, 0.85);
		background: rgba(255, 255, 255, 0.1);
	}
	.backdrop {
		position: fixed;
		inset: 0;
		z-index: 50;
	}
	.modal {
		position: fixed;
		top: 50%;
		left: 50%;
		transform: translate(-50%, -50%);
		z-index: 51;
		width: 380px;
		background: rgba(10, 10, 20, 0.96);
		border: 1px solid rgba(255, 255, 255, 0.12);
		border-radius: 14px;
		backdrop-filter: blur(20px);
		padding: 20px;
		display: flex;
		flex-direction: column;
		gap: 16px;
	}
	header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		font-size: 14px;
		font-weight: 600;
		color: rgba(255, 255, 255, 0.85);
	}
	.close-btn {
		background: none;
		border: none;
		color: rgba(255, 255, 255, 0.4);
		cursor: pointer;
		font-size: 14px;
		padding: 2px 6px;
	}
	.close-btn:hover { color: rgba(255, 255, 255, 0.7); }
	.error {
		font-size: 12px;
		color: #ff6666;
		margin: 0;
		padding: 8px;
		background: rgba(255, 68, 68, 0.1);
		border-radius: 6px;
	}
	.fields {
		display: flex;
		flex-direction: column;
		gap: 12px;
	}
	label {
		display: flex;
		flex-direction: column;
		gap: 5px;
	}
	.field-label {
		font-size: 11px;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		color: rgba(255, 255, 255, 0.35);
	}
	.local-only {
		font-size: 10px;
		text-transform: none;
		letter-spacing: 0;
		color: rgba(255, 255, 255, 0.2);
	}
	select {
		background: #1a1a2e;
		border: 1px solid rgba(255, 255, 255, 0.12);
		border-radius: 8px;
		color: #dde;
		padding: 8px 10px;
		font-size: 13px;
		cursor: pointer;
		outline: none;
	}
	select option, select optgroup {
		background: #1a1a2e;
		color: #dde;
	}
	select:focus { border-color: rgba(68, 136, 255, 0.5); }
	select:disabled { opacity: 0.4; cursor: not-allowed; }
	.actions {
		display: flex;
		justify-content: flex-end;
		gap: 8px;
	}
	.btn-cancel {
		background: rgba(255, 255, 255, 0.06);
		border: 1px solid rgba(255, 255, 255, 0.1);
		border-radius: 8px;
		color: rgba(255, 255, 255, 0.5);
		padding: 8px 16px;
		font-size: 13px;
		cursor: pointer;
	}
	.btn-save {
		background: rgba(68, 136, 255, 0.2);
		border: 1px solid rgba(68, 136, 255, 0.4);
		border-radius: 8px;
		color: #4488ff;
		padding: 8px 16px;
		font-size: 13px;
		font-weight: 600;
		cursor: pointer;
	}
	.btn-save:disabled, .btn-cancel:disabled { opacity: 0.4; cursor: not-allowed; }
</style>
