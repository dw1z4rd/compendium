import { writable, derived } from 'svelte/store';
import type { GraphNode, CompendiumEdge } from '$lib/types';

// ─── Core stores ──────────────────────────────────────────────────────────────

export const nodes = writable<GraphNode[]>([]);
export const edges = writable<CompendiumEdge[]>([]);

// ─── UI state ─────────────────────────────────────────────────────────────────

export const selectedNodeId = writable<string | null>(null);
export const searchQuery = writable<string>('');
export const isLoading = writable<boolean>(false);
export const ollamaAvailable = writable<boolean | null>(null); // null = unchecked
export const cloudConfigured = writable<boolean>(false);

// ─── Filtered node IDs (null = show all) ──────────────────────────────────────

export const filteredNodeIds = derived(
	[nodes, edges, searchQuery],
	([$nodes, $edges, $query]) => {
		if (!$query.trim()) return null;

		const q = $query.toLowerCase();
		const matched = new Set<string>();

		for (const node of $nodes) {
			const inContent = node.content.toLowerCase().includes(q);
			const inComponents = node.components.some((c) => c.toLowerCase().includes(q));
			if (inContent || inComponents) matched.add(node.id);
		}

		// Expand to taxonomic neighbors (is_a, is_part_of)
		const taxonomic = new Set(['is_a', 'is_part_of']);
		const toAdd: string[] = [];
		for (const edge of $edges) {
			if (!taxonomic.has(edge.relation)) continue;
			if (matched.has(edge.from_node)) toAdd.push(edge.to_node);
			if (matched.has(edge.to_node)) toAdd.push(edge.from_node);
		}
		toAdd.forEach((id) => matched.add(id));

		return matched;
	}
);

// ─── Pending review count (badge) ─────────────────────────────────────────────

export const pendingEdgeCount = derived(edges, ($edges) =>
	$edges.filter((e) => e.status === 'proposed').length
);

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function upsertNode(node: GraphNode) {
	nodes.update((ns) => {
		const idx = ns.findIndex((n) => n.id === node.id);
		if (idx >= 0) {
			ns[idx] = { ...ns[idx], ...node };
			return [...ns];
		}
		return [...ns, node];
	});
}

export function upsertEdge(edge: CompendiumEdge) {
	edges.update((es) => {
		const idx = es.findIndex((e) => e.id === edge.id);
		if (idx >= 0) {
			es[idx] = edge;
			return [...es];
		}
		return [...es, edge];
	});
}

export function removeEdge(edgeId: string) {
	edges.update((es) => es.filter((e) => e.id !== edgeId));
}
