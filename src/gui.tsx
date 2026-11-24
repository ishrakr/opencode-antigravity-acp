import {
  For,
  Show,
  createEffect,
  createSignal,
  createUniqueId,
  onCleanup,
  untrack,
  type Accessor,
  type Setter,
} from "solid-js"
import {
  Command,
  ComposerPill,
  Plugin,
  Style,
  type ComposerPillMenuProps,
  type ComposerPillTone,
  type ComposerPillView,
} from "@opencode/plugin/gui"
import { AcpRpc, type AcpMode, type AcpSessionState } from "./rpc.js"

const ACP_PROVIDER_ID = "antigravity-acp"
const ERROR_BACKOFF_MS = 10_000

const MODE_LABELS: Record<AcpMode, string> = {
  auto: "Auto",
  "accept-edits": "Accept edits",
  default: "Ask",
  plan: "Plan",
}

const MODE_OPTIONS: ReadonlyArray<{
  readonly id: AcpMode
  readonly label: string
  readonly detail: string
}> = [
  { id: "auto", label: "Auto", detail: "Approves edits and shell commands automatically." },
  {
    id: "accept-edits",
    label: "Accept edits",
    detail: "Approves file edits; prompts before shell commands.",
  },
  { id: "default", label: "Ask", detail: "Prompts before file edits and shell commands." },
  { id: "plan", label: "Plan", detail: "Creates a plan before executing changes." },
]

function fmtErr(e: unknown): string {
  if (e instanceof Error) return e.message
  if (typeof e === "string") return e
  try {
    const s = JSON.stringify(e)
    return s === undefined ? String(e) : s
  } catch {
    return String(e)
  }
}

const css = `
.agy-pop {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 2px 4px 4px;
  box-sizing: border-box;
  color: var(--v2-text-text-base, #fafafa);
  font-family: var(--v2-font-family-sans, ui-sans-serif, system-ui, -apple-system, sans-serif);
  font-size: 13px;
  line-height: 18px;
  letter-spacing: -0.04px;
  font-variant-numeric: tabular-nums;
}

.agy-status {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 7px 9px;
  border-radius: 7px;
  background: var(--v2-background-bg-base, #161616);
  border: 0.5px solid var(--v2-border-border-muted, rgba(255, 255, 255, 0.08));
}

.agy-status-main {
  display: flex;
  align-items: center;
  gap: 7px;
  min-width: 0;
}

.agy-dot {
  width: 7px;
  height: 7px;
  flex-shrink: 0;
  border-radius: 999px;
  background: var(--v2-text-text-faint, #777777);
}
.agy-dot[data-state="connected"] { background: var(--v2-state-fg-success, #4ade80); }
.agy-dot[data-state="busy"] {
  background: var(--v2-state-fg-info, #60a5fa);
  animation: agy-pulse 1.5s ease-in-out infinite;
}
.agy-dot[data-state="cooldown"] { background: var(--v2-state-fg-warning, #f59e0b); }
.agy-dot[data-state="error"] { background: var(--v2-state-fg-danger, #f87171); }

@keyframes agy-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.42; }
}
:root[data-motion="reduce"] .agy-dot[data-state="busy"] { animation: none; }
@media (prefers-reduced-motion: reduce) {
  .agy-dot[data-state="busy"] { animation: none; }
}

.agy-status-text {
  font-size: 12.5px;
  font-weight: 530;
  color: var(--v2-text-text-base, #fafafa);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.agy-meta-chips {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-shrink: 0;
}

.agy-chip {
  display: inline-flex;
  align-items: center;
  padding: 1px 6px;
  border-radius: 5px;
  background: var(--v2-background-bg-layer-02, #2e2e2e);
  color: var(--v2-text-text-muted, #aeaeae);
  font-size: 11px;
  font-weight: 500;
  line-height: 16px;
  white-space: nowrap;
}

.agy-alert {
  display: flex;
  align-items: flex-start;
  gap: 7px;
  padding: 7px 9px;
  border-radius: 7px;
  font-size: 12px;
  line-height: 16px;
  word-break: break-word;
  border: 0.5px solid var(--v2-state-border-danger, rgba(248, 113, 113, 0.3));
  background: var(--v2-state-bg-danger, rgba(127, 29, 29, 0.35));
  color: var(--v2-state-fg-danger, #fca5a5);
}
.agy-alert[data-tone="warning"] {
  border-color: var(--v2-state-border-warning, rgba(245, 158, 11, 0.35));
  background: var(--v2-state-bg-warning, rgba(120, 53, 15, 0.35));
  color: var(--v2-state-fg-warning, #fcd34d);
}
.agy-alert-icon {
  flex-shrink: 0;
  margin-top: 1px;
}
.agy-alert-body {
  min-width: 0;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.agy-sec {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.agy-sec-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.agy-sec-title {
  font-size: 11px;
  font-weight: 530;
  line-height: 15px;
  color: var(--v2-text-text-faint, #888888);
  user-select: none;
}

.agy-sec-badge {
  font-size: 11px;
  font-weight: 500;
  line-height: 15px;
  color: var(--v2-text-text-muted, #aeaeae);
}

.agy-mode-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 5px;
}

.agy-seg-btn {
  display: inline-flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
  min-block-size: 30px;
  padding: 5px 9px;
  border-radius: 6px;
  border: 0.5px solid var(--v2-border-border-muted, rgba(255, 255, 255, 0.08));
  background: var(--v2-background-bg-base, #161616);
  color: var(--v2-text-text-muted, #aeaeae);
  font-family: inherit;
  font-size: 12.5px;
  font-weight: 480;
  line-height: 16px;
  text-align: left;
  cursor: pointer;
  transition: background-color 100ms ease, border-color 100ms ease, color 100ms ease;
}
.agy-seg-btn:hover:not(:disabled, [aria-pressed="true"]) {
  background: var(--v2-overlay-simple-overlay-hover, rgba(255, 255, 255, 0.06));
  color: var(--v2-text-text-base, #fafafa);
}
.agy-seg-btn[aria-pressed="true"] {
  background: var(--v2-background-bg-layer-02, #2e2e2e);
  border-color: var(--v2-border-border-strong, rgba(255, 255, 255, 0.2));
  color: var(--v2-text-text-base, #fafafa);
  font-weight: 540;
}
.agy-seg-btn[aria-pressed="true"] .agy-check-icon {
  color: var(--v2-state-fg-success, #4ade80);
}
.agy-seg-btn:focus-visible {
  outline: 2px solid var(--v2-border-border-focus, #3b82f6);
  outline-offset: 1px;
}
.agy-seg-btn:disabled {
  opacity: 0.6;
  cursor: default;
}

.agy-hint {
  margin: 0;
  font-size: 11.5px;
  line-height: 15px;
  color: var(--v2-text-text-muted, #9a9a9a);
}

.agy-actions {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 6px;
  padding-top: 8px;
  border-top: 0.5px solid var(--v2-border-border-muted, rgba(255, 255, 255, 0.08));
}

.agy-action-btn {
  width: 100%;
  min-width: 0;
  justify-content: center;
}
`

interface RpcCallOptions {
  readonly location?: { readonly directory: string }
  readonly signal?: AbortSignal
}

interface AcpRpcClient {
  getState(input: { readonly sessionID: string }, options?: RpcCallOptions): Promise<AcpSessionState>
  setMode(
    input: { readonly sessionID: string; readonly mode: AcpMode },
    options?: RpcCallOptions,
  ): Promise<AcpSessionState>
  resetSession(input: { readonly sessionID: string }, options?: RpcCallOptions): Promise<AcpSessionState>
  warmSession(input: { readonly sessionID?: string }, options?: RpcCallOptions): Promise<AcpSessionState>
  reloadModels(
    input: Record<string, never>,
    options?: RpcCallOptions,
  ): Promise<{ readonly modelCount: number }>
}

export default Plugin.define({
  setup(ctx) {
    ctx.add(Style, css)

    const getRpc = () => ctx.client.rpc(AcpRpc) as unknown as AcpRpcClient
    const signals = new Map<string, [Accessor<AcpSessionState | undefined>, Setter<AcpSessionState | undefined>]>()
    const loaded = new Set<string>()
    const inFlight = new Set<string>()
    const failedAt = new Map<string, number>()
    const warmedSessions = new Set<string>()
    const startingPollTimers = new Map<string, ReturnType<typeof setTimeout>>()
    const startingPollAttempts = new Map<string, number>()
    // Per-session request ordering: every state-changing RPC captures a
    // generation at issue time; only the newest generation may install state.
    // This stops an older getState arriving after a newer warm/setMode from
    // overwriting Starting/Connected with stale Standby.
    const requestGen = new Map<string, number>()
    const appliedGen = new Map<string, number>()
    const fetchStatePromises = new Map<string, Promise<void>>()

    const nextGen = (sessionID: string): number => {
      const g = (requestGen.get(sessionID) ?? 0) + 1
      requestGen.set(sessionID, g)
      return g
    }

    const getSessionSignal = (sessionID: string) => {
      let entry = signals.get(sessionID)
      if (!entry) {
        entry = createSignal<AcpSessionState | undefined>(undefined)
        signals.set(sessionID, entry)
      }
      return entry
    }

    const buildOpts = (directory?: string): RpcCallOptions => ({
      ...(directory ? { location: { directory } } : {}),
      signal: ctx.signal,
    })

    const updateSessionState = (sessionID: string, next: AcpSessionState, gen?: number) => {
      if (gen !== undefined) {
        const applied = appliedGen.get(sessionID) ?? 0
        if (gen < applied) return
        appliedGen.set(sessionID, gen)
      } else {
        appliedGen.set(sessionID, requestGen.get(sessionID) ?? 0)
      }
      const [readState, setState] = getSessionSignal(sessionID)
      const prev = untrack(readState)
      loaded.add(sessionID)
      failedAt.delete(sessionID)
      setState(next)
      if (prev?.starting && !next.starting && !next.connected) {
        // A previously-starting session settled without connecting (warm failed
        // quietly or the proc died on arrival): clear the warm marker so a
        // later selection retries instead of pinning the miss forever.
        warmedSessions.delete(sessionID)
      }
      if (!next.starting) startingPollAttempts.delete(sessionID)
      // Keep polling while the session is still starting so the pill animates
      // Standby -> Starting... -> Connected even for slow cold spawns.
      if (next.starting && !ctx.signal.aborted) {
        // Directory is best-effort here; the poll's force-fetch works without it.
        untrack(() => scheduleStartingPoll(sessionID, undefined))
      }
    }

    const fetchState = (
      sessionID: string,
      directory?: string,
      force = false,
    ): Promise<void> => {
      if (!sessionID || ctx.signal.aborted) return Promise.resolve()
      if (!force) {
        if (loaded.has(sessionID) || inFlight.has(sessionID)) return Promise.resolve()
        const lastFail = failedAt.get(sessionID)
        if (lastFail !== undefined && Date.now() - lastFail < ERROR_BACKOFF_MS)
          return Promise.resolve()
      }
      const gen = nextGen(sessionID)
      inFlight.add(sessionID)
      const p: Promise<void> = getRpc()
        .getState({ sessionID }, buildOpts(directory))
        .then((next: AcpSessionState) => {
          if (ctx.signal.aborted) return
          updateSessionState(sessionID, next, gen)
        })
        .catch(() => {
          failedAt.set(sessionID, Date.now())
        })
        .finally(() => {
          inFlight.delete(sessionID)
        })
      fetchStatePromises.set(sessionID, p)
      void p.finally(() => {
        if (fetchStatePromises.get(sessionID) === p) fetchStatePromises.delete(sessionID)
      })
      return p
    }

    const scheduleInitialFetch = (sessionID: string, directory?: string) => {
      if (!sessionID || loaded.has(sessionID) || inFlight.has(sessionID)) return
      const lastFail = failedAt.get(sessionID)
      if (lastFail !== undefined && Date.now() - lastFail < ERROR_BACKOFF_MS) return
      queueMicrotask(() => {
        untrack(() => fetchState(sessionID, directory, false))
      })
    }

    // Pre-warm `agy acp` the moment an Antigravity model is selected so the
    // first turn doesn't pay a cold spawn. Server-side deduplicated; quiet on failure.
    // Poll scheduling happens from the warm result, not the (necessarily stale)
    // synchronous state read in show().
    const warmAcpSession = (sessionID: string, directory?: string) => {
      if (!sessionID || ctx.signal.aborted) return
      if (warmedSessions.has(sessionID)) {
        // An evicted/disconnected session may re-warm when reselected: a stale
        // warm marker must not pin the miss forever.
        const cur = untrack(() => getSessionSignal(sessionID)[0]())
        if (cur?.connected || cur?.starting) return
        warmedSessions.delete(sessionID)
      }
      warmedSessions.add(sessionID)
      const gen = nextGen(sessionID)
      void getRpc()
        .warmSession({ sessionID }, buildOpts(directory))
        .then((next: AcpSessionState) => {
          if (ctx.signal.aborted) return
          if (!next.starting && !next.connected) {
            // Quiet no-op (circuit open / disposed): allow a later retry.
            warmedSessions.delete(sessionID)
          }
          updateSessionState(sessionID, next, gen)
        })
        .catch(() => {
          warmedSessions.delete(sessionID)
        })
    }

    // While a session reports starting, re-fetch with backoff until it settles
    // to Connected/Error (or the plugin unloads). Attempts reset on settle.
    const scheduleStartingPoll = (sessionID: string, directory?: string) => {
      if (!sessionID || ctx.signal.aborted || startingPollTimers.has(sessionID)) return
      const attempts = startingPollAttempts.get(sessionID) ?? 0
      startingPollAttempts.set(sessionID, attempts + 1)
      const delay = Math.min(1500 * Math.pow(2, attempts), 12000)
      startingPollTimers.set(
        sessionID,
        setTimeout(() => {
          startingPollTimers.delete(sessionID)
          if (ctx.signal.aborted) return
          const cur = untrack(() => getSessionSignal(sessionID)[0]())
          if (!cur?.starting) {
            startingPollAttempts.delete(sessionID)
            return
          }
          // Wait for the current fetchState promise to settle before
          // scheduling the next poll so polls never overlap or reorder.
          const run = () => fetchState(sessionID, directory, true)
          const inFlightPoll = fetchStatePromises.get(sessionID)
          const after: Promise<void> = inFlightPoll
            ? inFlightPoll.then(run, run)
            : run()
          void after.finally(() => {
            if (ctx.signal.aborted) return
            const latest = untrack(() => getSessionSignal(sessionID)[0]())
            if (latest?.starting) untrack(() => scheduleStartingPoll(sessionID, directory))
          })
        }, delay),
      )
    }

    function AcpControlsPopover(input: ComposerPillMenuProps) {
      const uid = createUniqueId()
      const [modeSaving, setModeSaving] = createSignal<AcpMode | null>(null)
      const [reloading, setReloading] = createSignal(false)
      const [actionError, setActionError] = createSignal<string | null>(null)
      const [now, setNow] = createSignal(Date.now())

      const sessionID = () => input.session.id
      const directory = () => input.session.directory
      const state = () => getSessionSignal(sessionID())[0]()

      // Refresh live status each time the popover opens or navigates to another session
      createEffect(() => {
        const sid = sessionID()
        const dir = directory()
        untrack(() => fetchState(sid, dir, true))
      })

      // Live countdown ticker only while popover is open AND cooldown is active
      createEffect(() => {
        const until = state()?.cooldownUntil
        if (!until || until <= Date.now()) return
        setNow(Date.now())
        const id = setInterval(() => {
          const t = Date.now()
          setNow(t)
          if (t >= until) clearInterval(id)
        }, 1000)
        onCleanup(() => clearInterval(id))
      })

      const activeMode = (): AcpMode => state()?.mode ?? "auto"
      const activeModeMeta = () => MODE_OPTIONS.find((m) => m.id === activeMode()) ?? MODE_OPTIONS[0]

      const cooldownSeconds = () => {
        const until = state()?.cooldownUntil
        if (!until) return 0
        const rem = until - now()
        return rem > 0 ? Math.ceil(rem / 1000) : 0
      }

      const dotState = () => {
        const st = state()
        if (st?.busy) return "busy"
        if (st?.starting) return "busy"
        if (cooldownSeconds() > 0) return "cooldown"
        if (st?.lastError) return "error"
        if (st?.connected) return "connected"
        return "idle"
      }

      const statusText = () => {
        const st = state()
        if (st?.busy) return "Running"
        if (st?.starting) return "Starting..."
        const secs = cooldownSeconds()
        if (secs > 0) return `Cooldown · ${secs}s`
        if (st?.lastError) return "Error"
        if (st?.connected) return "Connected"
        return "Standby"
      }

      const alertInfo = (): { readonly tone: "warning" | "danger"; readonly text: string } | undefined => {
        const localErr = actionError()
        if (localErr) return { tone: "danger", text: localErr }
        const secs = cooldownSeconds()
        const st = state()
        if (secs > 0) {
          return {
            tone: "warning",
            text: `Circuit breaker paused requests for ${secs}s after upstream API error${st?.lastError ? `: ${st.lastError}` : "."}`,
          }
        }
        if (st?.lastError) return { tone: "danger", text: st.lastError }
        return undefined
      }

      const authBadgeText = () => state()?.authMethod ?? "Google account"

      const selectMode = async (mode: AcpMode) => {
        if (modeSaving() !== null || activeMode() === mode) return
        const sid = sessionID()
        const dir = directory()
        setActionError(null)
        setModeSaving(mode)
        const gen = nextGen(sid)
        try {
          const next = await getRpc().setMode({ sessionID: sid, mode }, buildOpts(dir))
          updateSessionState(sid, next, gen)
        } catch (err) {
          setActionError(fmtErr(err))
        } finally {
          setModeSaving(null)
        }
      }

      const handleReloadModels = async () => {
        if (reloading()) return
        const sid = sessionID()
        const dir = directory()
        setActionError(null)
        setReloading(true)
        try {
          const res = await getRpc().reloadModels({}, buildOpts(dir))
          void fetchState(sid, dir, true)
          ctx.toast.show({
            title: "Antigravity models refreshed",
            description: `${res.modelCount} models available`,
            variant: "success",
          })
        } catch (err) {
          setActionError(fmtErr(err))
        } finally {
          setReloading(false)
        }
      }

      const modeHeadingId = `${uid}-mode`
      const modeHintId = `${uid}-mode-hint`

      return (
        <div class="agy-pop">
          <div class="agy-status">
            <div class="agy-status-main">
              <span class="agy-dot" data-state={dotState()} aria-hidden="true" />
              <span class="agy-status-text">{statusText()}</span>
            </div>
            <div class="agy-meta-chips">
              <span class="agy-chip" title="Sign-in method">{authBadgeText()}</span>
            </div>
          </div>

          <Show when={alertInfo()}>
            {(info) => (
              <div role="alert" class="agy-alert" data-tone={info().tone} title={info().text}>
                <span class="agy-alert-icon" aria-hidden="true">
                  <ctx.ui.Icon
                    name={info().tone === "warning" ? "warning" : "circle-exclamation"}
                    size="small"
                  />
                </span>
                <span class="agy-alert-body">{info().text}</span>
              </div>
            )}
          </Show>

          <div class="agy-sec">
            <div class="agy-sec-head">
              <span id={modeHeadingId} class="agy-sec-title">
                Approval mode
              </span>
            </div>
            <div role="group" aria-labelledby={modeHeadingId} class="agy-mode-grid">
              <For each={MODE_OPTIONS}>
                {(opt) => {
                  const selected = () => activeMode() === opt.id
                  const saving = () => modeSaving() === opt.id
                  return (
                    <button
                      type="button"
                      class="agy-seg-btn"
                      aria-pressed={selected()}
                      aria-describedby={modeHintId}
                      disabled={modeSaving() !== null}
                      onClick={() => void selectMode(opt.id)}
                    >
                      <span>{opt.label}</span>
                      <Show
                        when={!saving()}
                        fallback={<ctx.ui.Loader size="small" />}
                      >
                        <Show when={selected()}>
                          <span class="agy-check-icon" aria-hidden="true">
                            <ctx.ui.Icon name="check-small" size="small" />
                          </span>
                        </Show>
                      </Show>
                    </button>
                  )
                }}
              </For>
            </div>
            <p id={modeHintId} class="agy-hint">
              {activeModeMeta().detail}
            </p>
          </div>

          <div class="agy-actions">
            <ctx.ui.Button
              size="small"
              variant="neutral"
              icon="refresh"
              busy={reloading()}
              class="agy-action-btn"
              onClick={() => void handleReloadModels()}
            >
              {`Models (${state()?.modelCount ?? 9})`}
            </ctx.ui.Button>
          </div>
        </div>
      )
    }

    ctx.add(ComposerPill, {
      id: "controls",
      order: -10,
      show(input): ComposerPillView | undefined {
        const model = input.screen.composer.model()
        if (model?.providerID !== ACP_PROVIDER_ID) return undefined

        const sessionID = input.session.id
        const directory = input.session.directory
        const [readState] = untrack(() => getSessionSignal(sessionID))
        scheduleInitialFetch(sessionID, directory)
        // Pre-warm `agy acp` on selection/mount and on session switches while
        // an Antigravity model stays selected — pill goes Standby -> Starting... -> Connected.
        untrack(() => warmAcpSession(sessionID, directory))

        const state = readState()
        const activeMode: AcpMode = state?.mode ?? "auto"
        const cooldownActive = Boolean(state?.cooldownUntil && state.cooldownUntil > Date.now())

        if (state?.starting) {
          untrack(() => scheduleStartingPoll(sessionID, directory))
        }

        let label = `ACP · ${MODE_LABELS[activeMode]}`
        let tone: ComposerPillTone | undefined
        if (state?.busy) {
          label = `ACP · ${MODE_LABELS[activeMode]} · Running`
          tone = "success"
        } else if (state?.starting) {
          label = `ACP · ${MODE_LABELS[activeMode]} · Starting...`
        } else if (cooldownActive) {
          label = "ACP · Cooldown"
          tone = "warning"
        } else if (state?.lastError) {
          label = `ACP · ${MODE_LABELS[activeMode]} · Error`
          tone = "danger"
        } else if (state?.connected) {
          label = `ACP · ${MODE_LABELS[activeMode]} · Connected`
          tone = "success"
        }

        return {
          icon: "brain",
          label,
          title: "Antigravity ACP",
          tone,
        }
      },
      menu: (input) => AcpControlsPopover(input),
    })

    const currentSessionTarget = () => {
      const cur = ctx.sessions.current()
      if (!cur) return undefined
      const directory = (cur as { readonly directory?: string }).directory ?? cur.location?.directory
      return { sessionID: cur.id, directory }
    }

    ctx.add(
      Command,
      (): Command => ({
        id: "reset",
        title: "Antigravity ACP: Reset Session",
        section: "session",
        slash: { name: "agy-reset" },
        run: async () => {
          const target = currentSessionTarget()
          if (!target) return
          // Capture the generation BEFORE the reset RPC: only this reset may
          // install its result, so a late reset response cannot overwrite a
          // newer state update that landed mid-flight.
          const gen = nextGen(target.sessionID)
          const next = await getRpc().resetSession(
            { sessionID: target.sessionID },
            buildOpts(target.directory),
          )
          updateSessionState(target.sessionID, next, gen)
          ctx.toast.show({ title: "Antigravity ACP session reset", variant: "success" })
        },
      }),
    )

    ctx.add(
      Command,
      (): Command => ({
        id: "reload",
        title: "Antigravity ACP: Reload Models",
        section: "model",
        slash: { name: "agy-reload" },
        run: async () => {
          const target = currentSessionTarget()
          const res = await getRpc().reloadModels({}, buildOpts(target?.directory))
          if (target) void fetchState(target.sessionID, target.directory, true)
          ctx.toast.show({
            title: "Antigravity models refreshed",
            description: `${res.modelCount} models available`,
            variant: "success",
          })
        },
      }),
    )

    return () => {
      signals.clear()
      loaded.clear()
      inFlight.clear()
      failedAt.clear()
      warmedSessions.clear()
      requestGen.clear()
      appliedGen.clear()
      fetchStatePromises.clear()
      for (const t of startingPollTimers.values()) clearTimeout(t)
      startingPollTimers.clear()
      startingPollAttempts.clear()
    }
  },
})
