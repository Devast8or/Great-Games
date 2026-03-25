/**
 * Cache module for API responses.
 */
class APICache {
    constructor() {
        this.cache = new Map();
        this.inFlight = new Map();
        this.maxAge = 5 * 60 * 1000;
    }

    get(key) {
        const item = this.cache.get(key);
        if (!item) {
            return null;
        }

        if (Date.now() - item.timestamp > this.maxAge) {
            this.cache.delete(key);
            return null;
        }

        return item.data;
    }

    set(key, data) {
        this.cache.set(key, {
            data,
            timestamp: Date.now()
        });
    }

    async getOrFetch(key, fetchFn) {
        const cached = this.get(key);
        if (cached !== null) {
            return cached;
        }

        const pending = this.inFlight.get(key);
        if (pending) {
            return pending;
        }

        const fetchPromise = Promise.resolve()
            .then(() => fetchFn())
            .then((data) => {
                this.set(key, data);
                return data;
            })
            .finally(() => {
                this.inFlight.delete(key);
            });

        this.inFlight.set(key, fetchPromise);

        return fetchPromise;
    }
}

export default APICache;
