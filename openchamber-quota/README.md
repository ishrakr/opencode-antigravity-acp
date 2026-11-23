# Antigravity quota for OpenChamber

An OpenChamber extension that shows Antigravity's quota: the remaining 5-hour and weekly limits of each Antigravity model group (Gemini, Claude & GPT), with refill times.

- **Work Status → Antigravity:** its own section. In a session that uses an Antigravity model it lists both groups, the session's group first and marked "this session". In any other session it shrinks to one line, "Not used in this session". (OpenChamber has no way for an extension to hide its section per session; you can hide it for good from the Work Status section chooser.)
- **Settings → Usage:** an Antigravity card with the same figures.

It reads the quota from the Antigravity CLI's own `/quota` command (`agy -p "/quota" --output-format json`), with your existing `agy` login. It reads no tokens, calls no Google endpoint itself, and runs no model turn. Each read starts `agy` once (about 2 seconds); a good reading is reused for a minute.

## Install

1. Install and sign in to `agy` (`agy --version` works). If OpenChamber can't find it, set `AGY_BIN`; `~/.local/bin`, `/opt/homebrew/bin` and `/usr/local/bin` are checked automatically.
2. In OpenChamber, open **Settings → Extensions**, add this folder (`openchamber-quota`), and allow the local service. The dialog says it runs `agy`; it receives no OpenCode credentials.
3. The **Antigravity** section appears in Work Status. On the Usage page, leave **Show in work status panel** off for the Antigravity card: that switch adds Antigravity to the general Usage section in every session, which this section replaces.

The built-in Antigravity card in OpenChamber reads a different account file (`antigravity-accounts.json`) and stays "Not configured" for `agy` logins; this extension is the one that works with `agy`.

## Develop

```bash
bun install
bun x tsc --noEmit
bun test test
bun run build   # writes status/main.js and service/main.js, which are committed
```
