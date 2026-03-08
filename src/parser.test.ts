import { describe, test, expect } from 'bun:test';
import {
  isTokenBearingGeminiMessage,
  toTimestamp,
  parseSessionFileRows,
} from './parser.ts';
import type { GeminiConversationRecord, GeminiTokenBearingMessage } from './types.ts';

function makeGeminiMessage(overrides?: {
  id?: string;
  model?: string;
  input?: number;
  output?: number;
  cached?: number;
  thoughts?: number;
  tool?: number;
  total?: number;
  timestamp?: string;
}): GeminiTokenBearingMessage {
  const input = overrides?.input ?? 1500;
  const output = overrides?.output ?? 250;
  const cached = overrides?.cached ?? 0;
  const total = overrides?.total ?? (input + output + cached);
  return {
    type: 'gemini',
    id: overrides?.id ?? 'msg-001',
    timestamp: overrides?.timestamp ?? '2026-03-01T10:00:00.000Z',
    content: [{ text: 'Hello from Gemini' }],
    model: overrides?.model ?? 'gemini-2.5-flash',
    tokens: {
      input,
      output,
      cached,
      thoughts: overrides?.thoughts ?? 0,
      tool: overrides?.tool ?? 0,
      total,
    },
  };
}

function makeRecord(overrides?: {
  sessionId?: string;
  projectHash?: string;
  startTime?: string;
  lastUpdated?: string;
  messages?: unknown[];
  summary?: string;
  directories?: string[];
  kind?: 'main' | 'subagent';
}): GeminiConversationRecord {
  return {
    sessionId: overrides?.sessionId ?? 'session-abc123',
    projectHash: overrides?.projectHash ?? 'abc123hash',
    startTime: overrides?.startTime ?? '2026-03-01T09:00:00.000Z',
    lastUpdated: overrides?.lastUpdated ?? '2026-03-01T10:30:00.000Z',
    messages: (overrides?.messages ?? [makeGeminiMessage()]) as GeminiConversationRecord['messages'],
    summary: overrides?.summary,
    directories: overrides?.directories,
    kind: overrides?.kind,
  };
}

function breakType(msg: GeminiTokenBearingMessage, dotPath: string, value: unknown): unknown {
  const clone = JSON.parse(JSON.stringify(msg)) as Record<string, unknown>;
  const parts = dotPath.split('.');
  let target = clone;
  for (let i = 0; i < parts.length - 1; i++) {
    target = target[parts[i]!] as Record<string, unknown>;
  }
  target[parts[parts.length - 1]!] = value;
  return clone;
}

// -----------------------------------------------------------------------
// isTokenBearingGeminiMessage
// -----------------------------------------------------------------------

describe('isTokenBearingGeminiMessage', () => {
  test('accepts a valid Gemini message', () => {
    expect(isTokenBearingGeminiMessage(makeGeminiMessage())).toBe(true);
  });

  test('rejects null and undefined', () => {
    expect(isTokenBearingGeminiMessage(null)).toBe(false);
    expect(isTokenBearingGeminiMessage(undefined)).toBe(false);
  });

  test('rejects non-object types', () => {
    expect(isTokenBearingGeminiMessage(42)).toBe(false);
    expect(isTokenBearingGeminiMessage('gemini')).toBe(false);
    expect(isTokenBearingGeminiMessage(true)).toBe(false);
  });

  test('rejects entries with wrong type field', () => {
    expect(isTokenBearingGeminiMessage({ type: 'user', id: 'x', tokens: {} })).toBe(false);
    expect(isTokenBearingGeminiMessage({ type: 'info', id: 'x', tokens: {} })).toBe(false);
    expect(isTokenBearingGeminiMessage({ type: 'error', id: 'x', tokens: {} })).toBe(false);
  });

  test('rejects entries without tokens object', () => {
    expect(isTokenBearingGeminiMessage({ type: 'gemini', id: 'x' })).toBe(false);
    expect(isTokenBearingGeminiMessage({ type: 'gemini', id: 'x', tokens: 'not-obj' })).toBe(false);
    expect(isTokenBearingGeminiMessage({ type: 'gemini', id: 'x', tokens: null })).toBe(false);
  });

  test('rejects entries with empty or missing id', () => {
    expect(isTokenBearingGeminiMessage(makeGeminiMessage({ id: '' }))).toBe(false);
    expect(isTokenBearingGeminiMessage(breakType(makeGeminiMessage(), 'id', undefined))).toBe(false);
    expect(isTokenBearingGeminiMessage(breakType(makeGeminiMessage(), 'id', 42))).toBe(false);
  });

  test('rejects entries with input <= 0', () => {
    expect(isTokenBearingGeminiMessage(makeGeminiMessage({ input: 0 }))).toBe(false);
    expect(isTokenBearingGeminiMessage(makeGeminiMessage({ input: -1 }))).toBe(false);
  });

  test('rejects entries with non-number output', () => {
    expect(isTokenBearingGeminiMessage(breakType(makeGeminiMessage(), 'tokens.output', 'bad'))).toBe(false);
    expect(isTokenBearingGeminiMessage(breakType(makeGeminiMessage(), 'tokens.output', undefined))).toBe(false);
  });

  test('rejects entries with non-number total', () => {
    expect(isTokenBearingGeminiMessage(breakType(makeGeminiMessage(), 'tokens.total', 'bad'))).toBe(false);
    expect(isTokenBearingGeminiMessage(breakType(makeGeminiMessage(), 'tokens.total', undefined))).toBe(false);
  });

  test('accepts entries with output = 0', () => {
    expect(isTokenBearingGeminiMessage(makeGeminiMessage({ output: 0 }))).toBe(true);
  });

  test('accepts entries with cached > 0', () => {
    expect(isTokenBearingGeminiMessage(makeGeminiMessage({ cached: 5000 }))).toBe(true);
  });

  test('accepts entries with thoughts and tool tokens', () => {
    expect(isTokenBearingGeminiMessage(makeGeminiMessage({ thoughts: 100, tool: 50 }))).toBe(true);
  });

  test('accepts entries with NaN-safe numeric fields', () => {
    expect(isTokenBearingGeminiMessage(breakType(makeGeminiMessage(), 'tokens.input', NaN))).toBe(false);
    expect(isTokenBearingGeminiMessage(breakType(makeGeminiMessage(), 'tokens.output', NaN))).toBe(false);
  });
});

// -----------------------------------------------------------------------
// toTimestamp
// -----------------------------------------------------------------------

describe('toTimestamp', () => {
  test('parses valid ISO 8601 string', () => {
    expect(toTimestamp('2026-03-01T10:00:00.000Z', 0)).toBe(Date.parse('2026-03-01T10:00:00.000Z'));
  });

  test('returns fallback for undefined', () => {
    expect(toTimestamp(undefined, 999)).toBe(999);
  });

  test('returns fallback for empty string', () => {
    expect(toTimestamp('', 999)).toBe(999);
  });

  test('returns fallback for invalid date string', () => {
    expect(toTimestamp('not-a-date', 42)).toBe(42);
  });

  test('handles date-only strings', () => {
    const ts = toTimestamp('2026-03-01', 0);
    expect(Number.isFinite(ts)).toBe(true);
    expect(ts).toBeGreaterThan(0);
  });

  test('handles timestamps with timezone offset', () => {
    const ts = toTimestamp('2026-03-01T10:00:00-05:00', 0);
    expect(Number.isFinite(ts)).toBe(true);
    expect(ts).toBe(Date.parse('2026-03-01T10:00:00-05:00'));
  });
});

// -----------------------------------------------------------------------
// parseSessionFileRows
// -----------------------------------------------------------------------

describe('parseSessionFileRows', () => {
  const MTIME = Date.now();
  const FILE_PATH = '/Users/test/.gemini/tmp/abc123/chats/session-abc123.json';

  test('parses a single valid message into one usage row', async () => {
    const record = makeRecord({ messages: [makeGeminiMessage({ input: 1500, output: 250 })] });
    const rows = await parseSessionFileRows(record, MTIME, FILE_PATH);

    expect(rows).toHaveLength(1);
    expect(rows[0]!.tokens.input).toBe(1500);
    expect(rows[0]!.tokens.output).toBe(250);
  });

  test('sets providerId to google', async () => {
    const record = makeRecord();
    const rows = await parseSessionFileRows(record, MTIME, FILE_PATH);
    expect(rows[0]!.providerId).toBe('google');
  });

  test('sets modelId from message', async () => {
    const record = makeRecord({ messages: [makeGeminiMessage({ model: 'gemini-3-pro-preview' })] });
    const rows = await parseSessionFileRows(record, MTIME, FILE_PATH);
    expect(rows[0]!.modelId).toBe('gemini-3-pro-preview');
  });

  test('uses "unknown" when model is missing', async () => {
    const msg = makeGeminiMessage();
    msg.model = undefined;
    const record = makeRecord({ messages: [msg] });
    const rows = await parseSessionFileRows(record, MTIME, FILE_PATH);
    expect(rows[0]!.modelId).toBe('unknown');
  });

  test('sets cacheRead when cached > 0', async () => {
    const record = makeRecord({ messages: [makeGeminiMessage({ cached: 5000 })] });
    const rows = await parseSessionFileRows(record, MTIME, FILE_PATH);
    expect(rows[0]!.tokens.cacheRead).toBe(5000);
  });

  test('omits cacheRead when cached is 0', async () => {
    const record = makeRecord({ messages: [makeGeminiMessage({ cached: 0 })] });
    const rows = await parseSessionFileRows(record, MTIME, FILE_PATH);
    expect(rows[0]!.tokens.cacheRead).toBeUndefined();
  });

  test('sets sessionName from record summary', async () => {
    const record = makeRecord({ summary: 'Fix auth middleware', messages: [makeGeminiMessage()] });
    const rows = await parseSessionFileRows(record, MTIME, FILE_PATH);
    expect(rows[0]!.sessionName).toBe('Fix auth middleware');
  });

  test('omits sessionName when summary is absent', async () => {
    const record = makeRecord({ messages: [makeGeminiMessage()] });
    const rows = await parseSessionFileRows(record, MTIME, FILE_PATH);
    expect(rows[0]!.sessionName).toBeUndefined();
  });

  test('omits sessionName when summary is whitespace-only', async () => {
    const record = makeRecord({ summary: '   ', messages: [makeGeminiMessage()] });
    const rows = await parseSessionFileRows(record, MTIME, FILE_PATH);
    expect(rows[0]!.sessionName).toBeUndefined();
  });

  test('sets projectPath from directories field', async () => {
    const record = makeRecord({
      directories: ['/Users/test/my-project'],
      messages: [makeGeminiMessage()],
    });
    const rows = await parseSessionFileRows(record, MTIME, FILE_PATH);
    expect(rows[0]!.projectPath).toBe('/Users/test/my-project');
  });

  test('sets sessionId and sessionUpdatedAt', async () => {
    const record = makeRecord({ sessionId: 'session-xyz789' });
    const rows = await parseSessionFileRows(record, MTIME, FILE_PATH);
    expect(rows[0]!.sessionId).toBe('session-xyz789');
    expect(rows[0]!.sessionUpdatedAt).toBe(MTIME);
  });

  test('parses timestamp from message', async () => {
    const ts = '2026-03-01T10:00:00.000Z';
    const record = makeRecord({ messages: [makeGeminiMessage({ timestamp: ts })] });
    const rows = await parseSessionFileRows(record, MTIME, FILE_PATH);
    expect(rows[0]!.timestamp).toBe(Date.parse(ts));
  });

  test('falls back to record startTime when message timestamp is invalid', async () => {
    const msg = makeGeminiMessage();
    (msg as unknown as Record<string, unknown>).timestamp = 'garbage';
    const record = makeRecord({
      startTime: '2026-03-01T09:00:00.000Z',
      messages: [msg],
    });
    const rows = await parseSessionFileRows(record, MTIME, FILE_PATH);
    expect(rows[0]!.timestamp).toBe(Date.parse('2026-03-01T09:00:00.000Z'));
  });

  test('falls back to mtime when both timestamps are invalid', async () => {
    const msg = makeGeminiMessage();
    (msg as unknown as Record<string, unknown>).timestamp = '';
    const record = makeRecord({
      startTime: '',
      messages: [msg],
    });
    const rows = await parseSessionFileRows(record, MTIME, FILE_PATH);
    expect(rows[0]!.timestamp).toBe(MTIME);
  });

  test('deduplicates by message id, keeping last entry', async () => {
    const record = makeRecord({
      messages: [
        makeGeminiMessage({ id: 'msg-001', output: 10 }),
        makeGeminiMessage({ id: 'msg-001', output: 50 }),
        makeGeminiMessage({ id: 'msg-001', output: 250 }),
      ],
    });
    const rows = await parseSessionFileRows(record, MTIME, FILE_PATH);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.tokens.output).toBe(250);
  });

  test('handles multiple distinct messages', async () => {
    const record = makeRecord({
      messages: [
        makeGeminiMessage({ id: 'msg-001', output: 100 }),
        makeGeminiMessage({ id: 'msg-002', output: 200 }),
        makeGeminiMessage({ id: 'msg-003', output: 300 }),
      ],
    });
    const rows = await parseSessionFileRows(record, MTIME, FILE_PATH);
    expect(rows).toHaveLength(3);
    expect(rows.find(r => r.tokens.output === 100)).toBeDefined();
    expect(rows.find(r => r.tokens.output === 200)).toBeDefined();
    expect(rows.find(r => r.tokens.output === 300)).toBeDefined();
  });

  test('handles streaming duplicates across multiple message ids', async () => {
    const record = makeRecord({
      messages: [
        makeGeminiMessage({ id: 'msg-001', output: 5 }),
        makeGeminiMessage({ id: 'msg-001', output: 100 }),
        makeGeminiMessage({ id: 'msg-002', output: 3 }),
        makeGeminiMessage({ id: 'msg-002', output: 200 }),
      ],
    });
    const rows = await parseSessionFileRows(record, MTIME, FILE_PATH);
    expect(rows).toHaveLength(2);
    expect(rows.find(r => r.tokens.output === 100)).toBeDefined();
    expect(rows.find(r => r.tokens.output === 200)).toBeDefined();
  });

  test('skips non-gemini messages', async () => {
    const record = makeRecord({
      messages: [
        { type: 'user', id: 'u1', timestamp: '2026-03-01T10:00:00Z', content: 'hello' },
        makeGeminiMessage(),
        { type: 'info', id: 'i1', timestamp: '2026-03-01T10:01:00Z', content: 'info msg' },
      ],
    });
    const rows = await parseSessionFileRows(record, MTIME, FILE_PATH);
    expect(rows).toHaveLength(1);
  });

  test('skips entries failing type guard (zero input)', async () => {
    const record = makeRecord({
      messages: [
        makeGeminiMessage({ input: 0 }),
        makeGeminiMessage({ id: 'msg-valid', input: 500 }),
      ],
    });
    const rows = await parseSessionFileRows(record, MTIME, FILE_PATH);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.tokens.input).toBe(500);
  });

  test('returns empty array for empty messages', async () => {
    const record = makeRecord({ messages: [] });
    const rows = await parseSessionFileRows(record, MTIME, FILE_PATH);
    expect(rows).toEqual([]);
  });

  test('returns empty array when no valid entries exist', async () => {
    const record = makeRecord({
      messages: [
        { type: 'user', id: 'u1', timestamp: '2026-03-01T10:00:00Z', content: 'hello' },
        { type: 'info', id: 'i1', timestamp: '2026-03-01T10:01:00Z', content: 'status' },
      ],
    });
    const rows = await parseSessionFileRows(record, MTIME, FILE_PATH);
    expect(rows).toEqual([]);
  });

  test('real-world multi-turn session with caching matches expected token breakdown', async () => {
    const record = makeRecord({
      sessionId: 'session-realworld',
      messages: [
        // Turn 1: streaming duplicates
        makeGeminiMessage({ id: 'msg-t1', input: 1000, output: 50, cached: 5000, total: 6050 }),
        makeGeminiMessage({ id: 'msg-t1', input: 1000, output: 100, cached: 5000, total: 6100 }),
        makeGeminiMessage({ id: 'msg-t1', input: 1000, output: 150, cached: 5000, total: 6150 }),
        // Turn 2: no caching
        makeGeminiMessage({ id: 'msg-t2', input: 2000, output: 300, cached: 0, total: 2300 }),
        makeGeminiMessage({ id: 'msg-t2', input: 2000, output: 400, cached: 0, total: 2400 }),
        // Turn 3: heavy caching
        makeGeminiMessage({ id: 'msg-t3', input: 500, output: 1000, cached: 50000, total: 51500 }),
      ],
    });

    const rows = await parseSessionFileRows(record, MTIME, FILE_PATH);
    expect(rows).toHaveLength(3);

    // Turn 1: last streaming entry wins
    const turn1 = rows.find(r => r.tokens.output === 150)!;
    expect(turn1.tokens.input).toBe(1000);
    expect(turn1.tokens.cacheRead).toBe(5000);
    expect(turn1.providerId).toBe('google');

    // Turn 2: no cache
    const turn2 = rows.find(r => r.tokens.output === 400)!;
    expect(turn2.tokens.input).toBe(2000);
    expect(turn2.tokens.cacheRead).toBeUndefined();

    // Turn 3: heavy cache
    const turn3 = rows.find(r => r.tokens.output === 1000)!;
    expect(turn3.tokens.input).toBe(500);
    expect(turn3.tokens.cacheRead).toBe(50000);

    // Aggregates
    const totalInput = rows.reduce((sum, r) => sum + r.tokens.input, 0);
    expect(totalInput).toBe(3500);

    const totalCacheRead = rows.reduce((sum, r) => sum + (r.tokens.cacheRead ?? 0), 0);
    expect(totalCacheRead).toBe(55000);
  });

  test('handles subagent kind sessions the same as main sessions', async () => {
    const record = makeRecord({
      kind: 'subagent',
      messages: [makeGeminiMessage({ id: 'sub-msg-1', input: 800, output: 100 })],
    });
    const rows = await parseSessionFileRows(record, MTIME, FILE_PATH);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.tokens.input).toBe(800);
  });
});
