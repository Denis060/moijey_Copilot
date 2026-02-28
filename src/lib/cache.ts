/**
 * Simple in-process TTL cache. Survives across requests in the same Node.js process.
 * Use for embedding vectors, business facts, or any data that's expensive to fetch
 * and changes infrequently.
 */
export class TtlCache<K, V> {
    private store = new Map<K, { value: V; expiresAt: number }>();

    constructor(private readonly ttlMs: number) {}

    get(key: K): V | undefined {
        const entry = this.store.get(key);
        if (!entry) return undefined;
        if (Date.now() > entry.expiresAt) {
            this.store.delete(key);
            return undefined;
        }
        return entry.value;
    }

    set(key: K, value: V): void {
        this.store.set(key, { value, expiresAt: Date.now() + this.ttlMs });
    }

    delete(key: K): void {
        this.store.delete(key);
    }

    /** Evict all expired entries — call periodically if needed */
    evict(): void {
        const now = Date.now();
        for (const [key, entry] of this.store) {
            if (now > entry.expiresAt) this.store.delete(key);
        }
    }

    get size(): number {
        return this.store.size;
    }
}
