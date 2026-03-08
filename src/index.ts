import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {
  createAgentPlugin,
  type PluginContext,
  type AgentFetchContext,
  type SessionParseOptions,
  type SessionUsageData,
} from '@tokentop/plugin-sdk';

export const GEMINI_HOME = path.join(os.homedir(), '.gemini');
export const GEMINI_SESSIONS_PATH = path.join(GEMINI_HOME, 'tmp');

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
    authReading: false,
    realTimeTracking: true,
    multiProvider: false,
  },

  async isInstalled(_ctx: PluginContext): Promise<boolean> {
    return fs.existsSync(GEMINI_SESSIONS_PATH) || fs.existsSync(GEMINI_HOME);
  },

  async parseSessions(_options: SessionParseOptions, _ctx: AgentFetchContext): Promise<SessionUsageData[]> {
    // Stub — full implementation coming in 1.0.0
    return [];
  },

  startActivityWatch(_ctx: PluginContext, _callback): void {
    // Stub — full implementation coming in 1.0.0
  },

  stopActivityWatch(_ctx: PluginContext): void {
    // Stub — full implementation coming in 1.0.0
  },
});

export default geminiAgentPlugin;
