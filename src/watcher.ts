import * as fs from 'fs';
import * as path from 'path';
import type { ActivityCallback } from '@tokentop/plugin-sdk';
import { GEMINI_SESSIONS_PATH, getChatsDirs } from './paths.ts';
import type { GeminiConversationRecord } from './types.ts';
import { isTokenBearingGeminiMessage } from './parser.ts';

/** Interval for full reconciliation sweeps (10 minutes). */
export const RECONCILIATION_INTERVAL_MS = 10 * 60 * 1000;

/** State for the session file watcher (dirty-path tracking). */
export const sessionWatcher = {
  dirtyPaths: new Set<string>(),
  watchers: new Map<string, fs.FSWatcher>(),
  started: false,
  reconciliationTimer: null as ReturnType<typeof setInterval> | null,
};

/** State for the activity watcher (real-time delta detection). */
const activityWatcher = {
  knownMessageIds: new Map<string, Set<string>>(),
  watchers: new Map<string, fs.FSWatcher>(),
  callback: null as ActivityCallback | null,
  started: false,
};

let forceFullReconciliation = false;

/**
 * Consumes and resets the force-full-reconciliation flag.
 */
export function consumeForceFullReconciliation(): boolean {
  const val = forceFullReconciliation;
  forceFullReconciliation = false;
  return val;
}

/**
 * Starts watching a specific chats/ directory for file changes.
 * Only sets up the watcher once per directory.
 */
export function watchChatsDir(chatsDirPath: string): void {
  if (sessionWatcher.watchers.has(chatsDirPath)) return;

  try {
    const watcher = fs.watch(chatsDirPath, (_event, filename) => {
      if (!filename || !filename.endsWith('.json')) return;
      sessionWatcher.dirtyPaths.add(path.join(chatsDirPath, filename));
    });

    watcher.on('error', () => {
      sessionWatcher.watchers.delete(chatsDirPath);
    });

    sessionWatcher.watchers.set(chatsDirPath, watcher);
  } catch {
    // Directory may not be accessible — skip silently
  }
}

/**
 * Starts the session watcher system: watches the root tmp/ directory for
 * new project hash directories, and sets up reconciliation timer.
 */
export function startSessionWatcher(): void {
  if (sessionWatcher.started) return;
  sessionWatcher.started = true;

  // Watch the root tmp/ directory for new project hash directories
  try {
    const rootWatcher = fs.watch(GEMINI_SESSIONS_PATH, (_event, filename) => {
      if (!filename) return;
      const chatsPath = path.join(GEMINI_SESSIONS_PATH, filename, 'chats');
      // Check if chats/ exists synchronously for the watcher callback
      try {
        fs.accessSync(chatsPath);
        watchChatsDir(chatsPath);
      } catch {
        // Not a valid project dir or chats/ doesn't exist yet
      }
    });

    rootWatcher.on('error', () => {
      // Root directory watcher failed — non-fatal
    });

    sessionWatcher.watchers.set(GEMINI_SESSIONS_PATH, rootWatcher);
  } catch {
    // Root directory not accessible
  }

  // Set up periodic full reconciliation
  sessionWatcher.reconciliationTimer = setInterval(() => {
    forceFullReconciliation = true;
  }, RECONCILIATION_INTERVAL_MS);

  // Don't keep the process alive just for this timer
  if (sessionWatcher.reconciliationTimer && typeof sessionWatcher.reconciliationTimer === 'object' && 'unref' in sessionWatcher.reconciliationTimer) {
    sessionWatcher.reconciliationTimer.unref();
  }
}

/**
 * Primes the activity watcher with known message IDs from existing session files.
 * Must be called before starting activity watching to avoid emitting stale deltas.
 */
async function primeKnownMessageIds(): Promise<void> {
  const chatsDirs = await getChatsDirs();

  for (const chatsDirPath of chatsDirs) {
    let entries;
    try {
      entries = await fs.promises.readdir(chatsDirPath, { withFileTypes: true });
    } catch {
      continue;
    }

    for (const entry of entries) {
      if (!entry.isFile() || !entry.name.startsWith('session-') || !entry.name.endsWith('.json')) continue;

      const filePath = path.join(chatsDirPath, entry.name);
      try {
        const content = await fs.promises.readFile(filePath, 'utf-8');
        const record = JSON.parse(content) as GeminiConversationRecord;
        if (!record || !record.messages) continue;

        const ids = new Set<string>();
        for (const msg of record.messages) {
          if (isTokenBearingGeminiMessage(msg)) {
            ids.add(msg.id);
          }
        }
        if (ids.size > 0) {
          activityWatcher.knownMessageIds.set(filePath, ids);
        }
      } catch {
        // Skip unreadable files
      }
    }
  }
}

/**
 * Handles a file change event for the activity watcher.
 * Reads the updated session file, diffs message IDs against known set,
 * and emits ActivityUpdate callbacks for new token-bearing messages.
 */
function handleActivityFileChange(filePath: string): void {
  if (!activityWatcher.callback) return;

  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const record = JSON.parse(content) as GeminiConversationRecord;
    if (!record || !record.messages) return;

    const knownIds = activityWatcher.knownMessageIds.get(filePath) ?? new Set<string>();

    for (const msg of record.messages) {
      if (!isTokenBearingGeminiMessage(msg)) continue;
      if (knownIds.has(msg.id)) continue;

      // New token-bearing message found
      knownIds.add(msg.id);

      activityWatcher.callback({
        sessionId: record.sessionId,
        messageId: msg.id,
        tokens: {
          input: msg.tokens.input,
          output: msg.tokens.output,
          cacheRead: msg.tokens.cached > 0 ? msg.tokens.cached : undefined,
        },
        timestamp: Date.parse(msg.timestamp) || Date.now(),
      });
    }

    activityWatcher.knownMessageIds.set(filePath, knownIds);
  } catch {
    // File read/parse error — skip this change
  }
}

/**
 * Starts real-time activity watching.
 * Primes known message IDs, then watches for file changes and emits deltas.
 */
export function startActivityWatch(callback: ActivityCallback): void {
  if (activityWatcher.started) return;
  activityWatcher.started = true;
  activityWatcher.callback = callback;

  // Prime and then set up watchers
  primeKnownMessageIds().then(async () => {
    const chatsDirs = await getChatsDirs();

    for (const chatsDirPath of chatsDirs) {
      if (activityWatcher.watchers.has(chatsDirPath)) continue;

      try {
        const watcher = fs.watch(chatsDirPath, (_event, filename) => {
          if (!filename || !filename.endsWith('.json')) return;
          handleActivityFileChange(path.join(chatsDirPath, filename));
        });

        watcher.on('error', () => {
          activityWatcher.watchers.delete(chatsDirPath);
        });

        activityWatcher.watchers.set(chatsDirPath, watcher);
      } catch {
        // Skip inaccessible directories
      }
    }
  }).catch(() => {
    // Priming failed — activity watching will start without known IDs
    // This means first changes might emit stale deltas
  });
}

/**
 * Stops real-time activity watching and tears down all watchers.
 */
export function stopActivityWatch(): void {
  for (const watcher of activityWatcher.watchers.values()) {
    watcher.close();
  }
  activityWatcher.watchers.clear();
  activityWatcher.knownMessageIds.clear();
  activityWatcher.callback = null;
  activityWatcher.started = false;
}

/**
 * Stops all watchers (session + activity) and cleans up timers.
 */
export function stopAllWatchers(): void {
  // Stop session watchers
  for (const watcher of sessionWatcher.watchers.values()) {
    watcher.close();
  }
  sessionWatcher.watchers.clear();
  sessionWatcher.dirtyPaths.clear();
  sessionWatcher.started = false;

  if (sessionWatcher.reconciliationTimer) {
    clearInterval(sessionWatcher.reconciliationTimer);
    sessionWatcher.reconciliationTimer = null;
  }

  // Stop activity watchers
  stopActivityWatch();
}
