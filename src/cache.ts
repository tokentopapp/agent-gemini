import type { SessionAggregateCacheEntry } from './types.ts';

/** TTL for the full-result session cache (2 seconds). */
export const CACHE_TTL_MS = 2_000;

/** Maximum entries in the per-session aggregate cache before LRU eviction. */
export const SESSION_AGGREGATE_CACHE_MAX = 10_000;

/**
 * Full-result cache for parseSessions() output.
 * Prevents redundant full parses within the TTL window.
 */
export const sessionCache = {
  lastCheck: 0,
  lastResult: [] as import('@tokentop/plugin-sdk').SessionUsageData[],
  lastLimit: 0,
  lastSince: undefined as number | undefined,
};

/**
 * Per-session aggregate cache keyed by sessionId.
 * Stores parsed usage rows per session to avoid re-parsing unchanged files.
 */
export const sessionAggregateCache = new Map<string, SessionAggregateCacheEntry>();

/**
 * File metadata index mapping file paths to their last-known mtime and sessionId.
 * Enables stat-skip optimization when files haven't changed.
 */
export const sessionMetadataIndex = new Map<string, { mtimeMs: number; sessionId: string }>();

/**
 * Evicts least-recently-accessed entries from the session aggregate cache
 * when it exceeds the maximum size.
 */
export function evictSessionAggregateCache(): void {
  if (sessionAggregateCache.size <= SESSION_AGGREGATE_CACHE_MAX) return;

  const entries = Array.from(sessionAggregateCache.entries());
  entries.sort((a, b) => a[1].lastAccessed - b[1].lastAccessed);

  const toRemove = entries.length - SESSION_AGGREGATE_CACHE_MAX;
  for (let i = 0; i < toRemove; i++) {
    sessionAggregateCache.delete(entries[i][0]);
  }
}
