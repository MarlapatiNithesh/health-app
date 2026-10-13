export class CacheManager {
  constructor({ defaultTtlMs = 60_000, maxEntries = 50_000, evictionPolicy = 'LRU' } = {}) {
    this.defaultTtlMs = defaultTtlMs;
    this.maxEntries = maxEntries;
    this.evictionPolicy = evictionPolicy.toUpperCase();
    this.store = new Map();
    this.inFlight = new Map();
    this.accessClock = 0;
  }

  async coalesce(key, fetcher, ttlMs = this.defaultTtlMs) {
    const cached = this.get(key);
    if (cached !== undefined) return cached;

    if (this.inFlight.has(key)) {
      return this.inFlight.get(key);
    }

    const promise = (async () => {
      try {
        const result = await fetcher();
        if (result !== undefined && result !== null) {
          this.set(key, result, ttlMs);
        }
        return result;
      } finally {
        this.inFlight.delete(key);
      }
    })();

    this.inFlight.set(key, promise);
    return promise;
  }

  get(key) {
    const entry = this.store.get(key);
    if (!entry) return undefined;

    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return undefined;
    }

    entry.lastAccessed = ++this.accessClock;
    entry.hits += 1;
    return entry.value;
  }

  set(key, value, ttlMs = this.defaultTtlMs) {
    if (this.store.size >= this.maxEntries && !this.store.has(key)) {
      this.#evict();
    }

    const now = Date.now();
    const clock = ++this.accessClock;
    this.store.set(key, {
      value,
      expiresAt: now + ttlMs,
      lastAccessed: clock,
      createdAt: clock,
      hits: 1,
    });
    return value;
  }

  async writeThrough(key, value, dbWriter, ttlMs = this.defaultTtlMs) {
    this.set(key, value, ttlMs);
    try {
      const persisted = await dbWriter();
      if (persisted !== undefined && persisted !== null) {
        this.set(key, persisted, ttlMs);
        return persisted;
      }
      return value;
    } catch (err) {
      this.store.delete(key);
      throw err;
    }
  }

  writeBehind(key, value, asyncDbWriter, ttlMs = this.defaultTtlMs) {
    this.set(key, value, ttlMs);
    queueMicrotask(async () => {
      try {
        const persisted = await asyncDbWriter();
        if (persisted !== undefined && persisted !== null) {
          this.set(key, persisted, ttlMs);
        }
      } catch {
        this.store.delete(key);
      }
    });
    return value;
  }

  setEvictionPolicy(policy) {
    this.evictionPolicy = String(policy).toUpperCase();
  }

  invalidate(prefixOrKey) {
    if (this.store.has(prefixOrKey)) {
      this.store.delete(prefixOrKey);
    }
    for (const key of this.store.keys()) {
      if (key.startsWith(prefixOrKey)) {
        this.store.delete(key);
      }
    }
  }

  invalidatePrefix(prefix) {
    this.invalidate(prefix);
  }

  clear() {
    this.store.clear();
    this.inFlight.clear();
  }

  #evict() {
    let victimKey = null;

    if (this.evictionPolicy === 'LFU') {
      let minHits = Infinity;
      for (const [key, entry] of this.store.entries()) {
        if (entry.hits < minHits) {
          minHits = entry.hits;
          victimKey = key;
        }
      }
    } else if (this.evictionPolicy === 'FIFO') {
      let oldestCreated = Infinity;
      for (const [key, entry] of this.store.entries()) {
        if (entry.createdAt < oldestCreated) {
          oldestCreated = entry.createdAt;
          victimKey = key;
        }
      }
    } else {
      let oldestAccess = Infinity;
      for (const [key, entry] of this.store.entries()) {
        if (entry.lastAccessed < oldestAccess) {
          oldestAccess = entry.lastAccessed;
          victimKey = key;
        }
      }
    }

    if (victimKey) {
      this.store.delete(victimKey);
    }
  }

  routeCache(ttlMs = 15_000) {
    return (req, res, next) => {
      if (req.method !== 'GET') {
        return next();
      }

      const cacheKey = `api:${req.memberId || 'public'}:${req.originalUrl}`;
      const cached = this.get(cacheKey);

      if (cached) {
        res.setHeader('X-Cache', 'HIT');
        return res.json(cached);
      }

      res.setHeader('X-Cache', 'MISS');
      const originalJson = res.json.bind(res);

      res.json = (body) => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          this.set(cacheKey, body, ttlMs);
        }
        return originalJson(body);
      };

      next();
    };
  }
}

export const globalCache = new CacheManager({ evictionPolicy: 'LRU' });
