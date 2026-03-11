// ─── Domain enums ─────────────────────────────────────────────────────────────

export type NodeType = 'thought' | 'belief' | 'image' | 'memory' | 'conversation';
export type NodeStatus = 'pending' | 'processed';
export type NodeSource = 'manual' | 'voice' | 'image' | 'import';
export type EdgeStatus = 'proposed' | 'accepted' | 'rejected';

export type RelationType =
	// Logical
	| 'supports'
	| 'contradicts'
	| 'implies'
	| 'requires'
	// Taxonomic
	| 'is_a'
	| 'is_part_of'
	// Causal
	| 'causes'
	| 'enables'
	| 'prevents'
	// Experiential
	| 'evokes'
	| 'reframes'
	| 'parallels'
	// Generative
	| 'origin_of'
	| 'responds_to';

export const RELATION_CATEGORIES: Record<RelationType, string> = {
	supports: 'logical',
	contradicts: 'logical',
	implies: 'logical',
	requires: 'logical',
	is_a: 'taxonomic',
	is_part_of: 'taxonomic',
	causes: 'causal',
	enables: 'causal',
	prevents: 'causal',
	evokes: 'experiential',
	reframes: 'experiential',
	parallels: 'experiential',
	origin_of: 'generative',
	responds_to: 'generative'
};

export const ALL_RELATION_TYPES: RelationType[] = Object.keys(RELATION_CATEGORIES) as RelationType[];

// ─── DB records ───────────────────────────────────────────────────────────────

export interface CompendiumNode extends Record<string, unknown> {
	id: string;
	type: NodeType;
	content: string;
	components: string[];
	embedding: number[];
	status: NodeStatus;
	source: NodeSource;
	created_at: string;
	raw_media?: string;
}

export interface CompendiumEdge extends Record<string, unknown> {
	id: string;
	from_node: string;
	to_node: string;
	relation: RelationType;
	reasoning: string;
	status: EdgeStatus;
	annotation?: string;
	created_at: string;
}

// ─── Graph state (augmented with position for 3D layout) ─────────────────────

export interface GraphNode extends CompendiumNode {
	x: number;
	y: number;
	z: number;
	vx: number;
	vy: number;
	vz: number;
	connectionCount: number;
}

// ─── Input / creation ─────────────────────────────────────────────────────────

export interface CreateNodeInput {
	type: NodeType;
	content: string;
	source: NodeSource;
	raw_media?: string;
}

export interface ProposedEdge {
	to_node_id: string;
	relation: RelationType;
	reasoning: string;
	_flipped?: boolean;
	_originalTarget?: string;
}

// ─── API response shapes ──────────────────────────────────────────────────────

export interface ProcessResult {
	node: CompendiumNode;
	edgesProposed: number;
}

export interface ModelSettings {
	text_model: string;
	vision_model: string;
	embed_model: string;
}
