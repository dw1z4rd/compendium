declare module 'd3-force-3d' {
	export interface SimNode {
		index?: number;
		x?: number;
		y?: number;
		z?: number;
		vx?: number;
		vy?: number;
		vz?: number;
		fx?: number | null;
		fy?: number | null;
		fz?: number | null;
		[key: string]: unknown;
	}

	export interface SimLink<N extends SimNode> {
		source: N | string | number;
		target: N | string | number;
		index?: number;
	}

	export interface Force<N extends SimNode> {
		(alpha: number): void;
		initialize?(nodes: N[], random: () => number): void;
	}

	export interface LinkForce<N extends SimNode, L extends SimLink<N>> extends Force<N> {
		links(): L[];
		links(links: L[]): this;
		id(): (node: N) => string | number;
		id(fn: (node: N) => string | number): this;
		distance(): number | ((link: L) => number);
		distance(d: number | ((link: L) => number)): this;
		strength(): number | ((link: L) => number);
		strength(s: number | ((link: L) => number)): this;
		iterations(): number;
		iterations(n: number): this;
	}

	export interface ManyBodyForce<N extends SimNode> extends Force<N> {
		strength(): number | ((node: N) => number);
		strength(s: number | ((node: N) => number)): this;
		distanceMin(): number;
		distanceMin(d: number): this;
		distanceMax(): number;
		distanceMax(d: number): this;
		theta(): number;
		theta(t: number): this;
	}

	export interface CenterForce<N extends SimNode> extends Force<N> {
		x(): number;
		x(x: number): this;
		y(): number;
		y(y: number): this;
		z(): number;
		z(z: number): this;
		strength(): number;
		strength(s: number): this;
	}

	export interface Simulation<N extends SimNode> {
		numDimensions(n: number): this;
		nodes(): N[];
		nodes(nodes: N[]): this;
		alpha(): number;
		alpha(a: number): this;
		alphaMin(): number;
		alphaMin(a: number): this;
		alphaDecay(): number;
		alphaDecay(d: number): this;
		alphaTarget(): number;
		alphaTarget(t: number): this;
		velocityDecay(): number;
		velocityDecay(d: number): this;
		force(name: string): Force<N> | undefined;
		force(name: string, force: Force<N> | null): this;
		tick(iterations?: number): this;
		restart(): this;
		stop(): this;
		on(typenames: string, listener: (this: Simulation<N>) => void): this;
		on(typenames: string): ((this: Simulation<N>) => void) | undefined;
	}

	export function forceSimulation<N extends SimNode>(nodes?: N[]): Simulation<N>;
	export function forceLink<N extends SimNode, L extends SimLink<N>>(
		links?: L[]
	): LinkForce<N, L>;
	export function forceManyBody<N extends SimNode>(): ManyBodyForce<N>;
	export function forceCenter<N extends SimNode>(
		x?: number,
		y?: number,
		z?: number
	): CenterForce<N>;
	export function forceCollide<N extends SimNode>(
		radius?: number | ((node: N) => number)
	): Force<N>;
	export function forceX<N extends SimNode>(x?: number | ((node: N) => number)): Force<N>;
	export function forceY<N extends SimNode>(y?: number | ((node: N) => number)): Force<N>;
	export function forceZ<N extends SimNode>(z?: number | ((node: N) => number)): Force<N>;
}
