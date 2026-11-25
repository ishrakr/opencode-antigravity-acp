// What the Work Status section shows, kept free of the DOM so it can be tested.
import type { QuotaProviderUsageData, QuotaProviderWindow } from "@openchamber/sdk"
import { MAIN_ACCOUNT_ID, accountIdOfProvider } from "../../src/account-ids.ts"
import type { AccountQuota, AccountsQuota } from "./quota.ts"

/** The Antigravity account and model a session uses. */
export interface SessionTarget {
  /** "main" for your normal agy login, else the extra account's ID. */
  readonly account: string
  readonly modelId: string
}

/**
 * `model` is OpenChamber's `providerID/modelID`, absent before the first
 * reply. Null outside Antigravity; each account is its own provider.
 */
export function antigravityTargetOf(model: string | undefined | null): SessionTarget | null {
  const slash = model?.indexOf("/") ?? -1
  if (!model || slash < 0) return null
  const account = accountIdOfProvider(model.slice(0, slash))
  const modelId = model.slice(slash + 1)
  return account && modelId ? { account, modelId } : null
}

export function sameTarget(a: SessionTarget | null, b: SessionTarget | null): boolean {
  return a?.account === b?.account && a?.modelId === b?.modelId
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
    resetAt: typeof window.resetAt === "number" && window.resetAt > 0 ? window.resetAt : null,
  }
}

const windowRank = (key: string) => {
  const i = WINDOW_ORDER.indexOf(key)
  return i < 0 ? WINDOW_ORDER.length : i
}

/**
 * Every group in agy's order, windows shortest first. In an Antigravity
 * session (`modelId`), that session's group is marked current.
 */
export function toGroupViews(data: QuotaProviderUsageData, modelId: string | null = null): GroupView[] {
  const models = data.usage?.models ?? {}
  const groups = Object.entries(models).map(([name, model]) => ({
    name: shortGroupName(name),
    current: modelId !== null && groupMatchesModel(name, modelId),
    windows: Object.entries(model.windows ?? {})
      .sort(([a], [b]) => windowRank(a) - windowRank(b))
      .map(([key, window]) => toLine(key, window)),
  }))
  return groups
}

export interface AccountView {
  readonly id: string
  readonly name: string
  /** The account the session uses. */
  readonly current: boolean
  readonly groups: readonly GroupView[]
  /** Why there is no quota for this account. */
  readonly error: string | null
}

/** The service's answer; an older service answered one account's usage directly. */
export function readAccountsQuota(body: unknown): AccountsQuota {
  const accounts = (body as AccountsQuota | null)?.accounts
  if (Array.isArray(accounts)) return { accounts }
  return { accounts: [{ id: MAIN_ACCOUNT_ID, name: "Main", data: body as QuotaProviderUsageData }] }
}

function toAccountView(account: AccountQuota, target: SessionTarget | null): AccountView {
  const current = target?.account === account.id
  const data = account.data
  if (!data?.ok || !data.usage) {
    return { id: account.id, name: account.name, current, groups: [], error: data?.error ?? "agy reported no quota." }
  }
  const groups = toGroupViews(data, current ? target.modelId : null)
  return {
    id: account.id,
    name: account.name,
    current,
    groups,
    error: groups.length === 0 ? "agy reported no quota groups." : null,
  }
}

/** Every account in the order added, your normal login first. */
export function toAccountViews(quota: AccountsQuota, target: SessionTarget | null = null): AccountView[] {
  const views = quota.accounts.map((account) => toAccountView(account, target))
  return views
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

function groupLine(group: GroupView, now: number, locale: string | undefined, refills: boolean): string {
  const windows = group.windows.map((line) => {
    const left = line.remaining === null ? "–" : `${line.remaining}% left`
    const refill =
      refills && line.resetAt !== null && line.resetAt > now ? `, refills ${formatReset(line.resetAt, now, locale)}` : ""
    return `${line.label} ${left}${refill}`
  })
  return `${group.name}: ${windows.join(" · ")}`
}

function summaryText(accounts: readonly AccountView[], now: number, locale: string | undefined, refills: boolean): string {
  const single = accounts.length === 1
  const lines: string[] = []
  for (const account of accounts) {
    const indent = single ? "" : "  "
    if (!single) lines.push(account.name)
    if (account.error) lines.push(`${indent}${account.error}`)
    for (const group of account.groups) lines.push(`${indent}${groupLine(group, now, locale, refills)}`)
  }
  return `Antigravity quota\n${lines.join("\n")}`
}

/**
 * What `/agy-quota` shows: each account's groups with what is left and when
 * it refills, in a fixed order. Refill times are
 * dropped when every account would not fit in a toast.
 */
export function quotaSummary(
  quota: AccountsQuota,
  now: number,
  target: SessionTarget | null = null,
  locale?: string,
): string {
  const accounts = toAccountViews(quota, target)
  if (accounts.length === 1 && accounts[0].error) return accounts[0].error.slice(0, SUMMARY_MAX)
  let text = summaryText(accounts, now, locale, true)
  if (text.length > SUMMARY_MAX) text = summaryText(accounts, now, locale, false)
  return text.length > SUMMARY_MAX ? `${text.slice(0, SUMMARY_MAX - 1)}…` : text
}
