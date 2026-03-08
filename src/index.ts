import * as fs from 'fs';
import {
  createAgentPlugin,
  type AgentCredentials,
  type AgentFetchContext,
  type PluginContext,
  type SessionParseOptions,
  type SessionUsageData,
} from '@tokentop/plugin-sdk';
import { CACHE_TTL_MS, SESSION_AGGREGATE_CACHE_MAX, sessionAggregateCache, sessionCache, sessionMetadataIndex } from './cache.ts';
import { parseSessionsFromProjects } from './parser.ts';
import {
  ANTIGRAVITY_ACCOUNTS_PATH,
  ANTIGRAVITY_GUI_PATH,
  GEMINI_HOME,
  GEMINI_OAUTH_CREDS_PATH,
  GEMINI_SESSIONS_PATH,
} from './paths.ts';
import type { AntigravityAccountsFile, GeminiOAuthCreds } from './types.ts';
import { readJsonFile } from './utils.ts';
import { RECONCILIATION_INTERVAL_MS, startActivityWatch, stopActivityWatch } from './watcher.ts';

async function readGeminiCredentials(): Promise<AgentCredentials> {
  const accountsFile = await readJsonFile<AntigravityAccountsFile>(ANTIGRAVITY_ACCOUNTS_PATH);
  if (accountsFile?.accounts && accountsFile.accounts.length > 0) {
    const activeIndex = accountsFile.activeIndex ?? 0;
    const activeAccount = accountsFile.accounts[activeIndex];
    if (activeAccount?.refreshToken) {
      return {
        providers: {
          google: {
            source: 'external',
            oauth: {
              refreshToken: activeAccount.refreshToken,
              accessToken: activeAccount.accessToken ?? '',
              expiresAt: activeAccount.expiresAt,
              managedProjectId: activeAccount.managedProjectId,
            },
          },
        },
      };
    }
  }

  const oauthCreds = await readJsonFile<GeminiOAuthCreds>(GEMINI_OAUTH_CREDS_PATH);
  if (oauthCreds?.refresh_token) {
    return {
      providers: {
        google: {
          source: 'external',
          oauth: {
            refreshToken: oauthCreds.refresh_token,
            accessToken: oauthCreds.access_token ?? '',
            expiresAt: oauthCreds.expiry_date,
          },
        },
      },
    };
  }

  return { providers: {} };
}

const geminiAgentPlugin = createAgentPlugin({
  id: 'gemini',
  type: 'agent',
  name: 'Gemini',
  version: '0.1.0',

  meta: {
    description: 'Gemini session tracking — supports Gemini CLI, Antigravity, and all tools built on gemini-cli-core',
    homepage: 'https://github.com/tokentopapp/agent-gemini',
  },

  permissions: {
    filesystem: {
      read: true,
      paths: ['~/.gemini'],
    },
  },

  agent: {
    name: 'Gemini',
    command: 'gemini',
    configPath: GEMINI_HOME,
    sessionPath: GEMINI_SESSIONS_PATH,
  },

  capabilities: {
    sessionParsing: true,
    authReading: true,
    realTimeTracking: true,
    multiProvider: false,
  },

  async isInstalled(_ctx: PluginContext): Promise<boolean> {
    return (
      fs.existsSync(GEMINI_SESSIONS_PATH) ||
      fs.existsSync(GEMINI_HOME) ||
      fs.existsSync(ANTIGRAVITY_ACCOUNTS_PATH) ||
      fs.existsSync(ANTIGRAVITY_GUI_PATH)
    );
  },

  async readCredentials(_ctx: AgentFetchContext): Promise<AgentCredentials> {
    return readGeminiCredentials();
  },

  async parseSessions(options: SessionParseOptions, ctx: AgentFetchContext): Promise<SessionUsageData[]> {
    return parseSessionsFromProjects(options, ctx);
  },

  startActivityWatch(_ctx: PluginContext, callback): void {
    startActivityWatch(callback);
  },

  stopActivityWatch(_ctx: PluginContext): void {
    stopActivityWatch();
  },
});

export {
  ANTIGRAVITY_ACCOUNTS_PATH,
  CACHE_TTL_MS,
  GEMINI_HOME,
  GEMINI_OAUTH_CREDS_PATH,
  GEMINI_SESSIONS_PATH,
  RECONCILIATION_INTERVAL_MS,
  SESSION_AGGREGATE_CACHE_MAX,
  sessionAggregateCache,
  sessionCache,
  sessionMetadataIndex,
};

export default geminiAgentPlugin;
