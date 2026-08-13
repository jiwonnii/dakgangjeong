/**
 * Small in-memory TTL cache. Backs the weather/air-quality provider caches
 * (spec 7.3: "캐시 키는 격자좌표 + ..., TTL 6시간", weather/air-quality
 * TTL 1시간) and the L1 layer of the recommendation cache in front of the
 * `walk_course_cache` table.
 *
 * Deliberately dependency-free: this is a single-process cache, which is
 * sufficient for the MVP's traffic volume and the daily-batch-refreshed
 * reference data it fronts. It is not a distributed cache — if the API is
 * ever scaled to multiple instances, entries will diverge between
 * processes until each entry's own TTL expires, which is an accepted
 * tradeoff for MVP scope.
 */

type CacheEntry<V> = {
  value: V;
  expiresAtMs: number;
  insertedAtMs: number;
};

export class TtlCache<K, V> {
  private readonly store = new Map<K, CacheEntry<V>>();

  constructor(
    private readonly defaultTtlSeconds: number,
    private readonly maxEntries = 10000
  ) {
    if (defaultTtlSeconds <= 0) {
      throw new Error("defaultTtlSeconds must be positive.");
    }

    if (maxEntries <= 0) {
      throw new Error("maxEntries must be positive.");
    }
  }

  get(key: K): V | undefined {
    const entry = this.store.get(key);

    if (!entry) {
      return undefined;
    }

    if (entry.expiresAtMs <= Date.now()) {
      this.store.delete(key);
      return undefined;
    }

    return entry.value;
  }

  has(key: K): boolean {
    return this.get(key) !== undefined;
  }

  set(key: K, value: V, ttlSeconds = this.defaultTtlSeconds): void {
    if (ttlSeconds <= 0) {
      throw new Error("ttlSeconds must be positive.");
    }

    if (!this.store.has(key) && this.store.size >= this.maxEntries) {
      this.evictOldestEntry();
    }

    const now = Date.now();
    this.store.set(key, {
      value,
      expiresAtMs: now + ttlSeconds * 1000,
      insertedAtMs: now
    });
  }

  delete(key: K): void {
    this.store.delete(key);
  }

  clear(): void {
    this.store.clear();
  }

  get size(): number {
    return this.store.size;
  }

  /**
   * Returns the cached value for `key` if present and unexpired; otherwise
   * calls `compute`, stores the result, and returns it. Concurrent calls for
   * the same missing key will each invoke `compute` independently (no
   * request coalescing) — acceptable given the low expected concurrency of
   * a single MVP instance, and simpler than adding in-flight-promise
   * tracking for a cache this small.
   */
  async getOrCompute(
    key: K,
    compute: () => Promise<V>,
    ttlSeconds = this.defaultTtlSeconds
  ): Promise<V> {
    const cached = this.get(key);

    if (cached !== undefined) {
      return cached;
    }

    const computed = await compute();
    this.set(key, computed, ttlSeconds);
    return computed;
  }

  private evictOldestEntry(): void {
    let oldestKey: K | undefined;
    let oldestInsertedAtMs = Number.POSITIVE_INFINITY;

    for (const [key, entry] of this.store.entries()) {
      if (entry.insertedAtMs < oldestInsertedAtMs) {
        oldestInsertedAtMs = entry.insertedAtMs;
        oldestKey = key;
      }
    }

    if (oldestKey !== undefined) {
      this.store.delete(oldestKey);
    }
  }
}
