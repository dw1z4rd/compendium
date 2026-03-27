<script lang="ts">
	import { nodes, edges, upsertNode, upsertEdge, ollamaAvailable, cloudConfigured } from '$lib/graph-store';
	import type { CompendiumNode, CompendiumEdge, GraphNode, NodeType, NodeSource } from '$lib/types';

	// ─── State ──────────────────────────────────────────────────────────────────

	let activeTab = $state<'text' | 'voice' | 'image' | 'import'>('text');
	let textContent = $state('');
	let nodeType = $state<NodeType>('thought');
	let isSubmitting = $state(false);
	let statusMsg = $state('');

	// Voice
	let isRecording = $state(false);
	let mediaRecorder: MediaRecorder | null = null;
	let audioChunks: Blob[] = [];

	// Image
	let imageFile = $state<File | null>(null);
	let imagePreviewUrl = $state('');

	// Import (conversation paste)
	let importText = $state('');

	// ─── Helpers ─────────────────────────────────────────────────────────────────

	function toGraphNode(n: CompendiumNode): GraphNode {
		return { ...n, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, connectionCount: 0 };
	}

	async function saveAndProcess(content: string, source: NodeSource, raw_media?: string) {
		isSubmitting = true;
		statusMsg = 'Saving…';

		try {
			// 1. Create pending node
			const createRes = await fetch('/api/nodes', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ type: nodeType, content, source, raw_media })
			});
			if (!createRes.ok) throw new Error('Failed to create node');
			const newNode: CompendiumNode = await createRes.json();
			upsertNode(toGraphNode(newNode));

			// 2. Extract node ID from SurrealDB format "node:abc"
			const rawId = newNode.id.toString();
			const shortId = rawId.includes(':') ? rawId.split(':')[1] : rawId;

			// 3. Process if any provider is available
			if ($ollamaAvailable || $cloudConfigured) {
				// Use cloudConfigured (not ollamaAvailable) for the message:
				// when a cloud model is selected, the backend routes to it regardless of Ollama status.
				statusMsg = $cloudConfigured ? 'Processing with cloud model…' : 'Processing with Ollama…';
				const procRes = await fetch(`/api/nodes/${shortId}/process`, { method: 'POST' });
				if (procRes.ok) {
					const { node: processed, edgesProposed } = await procRes.json();
					upsertNode(toGraphNode(processed));

					// Reload edges
					const edgeRes = await fetch('/api/edges');
					if (edgeRes.ok) {
						const allEdges: CompendiumEdge[] = await edgeRes.json();
						allEdges.forEach(upsertEdge);
					}

					statusMsg = `Done — ${edgesProposed} edge${edgesProposed !== 1 ? 's' : ''} proposed`;
				} else {
					statusMsg = 'Processing failed — node saved as pending';
				}
			} else {
				statusMsg = 'No processor available — node saved as pending';
			}
		} catch (e) {
			statusMsg = `Error: ${e instanceof Error ? e.message : String(e)}`;
		} finally {
			isSubmitting = false;
			setTimeout(() => (statusMsg = ''), 4000);
		}
	}

	// ─── Text submission ──────────────────────────────────────────────────────

	async function submitText() {
		if (!textContent.trim()) return;
		const content = textContent.trim();
		textContent = '';
		await saveAndProcess(content, 'manual');
	}

	// ─── Voice recording ──────────────────────────────────────────────────────

	async function startRecording() {
		try {
			const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
			audioChunks = [];
			mediaRecorder = new MediaRecorder(stream);
			mediaRecorder.ondataavailable = (e) => audioChunks.push(e.data);
			mediaRecorder.onstop = async () => {
				stream.getTracks().forEach((t) => t.stop());
				const blob = new Blob(audioChunks, { type: 'audio/webm' });
				await transcribeAndSubmit(blob);
			};
			mediaRecorder.start();
			isRecording = true;
		} catch {
			statusMsg = 'Microphone access denied';
		}
	}

	function stopRecording() {
		mediaRecorder?.stop();
		isRecording = false;
	}

	async function transcribeAndSubmit(blob: Blob) {
		statusMsg = 'Transcribing…';
		isSubmitting = true;
		try {
			const base64 = await blobToBase64(blob);
			const res = await fetch('/api/transcribe', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ audio: base64 })
			});
			if (res.ok) {
				const { text } = await res.json();
				if (text) await saveAndProcess(text, 'voice');
				else statusMsg = 'Transcription returned empty';
			} else {
				statusMsg = 'Transcription failed';
				isSubmitting = false;
			}
		} catch (e) {
			statusMsg = `Transcription error: ${e instanceof Error ? e.message : String(e)}`;
			isSubmitting = false;
		}
	}

	// ─── Image upload ─────────────────────────────────────────────────────────

	function onImageSelect(e: Event) {
		const file = (e.target as HTMLInputElement).files?.[0];
		if (!file) return;
		imageFile = file;
		imagePreviewUrl = URL.createObjectURL(file);
	}

	async function submitImage() {
		if (!imageFile) return;
		isSubmitting = true;
		statusMsg = 'Reading image…';
		try {
			const base64 = await fileToBase64(imageFile);
			const dataUrl = `data:${imageFile.type};base64,${base64}`;
			nodeType = 'image';
			await saveAndProcess(imageFile.name, 'image', dataUrl);
			imageFile = null;
			imagePreviewUrl = '';
		} catch (e) {
			statusMsg = `Image error: ${e instanceof Error ? e.message : String(e)}`;
			isSubmitting = false;
		}
	}

	// ─── Conversation import ──────────────────────────────────────────────────

	async function submitImport() {
		if (!importText.trim()) return;
		nodeType = 'conversation';
		await saveAndProcess(importText.trim(), 'import');
		importText = '';
	}

	// ─── Markdown file load ──────────────────────────────────────────────────

	function onMdSelect(e: Event) {
		const file = (e.target as HTMLInputElement).files?.[0];
		if (!file) return;
		const reader = new FileReader();
		reader.onload = () => { importText = reader.result as string; };
		reader.readAsText(file);
		(e.target as HTMLInputElement).value = '';
	}

	// ─── Reprocess pending ───────────────────────────────────────────────────

	async function reprocessPending() {
		const pending = $nodes.filter((n) => n.status === 'pending');
		if (!pending.length) { statusMsg = 'No pending nodes'; return; }
		await processNodes(pending);
	}

	async function reanalyseAll() {
		if (!$nodes.length) { statusMsg = 'No nodes'; return; }
		isSubmitting = true;

		// Reset all nodes and edges
		await fetch('/api/nodes/reset-all', { method: 'POST' });

		// Pass 1: build embeddings + components for all nodes (no edge proposals yet)
		const targets = $nodes;
		for (let i = 0; i < targets.length; i++) {
			const n = targets[i];
			const shortId = n.id.includes(':') ? n.id.split(':')[1] : n.id;
			statusMsg = `Pass 1: processing ${i + 1}/${targets.length}…`;
			const res = await fetch(`/api/nodes/${shortId}/process`, { method: 'POST' });
			if (res.ok) {
				const { node: updated } = await res.json();
				upsertNode(toGraphNode(updated));
			}
		}

		// Pass 2: propose edges for all nodes now that everyone has embeddings
		for (let i = 0; i < targets.length; i++) {
			const n = targets[i];
			const shortId = n.id.includes(':') ? n.id.split(':')[1] : n.id;
			statusMsg = `Pass 2: edges ${i + 1}/${targets.length}…`;
			const res = await fetch(`/api/nodes/${shortId}/propose-edges`, { method: 'POST' });
			if (res.ok) {
				const edgeRes = await fetch('/api/edges');
				if (edgeRes.ok) { const allEdges: CompendiumEdge[] = await edgeRes.json(); allEdges.forEach(upsertEdge); }
			}
		}

		statusMsg = 'Done — re-analysis complete';
		isSubmitting = false;
		setTimeout(() => (statusMsg = ''), 5000);
	}

	async function processNodes(targets: typeof $nodes) {
		isSubmitting = true;
		let processed = 0;
		for (const n of targets) {
			const shortId = n.id.includes(':') ? n.id.split(':')[1] : n.id;
			statusMsg = `Processing ${processed + 1}/${targets.length}…`;
			const res = await fetch(`/api/nodes/${shortId}/process`, { method: 'POST' });
			if (res.ok) {
				const { node: updated } = await res.json();
				upsertNode(toGraphNode(updated));
				processed++;
				const edgeRes = await fetch('/api/edges');
				if (edgeRes.ok) { const allEdges: CompendiumEdge[] = await edgeRes.json(); allEdges.forEach(upsertEdge); }
			}
		}
		statusMsg = `Done — ${processed}/${targets.length} nodes processed`;
		isSubmitting = false;
		setTimeout(() => (statusMsg = ''), 5000);
	}

	// ─── Utils ────────────────────────────────────────────────────────────────

	function blobToBase64(blob: Blob): Promise<string> {
		return new Promise((resolve, reject) => {
			const reader = new FileReader();
			reader.onload = () => resolve((reader.result as string).split(',')[1]);
			reader.onerror = reject;
			reader.readAsDataURL(blob);
		});
	}

	function fileToBase64(file: File): Promise<string> {
		return new Promise((resolve, reject) => {
			const reader = new FileReader();
			reader.onload = () => resolve((reader.result as string).split(',')[1]);
			reader.onerror = reject;
			reader.readAsDataURL(file);
		});
	}
</script>

<div class="panel">
	<!-- Tab bar -->
	<div class="tabs">
		{#each ['text', 'voice', 'image', 'import'] as tab}
			<button
				class="tab"
				class:active={activeTab === tab}
				onclick={() => (activeTab = tab as typeof activeTab)}
			>
				{tab === 'text' ? '✏' : tab === 'voice' ? '🎙' : tab === 'image' ? '🖼' : '💬'}
				{tab}
			</button>
		{/each}
	</div>

	<!-- Node type selector (for text + import) -->
	{#if activeTab === 'text' || activeTab === 'import'}
		<div class="type-row">
			{#each ['thought', 'belief', 'memory', 'conversation'] as t}
				<button
					class="type-btn"
					class:active={nodeType === t}
					onclick={() => (nodeType = t as NodeType)}>{t}</button
				>
			{/each}
		</div>
	{/if}

	<!-- Text tab -->
	{#if activeTab === 'text'}
		<textarea
			placeholder="What are you thinking?"
			bind:value={textContent}
			rows={3}
			onkeydown={(e) => e.key === 'Enter' && e.metaKey && submitText()}
		></textarea>
		<button class="submit" disabled={!textContent.trim() || isSubmitting} onclick={submitText}>
			{isSubmitting ? '…' : 'Add node'}
		</button>

		<!-- Voice tab -->
	{:else if activeTab === 'voice'}
		<div class="voice-area">
			<button
				class="record-btn"
				class:recording={isRecording}
				onclick={isRecording ? stopRecording : startRecording}
				disabled={isSubmitting}
			>
				{isRecording ? '⏹ Stop' : '⏺ Record'}
			</button>
			<p class="hint">Records via microphone, transcribed by Whisper via Ollama</p>
		</div>

		<!-- Image tab -->
	{:else if activeTab === 'image'}
		<div class="image-area">
			{#if imagePreviewUrl}
				<img src={imagePreviewUrl} alt="Preview" class="preview" />
				<div class="image-actions">
					<button class="submit" disabled={isSubmitting} onclick={submitImage}>Add image</button>
					<button class="cancel" onclick={() => { imageFile = null; imagePreviewUrl = ''; }}>Clear</button>
				</div>
			{:else}
				<label class="upload-label">
					<input type="file" accept="image/*" onchange={onImageSelect} />
					Drop image or click to upload
				</label>
			{/if}
		</div>

		<!-- Import tab -->
	{:else if activeTab === 'import'}
		<label class="md-upload-label">
			<input type="file" accept=".md,text/markdown" onchange={onMdSelect} />
			Load .md file
		</label>
		<textarea
			placeholder="Paste a conversation, article excerpt, or any text…"
			bind:value={importText}
			rows={5}
		></textarea>
		<button
			class="submit"
			disabled={!importText.trim() || isSubmitting}
			onclick={submitImport}
		>
			{isSubmitting ? '…' : 'Import'}
		</button>
	{/if}

	{#if statusMsg}
		<p class="status">{statusMsg}</p>
	{/if}

	{#if ($ollamaAvailable || $cloudConfigured) && $nodes.some((n) => n.status === 'pending')}
		<button class="reprocess" disabled={isSubmitting} onclick={reprocessPending}>
			Process {$nodes.filter((n) => n.status === 'pending').length} pending
		</button>
	{/if}
	{#if ($ollamaAvailable || $cloudConfigured) && $nodes.length}
		<button class="reanalyse" disabled={isSubmitting} onclick={reanalyseAll}>
			Re-analyse all {$nodes.length} nodes
		</button>
	{/if}
</div>

<style>
	.panel {
		background: rgba(10, 10, 20, 0.88);
		border: 1px solid rgba(255, 255, 255, 0.1);
		border-radius: 14px;
		padding: 14px;
		width: 320px;
		display: flex;
		flex-direction: column;
		gap: 10px;
		backdrop-filter: blur(16px);
	}
	.tabs {
		display: flex;
		gap: 4px;
	}
	.tab {
		flex: 1;
		background: none;
		border: 1px solid rgba(255, 255, 255, 0.08);
		border-radius: 7px;
		color: rgba(255, 255, 255, 0.4);
		padding: 5px 0;
		font-size: 11px;
		cursor: pointer;
		text-transform: capitalize;
	}
	.tab.active {
		background: rgba(68, 136, 255, 0.2);
		border-color: rgba(68, 136, 255, 0.4);
		color: #4488ff;
	}
	.type-row {
		display: flex;
		gap: 4px;
		flex-wrap: wrap;
	}
	.type-btn {
		background: rgba(255, 255, 255, 0.05);
		border: 1px solid rgba(255, 255, 255, 0.1);
		border-radius: 20px;
		color: rgba(255, 255, 255, 0.45);
		padding: 3px 10px;
		font-size: 11px;
		cursor: pointer;
		text-transform: capitalize;
	}
	.type-btn.active {
		background: rgba(68, 136, 255, 0.2);
		border-color: rgba(68, 136, 255, 0.5);
		color: #4488ff;
	}
	textarea {
		background: rgba(255, 255, 255, 0.05);
		border: 1px solid rgba(255, 255, 255, 0.1);
		border-radius: 8px;
		color: #fff;
		font-size: 13px;
		font-family: inherit;
		padding: 10px;
		resize: vertical;
		outline: none;
		line-height: 1.5;
	}
	textarea:focus {
		border-color: rgba(68, 136, 255, 0.5);
	}
	.submit {
		background: rgba(68, 136, 255, 0.2);
		border: 1px solid rgba(68, 136, 255, 0.4);
		border-radius: 8px;
		color: #4488ff;
		padding: 8px;
		font-size: 13px;
		cursor: pointer;
		font-weight: 600;
	}
	.submit:disabled {
		opacity: 0.4;
		cursor: not-allowed;
	}
	.cancel {
		background: rgba(255, 255, 255, 0.06);
		border: 1px solid rgba(255, 255, 255, 0.1);
		border-radius: 8px;
		color: rgba(255, 255, 255, 0.4);
		padding: 8px 14px;
		font-size: 13px;
		cursor: pointer;
	}
	.voice-area {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 12px;
		padding: 16px 0;
	}
	.record-btn {
		background: rgba(255, 68, 68, 0.15);
		border: 2px solid rgba(255, 68, 68, 0.4);
		border-radius: 50%;
		width: 64px;
		height: 64px;
		font-size: 20px;
		cursor: pointer;
		color: #ff4444;
		transition: all 0.2s;
	}
	.record-btn.recording {
		background: rgba(255, 68, 68, 0.35);
		animation: pulse 1s infinite;
	}
	@keyframes pulse {
		0%, 100% { transform: scale(1); }
		50% { transform: scale(1.08); }
	}
	.hint {
		font-size: 11px;
		color: rgba(255, 255, 255, 0.3);
		text-align: center;
		margin: 0;
	}
	.image-area {
		display: flex;
		flex-direction: column;
		gap: 10px;
	}
	.upload-label {
		display: flex;
		align-items: center;
		justify-content: center;
		border: 1px dashed rgba(255, 255, 255, 0.2);
		border-radius: 10px;
		padding: 32px;
		color: rgba(255, 255, 255, 0.35);
		font-size: 13px;
		cursor: pointer;
		text-align: center;
	}
	.upload-label input {
		display: none;
	}
	.preview {
		border-radius: 8px;
		max-height: 140px;
		object-fit: cover;
		width: 100%;
	}
	.image-actions {
		display: flex;
		gap: 8px;
	}
	.image-actions .submit {
		flex: 1;
	}
	.md-upload-label {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		background: rgba(255, 255, 255, 0.05);
		border: 1px solid rgba(255, 255, 255, 0.12);
		border-radius: 7px;
		color: rgba(255, 255, 255, 0.45);
		padding: 5px 12px;
		font-size: 12px;
		cursor: pointer;
		align-self: flex-start;
	}
	.md-upload-label:hover { color: rgba(255, 255, 255, 0.7); border-color: rgba(255,255,255,0.25); }
	.md-upload-label input { display: none; }
	.reprocess {
		background: rgba(255, 180, 50, 0.12);
		border: 1px solid rgba(255, 180, 50, 0.35);
		border-radius: 8px;
		color: rgba(255, 180, 50, 0.9);
		padding: 6px;
		font-size: 12px;
		cursor: pointer;
	}
	.reprocess:disabled {
		opacity: 0.4;
		cursor: not-allowed;
	}
	.reanalyse {
		background: rgba(180, 100, 255, 0.12);
		border: 1px solid rgba(180, 100, 255, 0.35);
		border-radius: 8px;
		color: rgba(180, 100, 255, 0.9);
		padding: 6px;
		font-size: 12px;
		cursor: pointer;
	}
	.reanalyse:disabled {
		opacity: 0.4;
		cursor: not-allowed;
	}
	.status {
		font-size: 12px;
		color: rgba(255, 200, 100, 0.9);
		margin: 0;
		text-align: center;
	}
</style>
