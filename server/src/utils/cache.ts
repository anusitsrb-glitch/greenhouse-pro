/**
 * Simple in-memory cache with TTL
 * Used to cache expensive operations like device status checks
 */

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

class Cache {
  private cache = new Map<string, CacheEntry<any>>();

  /**
   * Get value from cache or fetch if not present/expired
   */
  async get<T>(
    key: string,
    ttl: number,
    fetcher: () => Promise<T>
  ): Promise<T> {
    const now = Date.now();
    const entry = this.cache.get(key);

    // Return cached value if not expired
    if (entry && entry.expiresAt > now) {
      return entry.value as T;
    }

    // Fetch new value
    const value = await fetcher();

    // Store in cache
    this.cache.set(key, {
      value,
      expiresAt: now + ttl,
    });

    return value;
  }

  /**
   * Set value in cache
   */
  set<T>(key: string, value: T, ttl: number): void {
    this.cache.set(key, {
      value,
      expiresAt: Date.now() + ttl,
    });
  }

  /**
   * Invalidate cache entry
   */
  invalidate(key: string): void {
    this.cache.delete(key);
  }

  /**
   * Invalidate all cache entries matching a pattern
   */
  invalidatePattern(pattern: RegExp): void {
    for (const key of this.cache.keys()) {
      if (pattern.test(key)) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Clear all cache
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Get cache statistics
   */
  getStats() {
    const now = Date.now();
    let validCount = 0;
    let expiredCount = 0;

    for (const entry of this.cache.values()) {
      if (entry.expiresAt > now) {
        validCount++;
      } else {
        expiredCount++;
      }
    }

    return {
      total: this.cache.size,
      valid: validCount,
      expired: expiredCount,
    };
  }

  /**
   * Clean up expired entries
   */
  cleanup(): void {
    const now = Date.now();
    const keysToDelete: string[] = [];

    for (const [key, entry] of this.cache.entries()) {
      if (entry.expiresAt <= now) {
        keysToDelete.push(key);
      }
    }

    for (const key of keysToDelete) {
      this.cache.delete(key);
    }

    if (keysToDelete.length > 0) {
      console.log(`🧹 Cache cleanup: removed ${keysToDelete.length} expired entries`);
    }
  }
}

// Create singleton instance
export const cache = new Cache();

// Cleanup expired entries every 5 minutes
setInterval(() => {
  cache.cleanup();
}, 5 * 60 * 1000);

// Helper function for common cache patterns
export async function getCached<T>(
  key: string,
  ttl: number,
  fetcher: () => Promise<T>
): Promise<T> {
  return cache.get(key, ttl, fetcher);
}
