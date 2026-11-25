# Antigravity quota for OpenChamber

An OpenChamber extension that adds an **Antigravity** section to Work Status: the remaining 5-hour and weekly limits of each Antigravity model group (Gemini, Claude & GPT), with refill times.

It shows both groups in every session, always in the same order. In a session that uses an Antigravity model, the other group is dimmed.

With [separate accounts](../README.md#separate-accounts) it lists every account under its name: your normal login as "Main", then each account you added. The order never changes; in an Antigravity session the other accounts are dimmed. An account that isn't signed in shows the command that signs it in. With only your normal login, the section looks as it always did.

It adds no card to Settings → Usage, so Antigravity no longer appears in OpenChamber's general Usage section.

It reads the quota from the Antigravity CLI's own `/quota` command (`agy -p "/quota" --output-format json`), with your existing `agy` login. It reads no tokens, calls no Google endpoint itself, and runs no model turn. Each read starts `agy` once per signed-in account (about 2 seconds and 240 MB each, at most three at a time); a good reading is reused for a minute.

The plugin itself works like T3 Code, which doesn't show Antigravity's subscription quota. This extension is separate and optional: it runs `agy` headless from OpenChamber, which Google's FAQ describes as meant for direct scripting. Leave it out if you want only what T3 Code does. It reads the quota of personal Google logins only; with the API key or Agent Platform sign-in methods there is no Antigravity plan quota to show.

## Install

1. Install and sign in to `agy` (`agy --version` works). If OpenChamber can't find it, set `AGY_BIN`; `~/.local/bin`, `/opt/homebrew/bin` and `/usr/local/bin` are checked automatically.
2. In OpenChamber, open **Settings → Extensions**, add this folder (`openchamber-quota`), and allow the local service. The dialog says it runs `agy`; it receives no OpenCode credentials.
3. The **Antigravity** section appears in Work Status.

After an update that changes what the extension asks for, OpenChamber withdraws the earlier approval: the section asks you to allow the local service again in **Settings → Extensions**.

The built-in Antigravity card in OpenChamber reads a different account file (`antigravity-accounts.json`) and stays "Not configured" for `agy` logins; this extension is the one that works with `agy`.

## Develop

```bash
bun install
bun x tsc --noEmit
bun test test
bun run build   # writes status/main.js, command/main.js and service/main.js, which are committed
```
