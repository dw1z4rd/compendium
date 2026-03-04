import Surreal from 'surrealdb';
import { env } from '$env/dynamic/private';

// ─── Singleton connection ─────────────────────────────────────────────────────

let connectionPromise: Promise<Surreal> | null = null;

async function createConnection(): Promise<Surreal> {
	const db = new Surreal();
	await db.connect(env.SURREAL_URL as string);
	await db.use({ namespace: env.SURREAL_NS as string, database: env.SURREAL_DB as string });
	await db.signin({ username: env.SURREAL_USER as string, password: env.SURREAL_PASS as string });
	return db;
}

export async function getDB(): Promise<Surreal> {
	if (!connectionPromise) {
		connectionPromise = createConnection().catch((err) => {
			connectionPromise = null; // allow retry on next call
			throw err;
		});
	}
	return connectionPromise;
}

// ─── Serialization helpers ────────────────────────────────────────────────────

/** Convert a SurrealDB RecordId (or any value) to a plain string like "node:abc123" */
function idToString(id: unknown): string {
	if (typeof id === 'string') return id;
	if (id && typeof (id as { toString?: () => string }).toString === 'function') {
		return (id as { toString: () => string }).toString();
	}
	return String(id);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRecord = Record<string, any>;

/** Serialize a SurrealDB record — converts RecordId fields to plain strings */
export function serialize<T>(record: T): T & { id: string } {
	const r = record as AnyRecord;
	const out: AnyRecord = { ...r };
	out.id = idToString(r.id);
	if (r.from_node !== undefined) out.from_node = idToString(r.from_node);
	if (r.to_node !== undefined) out.to_node = idToString(r.to_node);
	return out as T & { id: string };
}

export function serializeAll<T>(records: T[]): (T & { id: string })[] {
	return records.map(serialize);
}
