import type { SessionUsageData } from '@tokentop/plugin-sdk';

/**
 * Token usage summary from the Gemini API response metadata.
 * Maps to GenerateContentResponseUsageMetadata fields.
 */
export interface GeminiTokensSummary {
  input: number;       // promptTokenCount
  output: number;      // candidatesTokenCount
  cached: number;      // cachedContentTokenCount
  thoughts?: number;   // thoughtsTokenCount
  tool?: number;       // toolUsePromptTokenCount
  total: number;       // totalTokenCount
}

/**
 * Content can be a string or an array of parts.
 */
export type GeminiPartList = string | Array<{ text?: string; [key: string]: unknown }>;

/**
 * Base fields common to all message types.
 */
export interface GeminiBaseMessage {
  id: string;
  timestamp: string;
  content: GeminiPartList;
  displayContent?: GeminiPartList;
}

/**
 * A Gemini model response message — may or may not have token data.
 */
export interface GeminiModelMessage extends GeminiBaseMessage {
  type: 'gemini';
  model?: string;
  tokens?: GeminiTokensSummary | null;
  toolCalls?: unknown[];
  thoughts?: Array<{ subject: string; description: string; timestamp: string }>;
}

/**
 * A Gemini model message that is guaranteed to have token data.
 * Used as the narrowed type after the type guard.
 */
export interface GeminiTokenBearingMessage extends GeminiBaseMessage {
  type: 'gemini';
  id: string;
  model?: string;
  tokens: GeminiTokensSummary;
  toolCalls?: unknown[];
  thoughts?: Array<{ subject: string; description: string; timestamp: string }>;
}

/**
 * Non-model messages (user input, info, errors, warnings).
 */
export interface GeminiOtherMessage extends GeminiBaseMessage {
  type: 'user' | 'info' | 'error' | 'warning';
}

/**
 * Union of all message types in a conversation record.
 */
export type GeminiMessage = GeminiModelMessage | GeminiOtherMessage;

/**
 * Complete conversation record stored in session JSON files.
 * Written by ChatRecordingService from @google/gemini-cli-core.
 */
export interface GeminiConversationRecord {
  sessionId: string;
  projectHash: string;
  startTime: string;
  lastUpdated: string;
  messages: GeminiMessage[];
  summary?: string;
  /** Workspace directories added during the session via /dir add */
  directories?: string[];
  /** The kind of conversation (main agent or subagent) */
  kind?: 'main' | 'subagent';
}

/**
 * Cached per-session aggregate entry.
 */
export interface SessionAggregateCacheEntry {
  updatedAt: number;
  usageRows: SessionUsageData[];
  lastAccessed: number;
}

/**
 * Antigravity accounts file structure.
 */
export interface AntigravityAccount {
  refreshToken?: string;
  accessToken?: string;
  expiresAt?: number;
  projectId?: string;
  managedProjectId?: string;
  enabled?: boolean;
}

/**
 * Antigravity accounts file top-level structure.
 */
export interface AntigravityAccountsFile {
  activeIndex?: number;
  accounts?: AntigravityAccount[];
}

/**
 * Gemini CLI OAuth credentials file structure.
 */
export interface GeminiOAuthCreds {
  refresh_token?: string;
  access_token?: string;
  token_type?: string;
  expiry_date?: number;
}
