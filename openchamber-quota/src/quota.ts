import { execFile } from "node:child_process"
import { existsSync, mkdirSync } from "node:fs"
import os from "node:os"
import path from "node:path"
import type { QuotaProviderUsageData, QuotaProviderWindow } from "@openchamber/sdk"

const FIVE_HOURS = 5 * 3_600
const DAY = 24 * 3_600
const WEEK = 7 * DAY
/** Inside OpenChamber's 20 s deadline for one service request. */
const AGY_TIMEOUT_MS = 15_000
const ERROR_MAX = 2_000

interface AgyBucket {
  readonly id?: string
  readonly name?: string
  readonly window?: string
  readonly remaining_fraction?: number
  readonly reset_time?: string
}

interface AgyGroup {
  readonly name?: string
  readonly buckets?: readonly AgyBucket[]
}

/** The JSON `agy -p "/quota" --output-format json` prints. */
export interface AgyQuotaOutput {
  readonly status?: string
  readonly response?: string
  readonly command?: { readonly name?: string; readonly data?: { readonly groups?: readonly AgyGroup[] } }
}

/** `~/.local/bin` and Homebrew are often missing from a service's PATH. */
export function resolveAgyBinary(env: NodeJS.ProcessEnv = process.env): string {
  const override = env.AGY_BIN?.trim()
  if (override) return override
  const home = env.HOME || os.homedir()
  const candidates = [
    ...(env.PATH ?? "").split(path.delimiter).filter(Boolean).map((dir) => path.join(dir, "agy")),
    path.join(home, ".local", "bin", "agy"),
    "/opt/homebrew/bin/agy",
    "/usr/local/bin/agy",
  ]
  return candidates.find((c) => existsSync(c)) ?? "agy"
}

/** agy reads the same login as the plugin; API keys would switch it to another account. */
function agyEnv(): NodeJS.ProcessEnv {
  const env = { ...process.env }
  for (const key of ["GEMINI_API_KEY", "GOOGLE_API_KEY", "GOOGLE_APPLICATION_CREDENTIALS"]) delete env[key]
  return env
}

function windowSeconds(bucket: AgyBucket): number | null {
  const w = `${bucket.window ?? ""} ${bucket.id ?? ""}`.toLowerCase()
  if (w.includes("week") || w.includes("7d")) return WEEK
  if (w.includes("5h") || w.includes("five")) return FIVE_HOURS
  if (w.includes("day")) return DAY
  return null
}

function windowKey(bucket: AgyBucket, seconds: number | null): string {
  if (seconds === WEEK) return "weekly"
  if (seconds === FIVE_HOURS) return "5h"
  if (seconds === DAY) return "daily"
  return (bucket.window || bucket.id || "limit").toLowerCase().replace(/[^a-z0-9_-]+/g, "_")
}

function toWindow(bucket: AgyBucket, seconds: number | null): QuotaProviderWindow {
  const remaining = typeof bucket.remaining_fraction === "number" ? bucket.remaining_fraction : null
  const resetAt = bucket.reset_time ? Date.parse(bucket.reset_time) : Number.NaN
  return {
    usedPercent: remaining === null ? null : Math.round(Math.min(100, Math.max(0, (1 - remaining) * 100)) * 10) / 10,
    windowSeconds: seconds,
    resetAt: Number.isFinite(resetAt) ? resetAt : null,
  }
}

/** One card per agy model group (Gemini, Claude & GPT), with its 5-hour and weekly windows. */
export function toUsageData(output: AgyQuotaOutput): QuotaProviderUsageData {
  const groups = output.command?.data?.groups ?? []
  const models: Record<string, { windows: Record<string, QuotaProviderWindow> }> = {}
  for (const group of groups) {
    const name = group.name?.trim()
    if (!name || !Array.isArray(group.buckets)) continue
    const windows: Record<string, QuotaProviderWindow> = {}
    for (const bucket of group.buckets) {
      const seconds = windowSeconds(bucket)
      windows[windowKey(bucket, seconds)] = toWindow(bucket, seconds)
    }
    if (Object.keys(windows).length > 0) models[name] = { windows }
  }
  if (Object.keys(models).length === 0) {
    return failure(
      output.response?.trim()
        ? `agy reported no quota groups: ${output.response.trim()}`
        : "agy reported no quota groups. Sign in with `agy` and try again.",
    )
  }
  // Top-level windows summarise the groups: for each window, the group
  // closest to its limit.
  const windows: Record<string, QuotaProviderWindow> = {}
  for (const model of Object.values(models)) {
    for (const [key, window] of Object.entries(model.windows)) {
      const current = windows[key]
      if (!current || (window.usedPercent ?? -1) > (current.usedPercent ?? -1)) windows[key] = window
    }
  }
  return { ok: true, configured: true, usage: { windows, models } }
}

export function failure(error: string): QuotaProviderUsageData {
  return { ok: false, configured: true, error: error.slice(0, ERROR_MAX), usage: null }
}

/** Runs `agy -p "/quota"`: a local command, no model turn and no token use. */
export function runAgyQuota(binary = resolveAgyBinary(), cwd = defaultCwd()): Promise<QuotaProviderUsageData> {
  return new Promise((resolve) => {
    execFile(
      binary,
      ["-p", "/quota", "--output-format", "json"],
      { cwd, env: agyEnv(), timeout: AGY_TIMEOUT_MS, maxBuffer: 1_000_000 },
      (error, stdout, stderr) => {
        if (error && (error as NodeJS.ErrnoException).code === "ENOENT") {
          resolve(failure(`agy was not found (${binary}). Install the Antigravity CLI or set AGY_BIN.`))
          return
        }
        let parsed: AgyQuotaOutput | undefined
        try {
          parsed = JSON.parse(stdout) as AgyQuotaOutput
        } catch {}
        if (!parsed) {
          const detail = (stderr || error?.message || stdout || "no output").trim().split("\n").slice(-3).join(" ")
          resolve(failure(`agy /quota failed: ${detail}`))
          return
        }
        if (parsed.status && parsed.status !== "SUCCESS") {
          resolve(failure(`agy /quota answered ${parsed.status}: ${(parsed.response ?? "").trim()}`))
          return
        }
        resolve(toUsageData(parsed))
      },
    )
  })
}

/** agy treats its working folder as a workspace; keep it out of real projects. */
function defaultCwd(): string {
  const dir = process.env.OPENCHAMBER_SERVICE_DATA_DIR || path.join(os.tmpdir(), "antigravity-quota")
  try {
    mkdirSync(dir, { recursive: true })
  } catch {}
  return dir
}
