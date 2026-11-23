# Antigravity quota for OpenChamber

An OpenChamber extension that adds an **Antigravity** card to the Usage page, the header and Work Status: the 5-hour and weekly limits of each Antigravity model group (Gemini, Claude & GPT), with reset times.

It reads the quota from the Antigravity CLI's own `/quota` command (`agy -p "/quota" --output-format json`), with your existing `agy` login. It reads no tokens, calls no Google endpoint itself, and runs no model turn. Each read starts `agy` once (about 2 seconds); a good reading is reused for a minute.

## Install

1. Install and sign in to `agy` (`agy --version` works). If OpenChamber can't find it, set `AGY_BIN`; `~/.local/bin`, `/opt/homebrew/bin` and `/usr/local/bin` are checked automatically.
2. In OpenChamber, open **Settings → Extensions**, add this folder (`openchamber-quota`), and allow the local service. The dialog says it runs `agy`; it receives no OpenCode credentials.
3. Open **Settings → Usage**. The Antigravity card appears after the built-in providers. Tick **Show in Work Status** to see it in the header.

The built-in Antigravity card in OpenChamber reads a different account file (`antigravity-accounts.json`) and stays "Not configured" for `agy` logins; this extension is the one that works with `agy`.

## Develop

```bash
bun install
bun x tsc --noEmit
bun test test
bun run build   # writes service/main.js, which is committed
```
