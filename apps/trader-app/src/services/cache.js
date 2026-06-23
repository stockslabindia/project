/**
 * Stale-While-Revalidate Cache
 * ─────────────────────────────────────────────────────────────────────────────
 * Persists API response data in localStorage with a TTL.
 * On cold start, stale data is loaded SYNCHRONOUSLY (0ms) so the UI renders
 * immediately. Fresh data from the network silently replaces it in the background.
 *
 * Usage:
 *   cache.set('instruments', data, 30 * 60);  // store with 30-min TTL
 *   cache.get('instruments');                  // returns null if expired or missing
 */

const PREFIX = 'tradex_cache_';

export const cache = {
  /**
   * Store a value with a TTL in seconds.
   * @param {string} key
   * @param {*} value  — must be JSON-serializable
   * @param {number} ttlSeconds
   */
  set(key, value, ttlSeconds) {
    try {
      const entry = {
        v: value,
        exp: Date.now() + ttlSeconds * 1000,
      };
      localStorage.setItem(PREFIX + key, JSON.stringify(entry));
    } catch (e) {
      // localStorage may be full — silently ignore
      console.warn('[cache] Failed to write', key, e.message);
    }
  },

  /**
   * Retrieve a cached value. Returns null if missing or expired.
   * @param {string} key
   * @returns {*|null}
   */
  get(key) {
    try {
      const raw = localStorage.getItem(PREFIX + key);
      if (!raw) return null;
      const entry = JSON.parse(raw);
      if (Date.now() > entry.exp) {
        localStorage.removeItem(PREFIX + key);
        return null;
      }
      return entry.v;
    } catch {
      return null;
    }
  },

  /**
   * Remove a specific cache entry.
   * @param {string} key
   */
  remove(key) {
    try {
      localStorage.removeItem(PREFIX + key);
    } catch {}
  },

  /**
   * Clear ALL cache entries (e.g. on logout).
   */
  clear() {
    try {
      const keysToRemove = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith(PREFIX)) keysToRemove.push(k);
      }
      keysToRemove.forEach(k => localStorage.removeItem(k));
    } catch {}
  },
};

// ── Cache key constants ────────────────────────────────────────────────────────
export const CACHE_KEYS = {
  INSTRUMENTS: 'instruments',
  WALLET:      'wallet',
  POSITIONS:   'positions',
  ORDERS:      'orders',
  WATCHLISTS:  'watchlists',
  HISTORY:     'history',
};

// ── TTL constants (seconds) ────────────────────────────────────────────────────
export const CACHE_TTL = {
  INSTRUMENTS: 30 * 60,   // 30 min — instrument list changes rarely
  WALLET:       5 * 60,   // 5 min  — balance can change anytime
  POSITIONS:    2 * 60,   // 2 min  — positions change on every tick/order
  ORDERS:       2 * 60,   // 2 min  — orders change on fill/cancel
  WATCHLISTS:  60 * 60,   // 60 min — user-configured, rarely changes
  HISTORY:     10 * 60,   // 10 min — closed trades don't change
};
