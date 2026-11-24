# opencode-antigravity-acp

[![npm](https://img.shields.io/npm/v/@ishrakr/opencode-antigravity-acp.svg)](https://www.npmjs.com/package/@ishrakr/opencode-antigravity-acp)
[![CI](https://github.com/ishrakr/opencode-antigravity-acp/actions/workflows/ci.yml/badge.svg)](https://github.com/ishrakr/opencode-antigravity-acp/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](./LICENSE)

Use **Google Antigravity** as the agent inside **OpenCode Desktop & CLI**, the way T3 Code and Zed run it: OpenCode starts Google's official `agy acp` server and shows its replies, tool calls, diffs and questions. Antigravity owns the conversation, its tools and its sign-in.

![Antigravity ACP running Gemini 4 Hydrogen in OpenCode Desktop](./assets/screenshot.jpg)

---

## How it works

This plugin is an [Agent Client Protocol](https://agentclientprotocol.com) client, like the editors on Google's [Other editors (ACP)](https://antigravity.google/docs/ide/extensions/acp) page. It starts the unmodified `agy acp --stdio --process-per-session` binary and talks to it over stdio. It never reads Antigravity's stored credentials, never calls Google's HTTP endpoints itself and never changes `agy`'s headers.

Like T3 Code's Antigravity provider:

- **Antigravity is the agent.** OpenCode's system prompt, agents, skills and tools never reach `agy`. Antigravity uses its own tools, rules, MCP servers and settings, as it does in the terminal.
- **Only your message is sent.** Each turn sends your latest message and its attachments. Antigravity keeps the conversation itself and resumes it with `session/resume`; earlier turns are never sent again.
- **Rewinds start over.** If you revert, undo or edit messages in OpenCode, Antigravity's copy no longer matches. The next turn starts a new Antigravity session and gives it the conversation you kept, as T3 Code does after a rollback, and says so in the reply.
- **One provider per session.** A session that already has replies from another OpenCode model stays with that model: start a new session to use Antigravity. Switching between Antigravity models keeps the conversation, through `agy`'s own model option.
- **Your sign-in, never another.** The plugin uses the sign-in method you select and never falls back to a different one. Ambient `GEMINI_API_KEY` and `GOOGLE_*` variables are ignored.
- **OpenCode doesn't add work.** OpenCode's compaction and background requests aren't sent to `agy`. Send `/compact` to have Antigravity compact its own conversation.

### Terms of Service

Google's [Antigravity Terms](https://antigravity.google/terms) and [FAQ](https://antigravity.google/docs/faq#why-cant-i-use-third-party-software-such-as-claude-code-openclaw-or-opencode-with-my-antigravity-login) restrict third-party software that uses an Antigravity login. Google's CLI team has said that connecting an ACP client such as Zed, JetBrains or T3 Code to the official `agy acp` server for single-user, interactive sessions is supported, and that extracting or proxying OAuth tokens into third-party agents, wrapping `agy -p` in autonomous agents, and multi-account pooling are not ([antigravity-cli#1411](https://github.com/google-antigravity/antigravity-cli/issues/1411)). The FAQ still names OpenCode, though, so this is not an official statement that this plugin is allowed.

Use it for your own interactive sessions, on one account. For unattended automation, or to avoid the question entirely, select the **Gemini API key** or **Agent Platform** sign-in method. You are responsible for following Google's terms; every request uses your account and its quota.

---

## Sign-in

Set the method in the plugin's options in `opencode.json(c)`:

```jsonc
{
  "plugins": [
    {
      "package": "@ishrakr/opencode-antigravity-acp",
      "options": { "authMethod": "oauth-personal" }
    }
  ]
}
```

| `authMethod` | What it uses | Options |
| :--- | :--- | :--- |
| `oauth-personal` *(default)* | Your personal Google account, signed in with `agy` | none |
| `oauth-business` | Gemini Enterprise, signed in with `agy` | `gcpProject`, `gcpLocation` |
| `gemini-api-key` | A Gemini API key | `apiKey` |
| `agent-platform` | Agent Platform (Vertex AI) | `apiKey`, or `gcpProject` + `gcpLocation` with Application Default Credentials |

The same values can come from `ANTIGRAVITY_ACP_AUTH_METHOD`, `ANTIGRAVITY_ACP_API_KEY`, `ANTIGRAVITY_ACP_GCP_PROJECT` and `ANTIGRAVITY_ACP_GCP_LOCATION`; plugin options win. Keep API keys out of committed config files: use the environment variables. A method missing what it needs stops the plugin from loading with an error, rather than using another method.

For the Google account methods, sign in once with `agy` (or `agy acp --login` over SSH).

---

## Features

- **Antigravity's own tools in OpenCode's UI:** agy's tools appear as `antigravity.read`, `antigravity.edit`, `antigravity.write`, `antigravity.shell` (and so on) with OpenCode-style inputs; edits come back as unified diffs and commands as their output and exit code, so OpenCode and OpenChamber render file paths, diffs and command output.
- **Questions and approvals:** agy's questions use OpenCode's question tool; its permission requests follow the approval mode you pick and OpenCode's permission rules. When `agy` offers an "always allow" choice for a request, OpenCode's **Allow always** appears with `agy`'s security warning; it saves an OpenCode rule for this project, which is broader than T3 Code's "Allow for this thread". `agy` 1.5.15 offers that choice only for some requests, so most show **Allow once** and **Reject** only.
- **Attachments:** images are sent inline and text files (up to 1 MiB) as embedded files. PDFs are copied to `~/.local/state/opencode-antigravity-acp/attachments/<session>/` (or under `$XDG_STATE_HOME`), which `agy` gets with `--add-dir`, and linked; the copies are removed when the session is reset or deleted. Up to 50 MiB per message. `agy` doesn't accept audio, so audio and other files are named in the message only.
- **Token & context usage:** tracks `usage_update` context size and per-turn token usage.
- **Process & session lifecycle:** process-group teardown, stdio guards, `AbortSignal` cancellation, and cleanup when OpenCode sessions are deleted. If `agy` can't resume a session, the plugin starts a new one and says so instead of resending the conversation.
- **Model & reasoning-effort discovery:** reads models from `agy acp` (`session/new` `configOptions` + `models.availableModels`), caches them for 6 hours, and lists each with its reasoning efforts. Without a reasoning effort selected, a model uses `agy`'s default (currently High). Families T3 Code lists as legacy (Gemini 3.7 Flash, 3.6 Flash, 3.1 Pro, Gemini Pro Agent) are hidden from the model picker while `agy` still offers them. A model or effort `agy` no longer offers ends the turn with an error instead of running a different model.
- **No cost for other models:** `agy acp` starts only when an `antigravity-acp/*` model is used.
- **Desktop controls:** an `ACP` pill above the composer for approval modes, the sign-in method in use, and model refresh. Selecting an Antigravity model starts `agy acp` in the background, so the pill moves `Standby` → `Starting...` → `Connected` before the first message.

---

## Safety Guardrails & Honest Risks

### Built-in Guardrails

1. **No token extraction or spoofing:** never reads Antigravity's credential storage or changes `agy`'s headers or binary.
2. **Nothing from OpenCode's agent:** `input.system = []` and `input.tools` is reduced to OpenCode's `question` tool, used only to show agy's questions. No MCP servers are attached and no `appendSystemPrompt` is passed to `session/new` / `session/resume`.
3. **No replay:** only the latest user message and its attachments are sent. A session with another model's replies is refused, not handed over. After a rewind, the new `agy` session gets the conversation you kept, once.
4. **Fail-fast circuit breaker:** detects upstream API/quota errors (`RESOURCE_EXHAUSTED`, `code 429`, `code 403`, `PERMISSION_DENIED`, `API error (attempt N)`), cancels `agy acp` immediately, trips a persisted 60-second cooldown, and skips automatic replay after server restarts.
5. **Clean plugin disable / reload:** disposing mid-turn ends the stream without a retryable error, so OpenCode doesn't enter retry loops.

### Honest Risks to Know

- **Not zero-risk:** Every request runs against your real Antigravity account and shares its quota. Google's terms, rate limits and `agy acp` flags can change at any time.
- **Local CLI requirement:** Requires `agy` installed, and signed in for the Google account methods.
- **GUI surface stability:** The Desktop popover uses OpenCode v2's `gui-experimental` API (`@opencode/plugin/gui`), which is marked experimental by OpenCode and may evolve in future OpenCode releases.

---

## Prerequisites

1. **OpenCode** `>= 2.3.2`
2. **Antigravity CLI (`agy`)** installed (`agy --version` should work), and signed in for the Google account methods
   - If OpenCode Desktop launches from a GUI menu without `~/.local/bin` or `/opt/homebrew/bin` in `PATH`, the plugin automatically probes common install paths and also supports setting `AGY_BIN=/path/to/agy`.

---

## Installation

### Option 1: Install via OpenCode CLI (Recommended)

```bash
opencode plugin add @ishrakr/opencode-antigravity-acp
opencode service restart
```

*(You can also install directly from GitHub via `opencode plugin add github:ishrakr/opencode-antigravity-acp`.)*

### Option 2: Clone into OpenCode's Auto-Discovered Plugin Folder

OpenCode v2 automatically discovers local plugins placed under `~/.config/opencode/plugins/` (no build step required — the compiled `dist/gui-experimental.cjs` bundle is included):

```bash
git clone https://github.com/ishrakr/opencode-antigravity-acp ~/.config/opencode/plugins/opencode-antigravity-acp
opencode service restart
```

After restarting the OpenCode service, press `Ctrl+R` in OpenCode Desktop (if already open) and select any model under **Antigravity (ACP)** in the model picker.

---

## Controls & Slash Commands

When an **Antigravity (ACP)** model is active, an **`ACP`** pill appears above the composer:

- **Approval mode:**
  - `Auto` — Approves edits and shell commands automatically.
  - `Accept edits` — Approves file edits; prompts before shell commands.
  - `Ask` — Prompts before file edits and shell commands.
  - `Plan` — Creates a plan before executing changes.
- **Sign-in:** the chip in the popover shows the method in use, such as `Google account`.
- **Actions & Slash commands:**
  - `/agy-reset` — Disposes and resets the active Antigravity ACP session for the current session (background command).
  - `/agy-reload` — Forces live model & reasoning-effort discovery from `agy acp` and reloads providers.

---

## Quota in OpenChamber

[`openchamber-quota/`](./openchamber-quota) is an OpenChamber extension that shows your Antigravity 5-hour and weekly limits per model group in an **Antigravity** section of Work Status, and in a notification when you type `/agy-quota` in the chat box. It reads them from `agy`'s own `/quota` command, using your existing `agy` login, and runs no model turn. Add the folder in **Settings → Extensions** and allow its local service.

---

## Development

```bash
bun install
bun run typecheck
bun test
bun run build:gui
```

## Contributing & Security

- See [CONTRIBUTING.md](./CONTRIBUTING.md) for development workflow and safety invariants.
- See [SECURITY.md](./SECURITY.md) for the security model and reporting guidelines.

## License

[MIT](./LICENSE) © system1970
