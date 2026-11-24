# Security Policy

## Architecture Threat Model

`opencode-antigravity-acp` runs entirely locally on your machine:

- **Stdio child process:** Spawns Google's official `agy acp --stdio --process-per-session` binary as the current user. No network listener is opened.
- **Credentials:** `agy` keeps its own Google sign-in. An API key set in the plugin's options or `ANTIGRAVITY_ACP_*` variables is passed only to the `agy` process, through its environment; ambient `GEMINI_API_KEY` / `GOOGLE_*` variables are removed from that environment.
- **Prompt boundary:** Only the user's latest message and attachments are sent to `agy`; OpenCode's system prompt, tools and earlier turns are not. After a rewind or edit, the new `agy` session receives the kept conversation once.
- **Attachments on disk:** PDFs are written with mode `0600` under a `0700` per-session folder in the plugin's state directory, which is the only extra directory given to `agy` (`--add-dir`). They are deleted when the session is reset or deleted.

## Reporting a Vulnerability

If you discover a security issue (such as credential exposure or cross-session leakage), please avoid posting sensitive details in a public issue. Open a private security advisory on GitHub (`Security` -> `Advisories` -> `Report a vulnerability`) or contact the maintainer directly.
