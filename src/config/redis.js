import NodeCache from 'node-cache';
import logger from './logger.js';

/**
 * In-memory cache with Redis-compatible interface.
 * Drop-in replaceable with ioredis when scaling.
 */
class CacheStore {
  constructor() {
    this.cache = new NodeCache({
      stdTTL: 300,       // default 5 minutes
      checkperiod: 60,   // check for expired keys every 60s
      useClones: false,  // performance: avoid cloning on get
      maxKeys: 10000,
    });

    this.cache.on('expired', (key) => {
      logger.debug(`Cache key expired: ${key}`);
    });

    logger.info('In-memory cache initialized');
  }

  /**
   * Get a cached value
   * @param {string} key
   * @returns {*} cached value or undefined
   */
  get(key) {
    return this.cache.get(key);
  }

  /**
   * Set a cached value
   * @param {string} key
   * @param {*} value
   * @param {number} [ttl] TTL in seconds
   */
  set(key, value, ttl) {
    if (ttl) {
      this.cache.set(key, value, ttl);
    } else {
      this.cache.set(key, value);
    }
  }

  /**
   * Delete a cached key
   * @param {string} key
   */
  del(key) {
    this.cache.del(key);
  }

  /**
   * Delete all keys matching a pattern (glob-like)
   * @param {string} pattern e.g. "products:*"
   */
  delPattern(pattern) {
    const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
    const keys = this.cache.keys().filter((k) => regex.test(k));
    if (keys.length > 0) {
      this.cache.del(keys);
      logger.debug(`Cache invalidated ${keys.length} keys matching: ${pattern}`);
    }
  }

  /**
   * Flush all cached data
   */
  flush() {
    this.cache.flushAll();
    logger.info('Cache flushed');
  }

  /**
   * Get cache stats
   */
  stats() {
    return this.cache.getStats();
  }

  /**
   * Get or set pattern — fetch from cache, or compute and store
   * @param {string} key
   * @param {Function} fetchFn async function to compute value
   * @param {number} [ttl] TTL in seconds
   */
  async getOrSet(key, fetchFn, ttl) {
    const cached = this.get(key);
    if (cached !== undefined) {
      return cached;
    }
    const value = await fetchFn();
    this.set(key, value, ttl);
    return value;
  }
}

const cacheStore = new CacheStore();
export default cacheStore;
