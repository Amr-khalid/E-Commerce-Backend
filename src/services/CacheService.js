import cacheStore from '../config/redis.js';
import config from '../config/index.js';
import logger from '../config/logger.js';

/**
 * Cache Service — wraps the cache store with domain-specific helpers.
 * Provides typed cache keys and automatic invalidation patterns.
 */
class CacheService {
  // ─── Key generators ─────────────────────────────────
  static keys = {
    product: (id) => `product:${id}`,
    productSlug: (slug) => `product:slug:${slug}`,
    productList: (hash) => `products:list:${hash}`,
    categoryTree: () => 'categories:tree',
    category: (id) => `category:${id}`,
    userCart: (userId) => `cart:${userId}`,
    settings: (key) => `settings:${key}`,
    coupon: (code) => `coupon:${code}`,
    featuredProducts: () => 'products:featured',
    newArrivals: () => 'products:new_arrivals',
    bestSellers: () => 'products:best_sellers',
  };

  // ─── Product cache ──────────────────────────────────
  static async getProduct(id) {
    return cacheStore.get(this.keys.product(id));
  }

  static setProduct(id, data) {
    cacheStore.set(this.keys.product(id), data, config.cache.ttlProducts);
  }

  static invalidateProduct(id) {
    cacheStore.del(this.keys.product(id));
    // Also invalidate any list caches
    cacheStore.delPattern('products:*');
  }

  // ─── Category cache ─────────────────────────────────
  static async getCategoryTree() {
    return cacheStore.get(this.keys.categoryTree());
  }

  static setCategoryTree(data) {
    cacheStore.set(this.keys.categoryTree(), data, config.cache.ttlCategories);
  }

  static invalidateCategories() {
    cacheStore.delPattern('categories:*');
    cacheStore.delPattern('category:*');
  }

  // ─── Generic getOrSet ───────────────────────────────
  static async getOrSet(key, fetchFn, ttl) {
    return cacheStore.getOrSet(key, fetchFn, ttl);
  }

  // ─── Invalidation helpers ───────────────────────────
  static invalidateProductLists() {
    cacheStore.delPattern('products:*');
  }

  static invalidateAll() {
    cacheStore.flush();
    logger.info('All cache cleared');
  }

  // ─── Stats ──────────────────────────────────────────
  static getStats() {
    return cacheStore.stats();
  }
}

export default CacheService;
