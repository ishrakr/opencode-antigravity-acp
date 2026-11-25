# Contributing to `opencode-antigravity-acp`

Thanks for your interest in contributing!

## Development Setup

1. Clone the repository and install dependencies with [Bun](https://bun.sh):

   ```bash
   git clone https://github.com/ishrakr/opencode-antigravity-acp.git
   cd opencode-antigravity-acp
   bun install
   ```

2. Run checks:

   ```bash
   bun run typecheck
   bun test
   bun run build:gui
   bun run build:cli
   ```

3. Test locally in OpenCode by placing or symlinking the repo into `~/.config/opencode/plugins/opencode-antigravity-acp`, then running:

   ```bash
   opencode service restart
   ```

   Rebuild and commit the bundles when their sources change: `bun run build:gui` for `src/gui.tsx` (`dist/gui-experimental.cjs`), and `bun run build:cli` for `src/cli.ts`, `src/accounts.ts` or what they import (`bin/agy-accounts.js`). CI fails when either is out of date.

## Non-Negotiable Architecture & Safety Rules

Pull requests **must** preserve these core invariants:

- **Official ACP only:** Never extract OAuth tokens from Antigravity storage, spoof client headers, or call private Cloud Code HTTP endpoints directly.
- **Antigravity is the agent:** Never send OpenCode's system prompt, agents, skills or tools to `agy acp`, and never attach MCP servers to its sessions.
- **No replay:** Send only the latest user message and its attachments. Never send earlier turns, and never hand `agy` a conversation another model took part in. Two exceptions hand a fresh `agy` session the kept Antigravity conversation once (`src/rewind-guard.ts`): a rewind or edit in OpenCode, and the user moving a session to another Antigravity account.
- **User-chosen accounts only:** A session runs on the account whose model the user picked. Never switch, rotate or pool accounts automatically, for example on a quota error.
- **Selected sign-in only:** Use exactly the sign-in method the user configured. Never fall back to another method or read ambient `GEMINI_API_KEY` / `GOOGLE_*` credentials.
- **Interactive turns only:** Don't send OpenCode's auxiliary requests (compaction, generate, title) to `agy`, and don't add automation that prompts `agy` without the user.
- **Fail-fast on upstream errors:** Do not add automatic retry loops on `429` / quota / permission errors, and never emit retryable stream errors on plugin unload.
- **Zero overhead for non-ACP models:** Do not eagerly spawn `agy acp` or attach global SSE event streams when other OpenCode providers are in use.
- **Keep `dist/gui-experimental.cjs` updated:** OpenCode loads the prebuilt CommonJS GUI bundle directly.

## Submitting Changes

1. Fork the repository and create a topic branch (`git checkout -b fix/my-change`).
2. Add or update unit tests in `test/` for your changes.
3. Ensure `bun run typecheck`, `bun test`, `bun run build:gui` and `bun run build:cli` all pass.
4. Open a pull request with a clear summary of what changed and how it was tested.

## Releasing

Releases publish to npm automatically — no tokens, no 2FA prompts:

1. Bump the version in `package.json` and `src/acp-client.ts` (`clientInfo.version`) so both match.
2. Commit, then tag and push: `git tag vX.Y.Z && git push origin main vX.Y.Z` (the tag must equal `package.json` `version`, or CI fails loudly).
3. The `publish` workflow runs `typecheck` + `test` + `build:gui` + `build:cli` and checks the committed bundles, then `npm publish --provenance` via OIDC trusted publishing.

One-time setup (repo owner only): on npmjs.com, open the package Settings → Trusted Publisher and add this GitHub repository. After that, publishing needs no stored secrets.
