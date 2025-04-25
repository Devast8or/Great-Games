/**
 * Cache module for API responses
 */
class APICache {
    constructor() {
        this.cache = new Map();
        this.maxAge = 5 * 60 * 1000; // 5 minutes
    }

    /**
     * Get cached data if it exists and is not expired
     * @param {string} key - Cache key
     * @returns {any} - Cached data or null
     */
    get(key) {
        const item = this.cache.get(key);
        if (!item) return null;

        const now = Date.now();
        if (now - item.timestamp > this.maxAge) {
            this.cache.delete(key);
            return null;
        }

        return item.data;
    }

    /**
     * Store data in cache
     * @param {string} key - Cache key
     * @param {any} data - Data to cache
     */
    set(key, data) {
        this.cache.set(key, {
            data,
            timestamp: Date.now()
        });
    }

    /**
     * Clear expired items from cache
     */
    cleanup() {
        const now = Date.now();
        for (const [key, item] of this.cache.entries()) {
            if (now - item.timestamp > this.maxAge) {
                this.cache.delete(key);
            }
        }
    }

    /**
     * Get or fetch data using cache
     * @param {string} key - Cache key
     * @param {Function} fetchFn - Function to fetch data if not cached
     * @returns {Promise} - Promise resolving to data
     */
    async getOrFetch(key, fetchFn) {
        const cached = this.get(key);
        if (cached) return cached;

        const data = await fetchFn();
        this.set(key, data);
        return data;
    }
}

export default APICache;