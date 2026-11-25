// The Antigravity section in Work Status. It shows every account's quota in
// every session, always in the same order; in an Antigravity session the
// other accounts and groups are dimmed.
import { connectHost, HostRequestError } from "@openchamber/sdk"
import { applyHostReady } from "@openchamber/sdk/ui"
import type { AccountsQuota } from "./quota.ts"
import {
  antigravityTargetOf,
  formatReset,
  readAccountsQuota,
  sameTarget,
  toAccountViews,
  type AccountView,
  type GroupView,
  type SessionTarget,
} from "./view.ts"

const REFRESH_MS = 60_000

const host = connectHost()
const rootElement = document.querySelector<HTMLElement>("#root")
if (!rootElement) throw new Error("Missing #root")
const root: HTMLElement = rootElement

const style = document.createElement("style")
style.textContent = `
  html, body { margin: 0; background: transparent; color: var(--oc-fg); font: 12px/1.4 var(--oc-font); }
  * { box-sizing: border-box; }
  #root { display: flex; flex-direction: column; gap: 8px; padding: 2px 4px 4px; }
  .note { color: var(--oc-muted); }
  .note.error { color: var(--oc-error-text, var(--oc-error)); }
  .group { display: flex; flex-direction: column; gap: 4px; }
  .group.other { opacity: .7; }
  .name { display: flex; align-items: baseline; gap: 6px; font-weight: 600; }
  .account { display: flex; flex-direction: column; gap: 6px; }
  .account + .account { border-top: 1px solid var(--oc-border); padding-top: 8px; }
  .account.other { opacity: .75; }
  .account-name { display: flex; align-items: baseline; gap: 6px; font-weight: 600; font-size: 11px; text-transform: uppercase; letter-spacing: .04em; color: var(--oc-muted); }
  .line { display: grid; grid-template-columns: 52px minmax(0, 1fr) auto; align-items: center; gap: 8px; }
  .what { color: var(--oc-muted); }
  .meter { height: 5px; border-radius: 3px; overflow: hidden; background: color-mix(in srgb, var(--oc-fg) 8%, transparent); }
  .meter > span { display: block; height: 100%; border-radius: 3px; }
  .value { font-variant-numeric: tabular-nums; white-space: nowrap; text-align: right; }
  .reset { color: var(--oc-muted); }
`
document.head.append(style)

const TONE_COLOR = {
  success: "var(--oc-success)",
  warning: "var(--oc-warning)",
  error: "var(--oc-error)",
  muted: "var(--oc-muted)",
} as const

const el = (tag: string, className = "", text = ""): HTMLElement => {
  const node = document.createElement(tag)
  if (className) node.className = className
  if (text) node.textContent = text
  return node
}

let locale: string | undefined
let target: SessionTarget | null = null
let data: AccountsQuota | null = null
let failure: string | null = null
let loading = false
let lastRead = 0

const note = (text: string, error = false) => root.replaceChildren(el("div", error ? "note error" : "note", text))

function drawGroup(group: GroupView, now: number, marked: boolean): HTMLElement {
  const box = el("div", group.current || !marked ? "group" : "group other")
  const name = el("div", "name", group.name)
  box.append(name)
  for (const line of group.windows) {
    const fill = el("span")
    fill.style.width = `${line.remaining ?? 0}%`
    fill.style.background = TONE_COLOR[line.tone]
    const meter = el("div", "meter")
    meter.append(fill)
    const value = el("span", "value", line.remaining === null ? "–" : `${line.remaining}% left`)
    if (line.resetAt !== null) {
      const refill = formatReset(line.resetAt, now, locale)
      value.append(el("span", "reset", ` · ${refill}`))
      value.title = `Refills ${refill}`
    }
    const row = el("div", "line")
    row.append(el("span", "what", line.label), meter, value)
    box.append(row)
  }
  return box
}

function drawGroups(account: AccountView, now: number): HTMLElement[] {
  if (account.error) return [el("div", "note error", account.error)]
  // Outside the session's own account no group is dimmed.
  const marked = account.groups.some((group) => group.current)
  return account.groups.map((group) => drawGroup(group, now, marked))
}

function drawAccount(account: AccountView, now: number, marked: boolean): HTMLElement {
  const box = el("div", account.current || !marked ? "account" : "account other")
  const name = el("div", "account-name", account.name)
  box.append(name, ...drawGroups(account, now))
  return box
}

function render(): void {
  if (failure) {
    note(failure, true)
    return
  }
  if (!data) {
    note("Reading quota…")
    return
  }
  const now = Date.now()
  const accounts = toAccountViews(data, target)
  if (accounts.length === 0) {
    note("agy reported no quota.")
    return
  }
  // With only your normal login, the section looks as it did before accounts.
  if (accounts.length === 1) {
    root.replaceChildren(...drawGroups(accounts[0], now))
    return
  }
  const marked = accounts.some((account) => account.current)
  root.replaceChildren(...accounts.map((account) => drawAccount(account, now, marked)))
}

function failureText(error: unknown): string {
  if (error instanceof HostRequestError) {
    if (error.code === "NO_SERVICE" || error.code === "NOT_GRANTED") return "Allow the local service for Antigravity quota in Settings → Extensions."
    if (error.code === "DISABLED") return "Antigravity quota is paused in Settings → Extensions."
  }
  return "Could not reach the quota service."
}

async function read(): Promise<void> {
  if (loading || document.hidden) return
  loading = true
  try {
    const result = await host.serviceRequest({ method: "GET", path: "/usage" })
    if (result.status !== 200) throw new Error(`status ${result.status}`)
    data = readAccountsQuota(JSON.parse(result.body))
    failure = null
    lastRead = Date.now()
  } catch (error) {
    failure = failureText(error)
  } finally {
    loading = false
    render()
  }
}

// The host sizes the frame to the content.
let reportedHeight = -1
new ResizeObserver(() => {
  const height = Math.ceil(root.getBoundingClientRect().height)
  if (height === reportedHeight) return
  reportedHeight = height
  void host.setHeight(height).catch(() => undefined)
}).observe(root)

host.onReady((context) => {
  applyHostReady(context, document.documentElement)
  locale = context.locale
  render()
})

host.onSession((session) => {
  const next = antigravityTargetOf(session?.model)
  if (sameTarget(next, target)) return
  target = next
  render()
  if (Date.now() - lastRead > REFRESH_MS / 2) void read()
})

setInterval(() => void read(), REFRESH_MS)
document.addEventListener("visibilitychange", () => {
  if (!document.hidden && Date.now() - lastRead > REFRESH_MS) void read()
})
render()
void read()
