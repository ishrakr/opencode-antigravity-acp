// The Antigravity section in Work Status. OpenChamber cannot hide a section per
// session, so outside Antigravity sessions it shrinks to one line.
import { connectHost, HostRequestError, type QuotaProviderUsageData } from "@openchamber/sdk"
import { applyHostReady } from "@openchamber/sdk/ui"
import { antigravityModelOf, formatReset, toGroupViews, type GroupView } from "./view.ts"

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
  .tag { font-weight: 400; font-size: 11px; color: var(--oc-muted); }
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
let modelId: string | null = null
let data: QuotaProviderUsageData | null = null
let failure: string | null = null
let loading = false
let lastRead = 0

const note = (text: string, error = false) => root.replaceChildren(el("div", error ? "note error" : "note", text))

function drawGroup(group: GroupView, now: number): HTMLElement {
  const box = el("div", group.current ? "group" : "group other")
  const name = el("div", "name", group.name)
  if (group.current) name.append(el("span", "tag", "this session"))
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

function render(): void {
  if (modelId === null) {
    note("Not used in this session")
    return
  }
  if (failure) {
    note(failure, true)
    return
  }
  if (!data) {
    note("Reading quota…")
    return
  }
  if (!data.ok || !data.usage) {
    note(data.error ?? "agy reported no quota.", true)
    return
  }
  const now = Date.now()
  const groups = toGroupViews(data, modelId)
  if (groups.length === 0) {
    note("agy reported no quota groups.")
    return
  }
  root.replaceChildren(...groups.map((group) => drawGroup(group, now)))
}

function failureText(error: unknown): string {
  if (error instanceof HostRequestError) {
    if (error.code === "NO_SERVICE" || error.code === "NOT_GRANTED") return "Allow the local service for Antigravity quota in Settings → Extensions."
    if (error.code === "DISABLED") return "Antigravity quota is paused in Settings → Extensions."
  }
  return "Could not reach the quota service."
}

async function read(): Promise<void> {
  if (loading || modelId === null || document.hidden) return
  loading = true
  try {
    const result = await host.serviceRequest({ method: "GET", path: "/usage" })
    if (result.status !== 200) throw new Error(`status ${result.status}`)
    data = JSON.parse(result.body) as QuotaProviderUsageData
    failure = null
    lastRead = Date.now()
  } catch (error) {
    failure = failureText(error)
  } finally {
    loading = false
    render()
  }
}

// The host sizes the frame to the content: one line outside Antigravity sessions.
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
  const next = antigravityModelOf(session?.model)
  if (next === modelId) return
  modelId = next
  render()
  if (modelId !== null && Date.now() - lastRead > REFRESH_MS / 2) void read()
})

setInterval(() => void read(), REFRESH_MS)
document.addEventListener("visibilitychange", () => {
  if (!document.hidden && Date.now() - lastRead > REFRESH_MS) void read()
})
render()
