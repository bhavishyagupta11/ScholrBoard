/**
 * documentBufferCache.js — Ephemeral in-memory buffer cache for authenticated document workflows.
 *
 * Provides safe in-memory handover between upload handlers (multer memory storage)
 * and same-process document consumers (AI resume analysis, certificate OCR, and PDF previews).
 *
 * Security & Resource Protections:
 *  - Strictly partitioned by owner userId (prevents cross-tenant access)
 *  - Automatic 15-minute TTL expiration with proactive pruning
 *  - Bounded entry count cap (maxEntries) AND total memory byte cap (maxTotalBytes)
 *  - Rejects individual buffers exceeding maxEntryBytes
 *  - Deterministic LRU eviction on capacity or byte exhaustion; handles duplicate keys cleanly
 */

const DEFAULT_MAX_ENTRIES = 50;
const DEFAULT_TTL_MS = 15 * 60 * 1000;
const DEFAULT_MAX_ENTRY_BYTES = 10 * 1024 * 1024; // 10 MB per document
const DEFAULT_MAX_TOTAL_BYTES = 64 * 1024 * 1024; // 64 MB process heap ceiling

class DocumentBufferCache {
  constructor(
    maxEntriesOrOpts = DEFAULT_MAX_ENTRIES,
    ttlMs = DEFAULT_TTL_MS,
    maxTotalBytes = DEFAULT_MAX_TOTAL_BYTES,
    maxEntryBytes = DEFAULT_MAX_ENTRY_BYTES
  ) {
    this.cache = new Map();
    if (typeof maxEntriesOrOpts === 'object' && maxEntriesOrOpts !== null) {
      this.maxEntries = maxEntriesOrOpts.maxEntries ?? DEFAULT_MAX_ENTRIES;
      this.ttlMs = maxEntriesOrOpts.ttlMs ?? DEFAULT_TTL_MS;
      this.maxTotalBytes = maxEntriesOrOpts.maxTotalBytes ?? DEFAULT_MAX_TOTAL_BYTES;
      this.maxEntryBytes = maxEntriesOrOpts.maxEntryBytes ?? DEFAULT_MAX_ENTRY_BYTES;
    } else {
      this.maxEntries = maxEntriesOrOpts;
      this.ttlMs = ttlMs;
      this.maxTotalBytes = maxTotalBytes;
      this.maxEntryBytes = maxEntryBytes;
    }
    this.totalBytes = 0;
  }

  _makeKey(userId, identifier) {
    if (!userId || !identifier) return null;
    return `${String(userId).toLowerCase()}:${String(identifier).toLowerCase()}`;
  }

  _deleteKey(key) {
    const existing = this.cache.get(key);
    if (!existing) return false;
    this.totalBytes = Math.max(0, this.totalBytes - existing.byteLength);
    this.cache.delete(key);
    return true;
  }

  pruneExpired(now = Date.now()) {
    let pruned = 0;
    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        this._deleteKey(key);
        pruned++;
      }
    }
    return pruned;
  }

  set(userId, identifier, buffer, mimeType = 'application/pdf') {
    if (!userId || !identifier || !Buffer.isBuffer(buffer)) return false;

    const byteLength = buffer.byteLength;
    if (byteLength === 0 || byteLength > this.maxEntryBytes || byteLength > this.maxTotalBytes) {
      return false;
    }

    const key = this._makeKey(userId, identifier);
    if (!key) return false;

    const now = Date.now();
    // Clear any expired entries before evicting active entries
    this.pruneExpired(now);

    // Handle duplicate key overwrite cleanly (adjust byte accounting + refresh LRU position)
    if (this.cache.has(key)) {
      this._deleteKey(key);
    }

    // Evict oldest LRU entries until within BOTH entry count and memory byte caps
    while (
      (this.cache.size >= this.maxEntries || (this.totalBytes + byteLength) > this.maxTotalBytes) &&
      this.cache.size > 0
    ) {
      const oldestKey = this.cache.keys().next().value;
      this._deleteKey(oldestKey);
    }

    // Store defensive copy? Multer memoryStorage creates isolated Buffer per request; keep slice/reference bounded
    this.cache.set(key, {
      ownerUserId: String(userId).toLowerCase(),
      buffer,
      byteLength,
      mimeType,
      mimetype: mimeType,
      expiresAt: now + this.ttlMs,
      createdAt: now,
    });
    this.totalBytes += byteLength;
    return true;
  }

  get(userId, identifier) {
    const key = this._makeKey(userId, identifier);
    if (!key) return null;

    const entry = this.cache.get(key);
    if (!entry) return null;

    if (Date.now() > entry.expiresAt) {
      this._deleteKey(key);
      return null;
    }

    // Refresh LRU ordering on hit
    this.cache.delete(key);
    this.cache.set(key, entry);
    return entry;
  }

  has(userId, identifier) {
    return this.get(userId, identifier) !== null;
  }

  delete(userId, identifier) {
    const key = this._makeKey(userId, identifier);
    if (key) return this._deleteKey(key);
    return false;
  }

  clear() {
    this.cache.clear();
    this.totalBytes = 0;
  }

  getStats() {
    this.pruneExpired();
    return {
      entries: this.cache.size,
      totalBytes: this.totalBytes,
      maxEntries: this.maxEntries,
      maxTotalBytes: this.maxTotalBytes,
      ttlMs: this.ttlMs,
    };
  }
}

export { DocumentBufferCache };
export const documentBufferCache = new DocumentBufferCache();
export default documentBufferCache;
