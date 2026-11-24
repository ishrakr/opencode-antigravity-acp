// What the Work Status section shows, kept free of the DOM so it can be tested.
import type { QuotaProviderUsageData, QuotaProviderWindow } from "@openchamber/sdk"

/** The OpenCode provider the Antigravity plugin registers its models under. */
export const ANTIGRAVITY_PROVIDER_ID = "antigravity-acp"

/** `model` is OpenChamber's `providerID/modelID`, absent before the first reply. */
export function antigravityModelOf(model: string | undefined | null): string | null {
  const slash = model?.indexOf("/") ?? -1
  if (!model || slash < 0) return null
  return model.slice(0, slash) === ANTIGRAVITY_PROVIDER_ID ? model.slice(slash + 1) : null
}

/** agy bills Gemini models in one group and every other model (Claude, GPT) in the other. */
export function groupMatchesModel(groupName: string, modelId: string): boolean {
  const geminiGroup = /gemini/i.test(groupName)
  return /^gemini/i.test(modelId) ? geminiGroup : !geminiGroup
}

/** "Gemini Models" → "Gemini", "Claude and GPT models" → "Claude & GPT". */
export function shortGroupName(name: string): string {
  return name.replace(/\s+models?$/i, "").replace(/\s+and\s+/i, " & ").trim() || name
}

export type Tone = "success" | "warning" | "error" | "muted"

export interface WindowLine {
  readonly key: string
  readonly label: string
  /** 0 to 100, null when agy gave no figure. */
  readonly remaining: number | null
  readonly tone: Tone
  readonly resetAt: number | null
}

export interface GroupView {
  readonly name: string
  readonly current: boolean
  readonly windows: readonly WindowLine[]
}

const WINDOW_ORDER = ["5h", "daily", "weekly"]
const WINDOW_LABELS: Record<string, string> = { "5h": "5-hour", daily: "Daily", weekly: "Weekly" }

export function toneFor(remaining: number | null): Tone {
  if (remaining === null) return "muted"
  if (remaining < 20) return "error"
  if (remaining < 50) return "warning"
  return "success"
}

function toLine(key: string, window: QuotaProviderWindow): WindowLine {
  const used = window.usedPercent
  const remaining = typeof used === "number" && Number.isFinite(used) ? Math.round(Math.max(0, Math.min(100, 100 - used))) : null
  return {
    key,
    label: WINDOW_LABELS[key] ?? key.replace(/_/g, " "),
    remaining,
    tone: toneFor(remaining),
    resetAt: typeof window.resetAt === "number" ? window.resetAt : null,
  }
}

const windowRank = (key: string) => {
  const i = WINDOW_ORDER.indexOf(key)
  return i < 0 ? WINDOW_ORDER.length : i
}

/** The session's own group first, then the others; windows shortest first. */
export function toGroupViews(data: QuotaProviderUsageData, modelId: string): GroupView[] {
  const models = data.usage?.models ?? {}
  const groups = Object.entries(models).map(([name, model]) => ({
    name: shortGroupName(name),
    current: groupMatchesModel(name, modelId),
    windows: Object.entries(model.windows ?? {})
      .sort(([a], [b]) => windowRank(a) - windowRank(b))
      .map(([key, window]) => toLine(key, window)),
  }))
  return groups.sort((a, b) => Number(b.current) - Number(a.current))
}

/** "7:03 PM" today, "Mon 2:03 PM" within a week, "Dec 3" after that. */
export function formatReset(resetAt: number, now: number, locale?: string): string {
  const date = new Date(resetAt)
  const time: Intl.DateTimeFormatOptions = { hour: "numeric", minute: "2-digit" }
  const sameDay = new Date(now).toDateString() === date.toDateString()
  if (sameDay) return date.toLocaleTimeString(locale, time)
  if (resetAt - now < 6 * 24 * 3_600_000) return date.toLocaleString(locale, { weekday: "short", ...time })
  return date.toLocaleDateString(locale, { month: "short", day: "numeric" })
}

/** Toasts hold up to 500 characters. */
const SUMMARY_MAX = 500

/**
 * What `/agy-quota` shows: each group's windows with what is left and when it
 * refills, Gemini first. With an Antigravity `modelId`, that group comes first.
 */
export function quotaSummary(data: QuotaProviderUsageData, now: number, modelId: string | null = null, locale?: string): string {
  if (!data.ok || !data.usage) return (data.error ?? "agy reported no quota.").slice(0, SUMMARY_MAX)
  const groups = toGroupViews(data, modelId ?? "gemini")
  if (groups.length === 0) return "agy reported no quota groups."
  const lines = groups.map((group) => {
    const windows = group.windows.map((line) => {
      const left = line.remaining === null ? "–" : `${line.remaining}% left`
      const refill = line.resetAt !== null && line.resetAt > now ? `, refills ${formatReset(line.resetAt, now, locale)}` : ""
      return `${line.label} ${left}${refill}`
    })
    const tag = modelId !== null && group.current ? " (this session)" : ""
    return `${group.name}${tag}: ${windows.join(" · ")}`
  })
  const text = `Antigravity quota\n${lines.join("\n")}`
  return text.length > SUMMARY_MAX ? `${text.slice(0, SUMMARY_MAX - 1)}…` : text
}
