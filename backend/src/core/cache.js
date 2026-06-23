/**
 * High-Performance In-Memory Cache with TTL + LRU Eviction
 * Used to avoid redundant database lookups on the hot path (order placement).
 *
 * Improvements:
 *  - Max 1000 entries: when full, oldest 10% are evicted (LRU-style via insertion order)
 *  - Periodic cleanup (every 60s) sweeps expired keys to keep heap lean
 *  - Hit/miss stats exposed for monitoring
 */
const MAX_CACHE_SIZE = 1000;
const EVICT_COUNT    = Math.floor(MAX_CACHE_SIZE * 0.1); // Evict 100 entries when full

class MemoryCache {
  constructor() {
    this.store = new Map();
    this.hits   = 0;
    this.misses = 0;

    // Periodic sweep: remove expired entries every 60 seconds
    this._cleanupTimer = setInterval(() => this._sweepExpired(), 60_000);
    if (this._cleanupTimer.unref) this._cleanupTimer.unref(); // Don't block process exit
  }

  /**
   * Set cache entry with TTL.
   * @param {string} key    - Cache key
   * @param {*}      value  - Value to store
   * @param {number} ttlMs  - Time-to-live in milliseconds
   */
  set(key, value, ttlMs) {
    // Evict oldest entries if at capacity (Map preserves insertion order)
    if (this.store.size >= MAX_CACHE_SIZE && !this.store.has(key)) {
      let evicted = 0;
      for (const k of this.store.keys()) {
        this.store.delete(k);
        if (++evicted >= EVICT_COUNT) break;
      }
    }
    this.store.set(key, { value, expiresAt: Date.now() + ttlMs });
  }

  /**
   * Get cache entry. Returns null if missing or expired.
   * @param {string} key
   * @returns {*}
   */
  get(key) {
    const item = this.store.get(key);
    if (!item) { this.misses++; return null; }

    if (Date.now() > item.expiresAt) {
      this.store.delete(key);
      this.misses++;
      return null;
    }
    this.hits++;
    return item.value;
  }

  /** Delete a specific entry */
  delete(key) {
    this.store.delete(key);
  }

  /** Clear all entries */
  clear() {
    this.store.clear();
  }

  /** Current number of cached entries */
  get size() {
    return this.store.size;
  }

  /** Cache performance stats (for health/debug endpoints) */
  stats() {
    const total = this.hits + this.misses;
    return {
      size:     this.store.size,
      hits:     this.hits,
      misses:   this.misses,
      hitRate:  total > 0 ? ((this.hits / total) * 100).toFixed(1) + '%' : 'n/a',
    };
  }

  /** Remove all expired entries from the store */
  _sweepExpired() {
    const now = Date.now();
    for (const [k, item] of this.store.entries()) {
      if (now > item.expiresAt) this.store.delete(k);
    }
  }
}

const cache = new MemoryCache();
module.exports = cache;
