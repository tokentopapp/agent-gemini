# @tokentop/agent-gemini

[![npm](https://img.shields.io/npm/v/@tokentop/agent-gemini?style=flat-square&color=CB3837&logo=npm)](https://www.npmjs.com/package/@tokentop/agent-gemini)
[![CI](https://img.shields.io/github/actions/workflow/status/tokentopapp/agent-gemini/ci.yml?style=flat-square&label=CI)](https://github.com/tokentopapp/agent-gemini/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue?style=flat-square)](LICENSE)

[tokentop](https://github.com/tokentopapp/tokentop) agent plugin for **Gemini** — the canonical plugin for all tools built on Google's `gemini-cli-core` session format, including [Gemini CLI](https://github.com/google-gemini/gemini-cli) and Antigravity.

## Capabilities

| Capability | Status |
|-----------|--------|
| Session parsing | Yes |
| Credential reading | Yes |
| Real-time tracking | Yes |
| Multi-provider | No |

## What This Plugin Does

- **Parses Gemini sessions** from `~/.gemini/tmp/<project-hash>/chats/*.json`
- **Extracts token usage** (input, output, cached, thoughts) per message
- **Watches for real-time activity** via filesystem watchers with dirty-path optimization
- **Reads credentials** from both `~/.gemini/oauth_creds.json` (Gemini CLI) and `~/.config/opencode/antigravity-accounts.json` (Antigravity)
- **Two-layer caching** — TTL-based result cache + per-session LRU aggregate cache

## Supported Tools

This plugin covers any tool that writes the `ConversationRecord` JSON format to `~/.gemini/tmp/`:

| Tool | Detected |
|------|----------|
| [Gemini CLI](https://github.com/google-gemini/gemini-cli) | Yes |
| Antigravity IDE | Yes |
| Any `gemini-cli-core` consumer | Yes |

## Install

This plugin is **bundled with tokentop** — no separate install needed. If you need it standalone:

```bash
bun add @tokentop/agent-gemini
```

## Requirements

- [Gemini CLI](https://github.com/google-gemini/gemini-cli) or Antigravity installed
- [Bun](https://bun.sh/) >= 1.0.0
- `@tokentop/plugin-sdk` ^1.0.0 (peer dependency)

## Permissions

| Type | Access | Paths |
|------|--------|-------|
| Filesystem | Read | `~/.gemini` |

## Replaces

This plugin supersedes both `@tokentop/agent-gemini-cli` and `@tokentop/agent-antigravity`. Both read from the same `~/.gemini/tmp` directory with identical session formats — there is no way to distinguish which tool created a given session file.

## Development

```bash
bun install
bun run build
bun test
bun run typecheck
```

## Contributing

See the [Contributing Guide](https://github.com/tokentopapp/.github/blob/main/CONTRIBUTING.md). Issues for this plugin should be [filed on the main tokentop repo](https://github.com/tokentopapp/tokentop/issues/new?template=bug_report.yml&labels=bug,agent-gemini).

## License

MIT
