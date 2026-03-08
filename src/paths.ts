import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';

/** Root Gemini configuration directory. */
export const GEMINI_HOME = path.join(os.homedir(), '.gemini');

/** Session storage root — all tools write to ~/.gemini/tmp/<projectHash>/chats/ */
export const GEMINI_SESSIONS_PATH = path.join(GEMINI_HOME, 'tmp');

/** Gemini CLI OAuth credentials file. */
export const GEMINI_OAUTH_CREDS_PATH = path.join(GEMINI_HOME, 'oauth_creds.json');

/** Antigravity accounts file (OpenCode config location). */
export const ANTIGRAVITY_ACCOUNTS_PATH = path.join(
  os.homedir(),
  '.config',
  'opencode',
  'antigravity-accounts.json',
);

/** Antigravity GUI directory (used for installation detection). */
export const ANTIGRAVITY_GUI_PATH = path.join(GEMINI_HOME, 'antigravity');

/**
 * Discovers all chats/ directories under the session storage root.
 * Each project hash has its own chats/ subdirectory.
 */
export async function getChatsDirs(): Promise<string[]> {
  try {
    const hashDirs = await fs.readdir(GEMINI_SESSIONS_PATH, { withFileTypes: true });
    const chatsDirs: string[] = [];

    for (const entry of hashDirs) {
      if (!entry.isDirectory()) continue;

      const chatsPath = path.join(GEMINI_SESSIONS_PATH, entry.name, 'chats');
      try {
        await fs.access(chatsPath);
        chatsDirs.push(chatsPath);
      } catch {
        // No chats/ subdirectory — skip
      }
    }

    return chatsDirs;
  } catch {
    return [];
  }
}
