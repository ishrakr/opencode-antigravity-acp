import type {
  LanguageModelV3,
  LanguageModelV3CallOptions,
  LanguageModelV3FinishReason,
  LanguageModelV3StreamPart,
  LanguageModelV3Usage,
} from "@ai-sdk/provider"
import type { Plugin } from "@opencode/plugin/effect"
import { Effect } from "effect"
import { randomBytes } from "node:crypto"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { pathToFileURL } from "node:url"
import {
  AcpProcess,
  AgyNotFoundError,
  FALLBACK_MODELS,
  authMethodLabel,
  buildModelCatalog,
  discoverAcpModels,
  resolveAcpModelTarget,
  UnavailableModelError,
  type AcpAuthConfig,
  type AcpDiscoveredModel,
  type AcpElicitationRequestParams,
  type AcpElicitationResponse,
  type AcpPermissionOutcome,
  type AcpPermissionRequestParams,
  type AcpProcessOptions,
  type AcpPromptResult,
  type AcpSessionUpdate,
} from "./acp-client.js"
import {
  ACP_PROVIDER_ID,
  API_ERROR_ABORT_PATTERN,
  buildThinAcpPromptBlocks,
  extractToolResultsFromPrompt,
  hasNonAcpAssistantHistory,
  isSyntheticRestartAfterError,
} from "./history-sanitizer.js"
import { MAIN_ACCOUNT_ID, accountProviderID } from "./account-ids.js"
import {
  buildKeptConversation,
  historyDiverged,
  isDeliveredTurns,
  readTurnHistory,
  recordDelivery,
  type DeliveredTurns,
} from "./rewind-guard.js"
import { describeAcpToolCall, describeAcpToolResult } from "./tool-display.js"
import {
  elicitationToQuestions,
  isAcpUserInputRequest,
  parseQuestionToolAnswers,
  permissionToQuestion,
  type OpenCodeQuestion,
} from "./question-bridge.js"

/** OpenCode's built-in tool that asks the user questions. */
const OPENCODE_QUESTION_TOOL = "question"

export type AcpMode = "auto" | "accept-edits" | "default" | "plan"

const ACP_MODES = new Set<AcpMode>(["auto", "accept-edits", "default", "plan"])

class PluginDisposedError extends Error {
  constructor() {
    super("Antigravity ACP plugin instance was disposed")
    this.name = "PluginDisposedError"
  }
}

/**
 * Thrown when an in-flight `ensureAcpSession` start is invalidated by a
 * concurrent `resetSession()` (generation bump). The stale proc is disposed
 * without being installed; a foreground caller retries once.
 */
class StaleAcpStartError extends Error {
  constructor() {
    super("ACP session start superseded by a reset; retrying")
    this.name = "StaleAcpStartError"
  }
}

/** What the bridge keeps from OpenCode's request context: never sent to agy. */
export interface SessionContextSnapshot {
  readonly agent: string
  /** OpenCode's question tool is available to show agy's questions to the user. */
  readonly hasQuestionTool: boolean
}

export interface SessionPublicState {
  readonly sessionID: string
  readonly mode: AcpMode
  /** The selected sign-in method's label, such as "Google account". */
  readonly authMethod: string
  readonly starting: boolean
  readonly acpSessionId: string | null
  readonly connected: boolean
  readonly busy: boolean
  readonly modelCount: number
  readonly lastError: string | null
  readonly cooldownUntil: number | null
  /** The account's name; "Main" for your normal agy login. */
  readonly account: string
}

/** Shown when a session already holds turns from another model or another Antigravity account. */
export const FOREIGN_HISTORY_MESSAGE =
  "This session already has replies from another model or another Antigravity account. Antigravity only continues its own conversations, and each session stays on one account, so it won't read them. Start a new session to use this model."

/** Permission metadata key holding agy's warning for an "Allow always" choice. */
export const ANTIGRAVITY_WARNING_METADATA_KEY = "antigravityWarning"

const SECURITY_WARNING_META_KEY = "agy.security.warning"
const WARNING_TEXT_LIMIT = 512

/** agy's warning for an Allow Always option (`_meta["agy.security.warning"]`), bounded like T3 Code. */
export function antigravitySecurityWarning(option: { readonly _meta?: unknown }): string | undefined {
  const meta = option._meta
  if (!meta || typeof meta !== "object") return undefined
  const raw = (meta as Record<string, unknown>)[SECURITY_WARNING_META_KEY]
  if (!raw || typeof raw !== "object") return undefined
  const { title, message } = raw as { title?: unknown; message?: unknown }
  const text = (typeof message === "string" ? message.trim() : "") || (typeof title === "string" ? title.trim() : "")
  if (!text) return undefined
  return text.length > WARNING_TEXT_LIMIT ? `${text.slice(0, WARNING_TEXT_LIMIT - 3)}...` : text
}

/** Shown when OpenCode's history was rewound or edited behind agy's session. */
export const REWIND_NOTICE =
  "Messages in this session were rewound or edited, so Antigravity started a new session and was given the conversation that was kept.\n\n"

/** Shown once when agy could not resume the session's earlier conversation. */
export const RESUME_LOST_NOTICE =
  "Antigravity could not resume the earlier conversation in this session, so it started a new one and doesn't see the earlier messages. Start a new session to keep the conversation in one place.\n\n"

interface ToolResultForAgy {
  readonly content: Array<{ readonly type: "text"; readonly text: string }>
  readonly isError?: boolean
}

/** A question from agy shown to the user through OpenCode's question tool. */
interface PendingQuestion {
  readonly toolCallId: string
  readonly openCodeToolName: string
  readonly args: unknown
  emittedToOpenCode: boolean
  resolved: boolean
  readonly resolve: (res: ToolResultForAgy) => void
  abortCleanup?: () => void
  /** agy's own pending ask_question call, closed when the question is shown. */
  readonly nativeToolCallId?: string
  /**
   * Question relayed to OpenCode while agy's own ask_question call could not
   * be identified: flush even if other native tools are still open, so the
   * user is actually asked instead of the turn hanging.
   */
  readonly bypassNativeTools?: boolean
}

interface ActiveTurn {
  controller?: ReadableStreamDefaultController<LanguageModelV3StreamPart>
  controllerCleanup?: () => void
  readonly bufferedParts: LanguageModelV3StreamPart[]
  openTextId?: string
  openReasoningId?: string
  partSeq: number
  readonly activeNativeTools: Map<string, string>
  /** Searchable title/name/input of native tool calls, to find agy's ask_question call. */
  nativeToolText?: Map<string, string>
  readonly relayedUpdateIds: Set<string>
  readonly pendingQuestions: Map<string, PendingQuestion>
  readonly dispatchedCallIds: Set<string>
  flushTimer?: ReturnType<typeof setTimeout>
  promptSettled: boolean
  abortedOnApiError?: boolean
  promptResult?: AcpPromptResult
  promptError?: Error
}

interface BridgeSession {
  readonly sessionID: string
  cwd: string
  mode: AcpMode
  acpSessionId?: string
  proc?: AcpProcess
  lastModelId?: string
  lastModeApplied?: AcpMode
  lastError: string | null
  lastTitleSent?: string
  contextSnapshot?: SessionContextSnapshot
  activeTurn?: ActiveTurn
  startLock?: Promise<void>
  /** Bumped by resetSession to invalidate in-flight ensureAcpSession starts. */
  startGeneration: number
  /**
   * Settles when the latest resetSession cleanup (including runStorageRemove)
   * finishes. Joiners and stale-start retries await it before reading storage
   * or spawning, so a replacement session never resumes a half-torn-down id.
   */
  resetLock?: Promise<void>
  /**
   * Set when resuming the stored agy session failed and a new one replaced it
   * during a background warm. The next real turn tells the user the earlier
   * conversation is gone; it is never replayed into agy.
   */
  pendingResumeLost?: boolean
  /**
   * Settles when the latest `proc.prompt()` so a follow-up turn can wait for a
   * cancelled prompt to settle server-side before sending a new prompt on
   * the same live proc. Never rejects; cleared on settle.
   */
  settlingPrompt?: Promise<void>
  /** Foreground reservations held by live doStream turns (excluded from idle LRU). */
  foregroundCount?: number
  lastContextUsed?: number
}

interface WarmSpare {
  proc: AcpProcess
  cwd: string
  holder: { owner?: BridgeSession }
}

/** Where PDFs are copied for agy to read, like T3 Code's attachments folder. */
function defaultAttachmentsDir(accountId: string = MAIN_ACCOUNT_ID): string {
  const stateHome = process.env.XDG_STATE_HOME?.trim() || path.join(os.homedir(), ".local", "state")
  // Each account has its own folder, so resetting one account's session never
  // deletes another's files.
  const name = accountId === MAIN_ACCOUNT_ID ? "attachments" : `attachments-${accountId}`
  return path.join(stateHome, "opencode-antigravity-acp", name)
}

function sessionAttachmentsDir(root: string, sessionID: string): string {
  return path.join(root, sessionID.replace(/[^A-Za-z0-9_-]/g, "_"))
}

/** Keys of the main account; an extra account adds its ID after the prefix. */
function storageKeys(accountId: string) {
  const scope = accountId === MAIN_ACCOUNT_ID ? "antigravity-acp" : `antigravity-acp:account:${accountId}`
  return {
    session: `${scope}:session:`,
    turns: `${scope}:turns:`,
    cooldown: `${scope}:cooldown`,
  }
}
const MODEL_CATALOG_STORAGE_KEY = "antigravity-acp:model-catalog:v1"
const MODEL_CATALOG_TTL_MS = 6 * 60 * 60 * 1000

/**
 * Upper bound on idle pre-warmed sessions. Clicking across many sessions must
 * not accumulate unbounded `agy acp` children; the LRU victim is torn down via
 * resetSession (never a session with an active turn or an in-flight start).
 */
const MAX_IDLE_WARMED_SESSIONS = 2

export type QuotaBucket = "claude-gpt" | "gemini" | "other"

type CooldownBucket = QuotaBucket | "global"

const COOLDOWN_BUCKETS: readonly CooldownBucket[] = ["global", "claude-gpt", "gemini", "other"]

/**
 * Upper bound for waiting on a previously cancelled ACP prompt to settle
 * server-side before a follow-up turn sends a new prompt on the same live
 * proc. If it hangs, the proc is torn down so the replacement starts clean.
 */
const SETTLING_PROMPT_TIMEOUT_MS = 2000

/**
 * Maps a model ID to its upstream quota pool. Claude & GPT models share one
 * pool, Gemini & Orchestrator models share another, everything else is "other".
 */
export function quotaBucketForModel(modelID: string): QuotaBucket {
  const id = (modelID ?? "").toLowerCase()
  if (id.includes("claude") || id.includes("gpt")) return "claude-gpt"
  if (id.includes("gemini") || id.includes("orchestrator")) return "gemini"
  return "other"
}

/**
 * Fatal/auth-level errors trip the "global" cooldown (all models blocked).
 * Everything else reaching the breaker is pool quota exhaustion.
 */
function isGlobalBreakerError(message: string): boolean {
  return /\(code 403\)|PERMISSION_DENIED/i.test(message)
}

let sharedCatalog: readonly AcpDiscoveredModel[] | undefined
let sharedCatalogUpdatedAt = 0
let sharedDiscoveryPromise: Promise<readonly AcpDiscoveredModel[]> | undefined

export function resetSharedCatalogForTests(): void {
  sharedCatalog = undefined
  sharedCatalogUpdatedAt = 0
  sharedDiscoveryPromise = undefined
}

function isValidCatalog(raw: unknown): raw is readonly AcpDiscoveredModel[] {
  if (!Array.isArray(raw) || raw.length === 0) return false
  return raw.every(
    (item) =>
      item &&
      typeof item === "object" &&
      typeof (item as any).id === "string" &&
      typeof (item as any).name === "string" &&
      typeof (item as any).defaultAcpModelId === "string" &&
      Array.isArray((item as any).variants),
  )
}

function normalizeCatalog(models: readonly AcpDiscoveredModel[]): readonly AcpDiscoveredModel[] {
  return models.map((m) => ({
    ...m,
    family: m.family || m.id,
  }))
}

function catalogSignature(models: readonly AcpDiscoveredModel[]): string {
  return JSON.stringify(models.map((m) => [m.id, m.name, m.family, m.defaultAcpModelId, m.variants]))
}

function buildUsage(
  raw?: AcpPromptResult["usage"],
  activeContextUsed?: number,
): LanguageModelV3Usage {
  const r = raw as (NonNullable<AcpPromptResult["usage"]> & Record<string, unknown>) | undefined
  const asNum = (v: unknown): number | undefined =>
    typeof v === "number" && Number.isFinite(v) ? v : undefined
  const rawInput = asNum(r?.inputTokens) ?? asNum(r?.input_tokens)
  const rawOutput = asNum(r?.outputTokens) ?? asNum(r?.output_tokens)
  const rawTotal = asNum(r?.totalTokens) ?? asNum(r?.total_tokens)
  const rawCacheRead = asNum(r?.cachedReadTokens) ?? asNum(r?.cached_read_tokens)
  const rawCacheWrite = asNum(r?.cachedWriteTokens) ?? asNum(r?.cached_write_tokens)
  const reasoning = asNum(r?.thoughtTokens) ?? asNum(r?.thought_tokens)
  const derivedInputFromTotal =
    rawTotal !== undefined && rawOutput !== undefined
      ? Math.max(0, rawTotal - rawOutput)
      : undefined
  const fallbackContext =
    typeof activeContextUsed === "number" &&
    Number.isFinite(activeContextUsed) &&
    activeContextUsed > 0
      ? activeContextUsed
      : undefined
  // agy reports inputTokens without the cached part: its totalTokens is
  // input + cachedRead + cachedWrite + output. Detect that shape from the
  // total and count cached tokens into the input, as the AI SDK expects.
  const cachedSum = (rawCacheRead ?? 0) + (rawCacheWrite ?? 0)
  if (
    rawInput !== undefined &&
    rawOutput !== undefined &&
    rawTotal !== undefined &&
    cachedSum > 0 &&
    rawTotal === rawInput + cachedSum + rawOutput
  ) {
    return {
      inputTokens: {
        total: rawInput + cachedSum,
        noCache: rawInput,
        cacheRead: rawCacheRead,
        cacheWrite: rawCacheWrite,
      },
      outputTokens: {
        total: rawOutput,
        text: Math.max(0, rawOutput - (reasoning ?? 0)),
        reasoning,
      },
    }
  }
  const inputTotal = rawInput ?? derivedInputFromTotal ?? fallbackContext
  const cacheRead =
    rawCacheRead !== undefined && inputTotal !== undefined
      ? Math.min(rawCacheRead, inputTotal)
      : rawCacheRead
  const cacheWrite =
    rawCacheWrite !== undefined && inputTotal !== undefined
      ? Math.min(rawCacheWrite, Math.max(0, inputTotal - (cacheRead ?? 0)))
      : rawCacheWrite
  const outputTotal = rawOutput
  const noCache =
    inputTotal !== undefined
      ? Math.max(0, inputTotal - (cacheRead ?? 0) - (cacheWrite ?? 0))
      : undefined
  const text =
    outputTotal !== undefined ? Math.max(0, outputTotal - (reasoning ?? 0)) : undefined
  return {
    inputTokens: {
      total: inputTotal,
      noCache,
      cacheRead,
      cacheWrite,
    },
    outputTokens: {
      total: outputTotal,
      text,
      reasoning,
    },
  }
}

/** The account a bridge runs as: your normal agy login, or an extra account's folder. */
export interface BridgeAccount {
  readonly id: string
  readonly name: string
  /** The extra account's private folder; absent for the main account. */
  readonly home?: string
}

const MAIN_BRIDGE_ACCOUNT: BridgeAccount = { id: MAIN_ACCOUNT_ID, name: "Main" }

export class SessionBridgeManager {
  readonly auth: AcpAuthConfig
  readonly account: BridgeAccount
  /** The OpenCode provider whose models run on this account. */
  readonly providerID: string
  private readonly keys: ReturnType<typeof storageKeys>
  /** Marks a reply as Antigravity's. */
  private readonly acpMarker: Record<string, { acp: true }>
  private sessions = new Map<string, BridgeSession>()
  private catalog: readonly AcpDiscoveredModel[] = FALLBACK_MODELS
  private onStateChanged?: (sessionID: string) => void
  private onCatalogChanged?: () => void
  private discoverModelsFn: (cwd: string) => Promise<readonly AcpDiscoveredModel[]>
  private createProcFn: (options: AcpProcessOptions) => AcpProcess
  private cooldownsByBucket = new Map<CooldownBucket, { until: number; reason: string }>()
  private cooldownLoadPromise?: Promise<void> | null
  private disposed = false
  private activeProcs = new Set<AcpProcess>()
  private intentionallyDisposed = new WeakSet<AcpProcess>()
  private warmSpare?: WarmSpare
  private warmSpareLock?: Promise<void>
  /**
   * OpenCode session IDs whose proc was installed by a background warm and
   * which have not run a real turn yet (LRU order, oldest first). Bounded by
   * MAX_IDLE_WARMED_SESSIONS so clicking across sessions can't accumulate
   * unbounded idle `agy acp` children.
   */
  private warmedIdleSessions: string[] = []
  private readonly attachmentsDir: string

  constructor(
    private readonly ctx: Plugin.Context,
    private readonly defaultCwd: string,
    onStateChanged?: (sessionID: string) => void,
    options?: {
      readonly onCatalogChanged?: () => void
      readonly discoverModels?: (cwd: string) => Promise<readonly AcpDiscoveredModel[]>
      /** Injectable proc factory for tests; defaults to real `AcpProcess`. */
      readonly createProc?: (options: AcpProcessOptions) => AcpProcess
      /** The selected sign-in method; the personal Google account when omitted. */
      readonly auth?: AcpAuthConfig
      /** Folder for attachments agy reads from disk (PDFs); passed with --add-dir. */
      readonly attachmentsDir?: string
      /** The account this bridge runs as; your normal agy login when omitted. */
      readonly account?: BridgeAccount
    },
  ) {
    this.auth = options?.auth ?? { method: "oauth-personal" }
    this.account = options?.account ?? MAIN_BRIDGE_ACCOUNT
    this.providerID = accountProviderID(this.account.id)
    this.keys = storageKeys(this.account.id)
    // OpenCode stores a reply's metadata only under its provider's key.
    this.acpMarker = { [this.providerID]: { acp: true } }
    this.attachmentsDir = options?.attachmentsDir ?? defaultAttachmentsDir(this.account.id)
    this.onStateChanged = onStateChanged
    this.onCatalogChanged = options?.onCatalogChanged
    this.discoverModelsFn =
      options?.discoverModels ??
      ((cwd) => discoverAcpModels(cwd, { auth: this.auth, accountHome: this.account.home }))
    const createProc = options?.createProc ?? ((opts: AcpProcessOptions) => new AcpProcess(opts))
    this.createProcFn = (opts) => {
      try {
        fs.mkdirSync(this.attachmentsDir, { recursive: true, mode: 0o700 })
      } catch {}
      return createProc({
        ...opts,
        auth: this.auth,
        ...(this.account.home ? { accountHome: this.account.home } : {}),
        extraDirs: [...(opts.extraDirs ?? []), this.attachmentsDir],
      })
    }
    if (sharedCatalog && sharedCatalog.length > 0) {
      this.catalog = sharedCatalog
    }
  }

  /** Every account lists the same models: the latest catalog any account read. */
  getModels(): readonly AcpDiscoveredModel[] {
    return sharedCatalog && sharedCatalog.length > 0 ? sharedCatalog : this.catalog
  }

  /** Stores a PDF for agy under this session's attachment folder; returns its file URI. */
  private storeAttachment(
    sessionID: string,
    input: { readonly bytes: Uint8Array; readonly filename: string },
  ): string {
    const dir = sessionAttachmentsDir(this.attachmentsDir, sessionID)
    fs.mkdirSync(dir, { recursive: true, mode: 0o700 })
    const safeName = input.filename.replace(/[^A-Za-z0-9._ -]/g, "_").replace(/^\.+/, "") || "attachment"
    const file = path.join(dir, `${randomBytes(6).toString("hex")}-${safeName}`)
    fs.writeFileSync(file, input.bytes, { mode: 0o600, flag: "wx" })
    return pathToFileURL(file).href
  }

  private async removeSessionAttachments(sessionID: string): Promise<void> {
    try {
      await fs.promises.rm(sessionAttachmentsDir(this.attachmentsDir, sessionID), {
        recursive: true,
        force: true,
      })
    } catch {}
  }

  async loadCachedModels(): Promise<{ readonly stale: boolean; readonly changed: boolean }> {
    if (sharedCatalog && sharedCatalog.length > 0) {
      const prevSig = catalogSignature(this.catalog)
      this.catalog = sharedCatalog
      return {
        stale: Date.now() - sharedCatalogUpdatedAt > MODEL_CATALOG_TTL_MS,
        changed: prevSig !== catalogSignature(sharedCatalog),
      }
    }

    try {
      const raw = (await Effect.runPromise(
        this.ctx.storage.get(MODEL_CATALOG_STORAGE_KEY),
      )) as { readonly updatedAt?: unknown; readonly models?: unknown } | undefined
      if (raw && typeof raw === "object" && isValidCatalog(raw.models)) {
        const normalized = normalizeCatalog(raw.models)
        const updatedAt = typeof raw.updatedAt === "number" ? raw.updatedAt : 0
        const prevSig = catalogSignature(this.catalog)
        sharedCatalog = normalized
        sharedCatalogUpdatedAt = updatedAt
        this.catalog = normalized
        return {
          stale: Date.now() - updatedAt > MODEL_CATALOG_TTL_MS,
          changed: prevSig !== catalogSignature(normalized),
        }
      }
    } catch {}

    return { stale: true, changed: false }
  }

  private async persistCatalog(
    models: readonly AcpDiscoveredModel[],
    updatedAt: number,
  ): Promise<void> {
    try {
      await Effect.runPromise(
        this.ctx.storage.set(MODEL_CATALOG_STORAGE_KEY, {
          version: 1,
          updatedAt,
          models: models as unknown as any,
        }),
      )
    } catch {}
  }

  async refreshModels(options?: {
    readonly force?: boolean
  }): Promise<{ readonly models: readonly AcpDiscoveredModel[]; readonly changed: boolean }> {
    if (
      !options?.force &&
      sharedCatalog &&
      sharedCatalog.length > 0 &&
      Date.now() - sharedCatalogUpdatedAt <= MODEL_CATALOG_TTL_MS
    ) {
      const changed = catalogSignature(this.catalog) !== catalogSignature(sharedCatalog)
      this.catalog = sharedCatalog
      return { models: this.catalog, changed }
    }

    if (!sharedDiscoveryPromise) {
      sharedDiscoveryPromise = (async () => {
        const discovered = await this.discoverModelsFn(this.defaultCwd)
        const normalized = normalizeCatalog(discovered)
        if (normalized.length > 0) {
          const updatedAt = Date.now()
          sharedCatalog = normalized
          sharedCatalogUpdatedAt = updatedAt
          await this.persistCatalog(normalized, updatedAt)
        }
        return normalized
      })().finally(() => {
        sharedDiscoveryPromise = undefined
      })
    }

    const normalized = await sharedDiscoveryPromise
    if (normalized.length === 0) {
      return { models: this.catalog, changed: false }
    }

    const prevSig = catalogSignature(this.catalog)
    this.catalog = normalized
    const changed = prevSig !== catalogSignature(normalized)
    return { models: normalized, changed }
  }

  async refreshModelsInBackground(): Promise<boolean> {
    try {
      const { changed } = await this.refreshModels({ force: false })
      if (!this.disposed && changed) {
        this.onCatalogChanged?.()
      }
      return changed
    } catch {
      return false
    }
  }

  hasSession(sessionID: string): boolean {
    return this.sessions.has(sessionID)
  }

  /**
   * Loads persisted per-bucket cooldowns once and shares the in-flight read:
   * concurrent callers await the same promise, so nobody proceeds on a
   * half-hydrated map and the storage read happens exactly once.
   */
  private loadPersistedCooldown(): Promise<void> {
    if (!this.cooldownLoadPromise) {
      this.cooldownLoadPromise = (async () => {
        const read = async (key: string): Promise<unknown> => {
          try {
            return await Effect.runPromise(this.ctx.storage.get(key))
          } catch {
            return undefined
          }
        }
        const applyRecord = (bucket: CooldownBucket, val: unknown) => {
          if (val && typeof val === "object") {
            const { until, reason } = val as { readonly until?: unknown; readonly reason?: unknown }
            if (typeof until === "number" && until > Date.now()) {
              const cur = this.cooldownsByBucket.get(bucket)
              if (!cur || until > cur.until) {
                this.cooldownsByBucket.set(bucket, {
                  until,
                  reason: typeof reason === "string" ? reason : "upstream error",
                })
              }
            }
          }
        }
        for (const bucket of COOLDOWN_BUCKETS) {
          applyRecord(bucket, await read(`${this.keys.cooldown}:${bucket}`))
        }
      })()
    }
    return this.cooldownLoadPromise
  }

  private persistCooldownForBucket(bucket: CooldownBucket, until: number, reason: string): void {
    try {
      Effect.runFork(
        this.ctx.storage
          .set(`${this.keys.cooldown}:${bucket}`, { until, reason })
          .pipe(Effect.catch(() => Effect.void)),
      )
    } catch {}
  }

  private tripCircuitBreaker(
    reason: string,
    bucket: CooldownBucket = "global",
  ): { until: number; reason: string } {
    const until = Date.now() + 60_000
    const trimmed = reason.trim().slice(0, 180)
    this.cooldownsByBucket.set(bucket, { until, reason: trimmed })
    this.persistCooldownForBucket(bucket, until, trimmed)
    return { until, reason: trimmed }
  }

  /** Effective cooldown for a model: the global breaker wins, else its quota pool. */
  private cooldownForModel(modelID: string): { until: number; reason: string } | undefined {
    const now = Date.now()
    const g = this.cooldownsByBucket.get("global")
    if (g && g.until > now) return g
    const b = this.cooldownsByBucket.get(quotaBucketForModel(modelID))
    if (b && b.until > now) return b
    return undefined
  }

  private activeCooldownForSession(s: BridgeSession | undefined): { until: number; reason: string } | undefined {
    const now = Date.now()
    const g = this.cooldownsByBucket.get("global")
    if (g && g.until > now) return g
    const bucket = s?.lastModelId ? quotaBucketForModel(s.lastModelId) : undefined
    if (bucket) {
      const b = this.cooldownsByBucket.get(bucket)
      if (b && b.until > now) return b
    }
    return undefined
  }

  private getOrCreateSession(sessionID: string): BridgeSession {
    let s = this.sessions.get(sessionID)
    if (!s) {
      s = {
        sessionID,
        cwd: this.defaultCwd,
        mode: "auto",
        lastError: null,
        startGeneration: 0,
      }
      this.sessions.set(sessionID, s)
    }
    return s
  }

  updateContextSnapshot(
    sessionID: string,
    input: { readonly agent: string; readonly hasQuestionTool: boolean },
  ): void {
    const s = this.getOrCreateSession(sessionID)
    s.contextSnapshot = { agent: input.agent, hasQuestionTool: input.hasQuestionTool }
  }

  isCircuitOpen(): boolean {
    const now = Date.now()
    for (const rec of this.cooldownsByBucket.values()) {
      if (rec.until > now) return true
    }
    return false
  }

  /**
   * Pre-warm `agy acp` in the background so the first real turn doesn't pay
   * a cold spawn. With a real session ID the session's own `ensureAcpSession`
   * runs (deduplicated via `s.startLock`); with an empty ID (unsaved new tab)
   * a spare initialized + authenticated proc is parked for the first real
   * `ses_...` session to claim. Never throws — the foreground turn surfaces
   * and retries any failure itself.
   */
  async warmSession(sessionID?: string): Promise<SessionPublicState> {
    if (this.disposed) return this.getState(sessionID ?? "")
    try {
      await this.loadPersistedCooldown()
    } catch {}
    if (this.isCircuitOpen()) return this.getState(sessionID ?? "")
    if (sessionID && sessionID.length > 0) {
      const s = this.getOrCreateSession(sessionID)
      if (!s.proc && !s.startLock) {
        // Pre-warm in the background; a real turn joins via startLock or reuses the install.
        // No retry on stale: if a reset invalidates this warm, it stays torn
        // down (the foreground turn re-warms on demand) instead of eagerly
        // reinstalling behind the reset. markResumeLost lets the next real turn
        // tell the user when resume failed and the new session has no history.
        void this.ensureAcpSession(s, { retryOnStale: false, markResumeLost: true })
          .then(() => this.trackWarmedIdle(sessionID))
          .catch(() => {})
      }
      return this.getState(sessionID)
    }
    void this.ensureWarmSpare().catch(() => {})
    return this.getState("")
  }

  private ensureWarmSpare(): Promise<void> {
    if (this.disposed) return Promise.resolve()
    const existing = this.warmSpare
    if (existing && !existing.proc.isClosed) return Promise.resolve()
    if (existing) this.warmSpare = undefined
    if (this.warmSpareLock) return this.warmSpareLock
    const p = (async () => {
      const holder: { owner?: BridgeSession } = {}
      const proc = this.createProcFn({
        cwd: this.defaultCwd,
        dangerouslySkipPermissions: false,
        onUpdate: (_sid, update) => {
          if (holder.owner) this.handleAcpUpdate(holder.owner, update)
        },
        onPermissionRequest: (params) =>
          holder.owner
            ? this.handlePermissionRequest(holder.owner, params)
            : Promise.resolve({ outcome: "cancelled" as const }),
        onElicitation: (params) =>
          holder.owner
            ? this.handleElicitation(holder.owner, params)
            : Promise.resolve({ action: "decline" as const }),
        onExit: (code, signal, tail) => {
          this.activeProcs.delete(proc)
          const owner = holder.owner
          if (owner && owner.proc === proc) {
            // Claimed and installed: standard session cleanup. Otherwise the
            // spare was superseded before install — just drop the slot.
            this.handleProcExit(owner, proc, code, signal, tail)
          } else if (this.warmSpare?.proc === proc) {
            this.warmSpare = undefined
          }
        },
      })
      this.activeProcs.add(proc)
      try {
        await proc.initialize()
        if (this.disposed) throw new PluginDisposedError()
        try {
          await proc.authenticate()
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err)
          if (!/already (authenticated|logged in|signed in)/i.test(msg)) throw err
        }
        if (this.disposed) throw new PluginDisposedError()
        if (proc.isClosed) throw new Error("warmed agy acp closed before use")
        this.warmSpare = { proc, cwd: this.defaultCwd, holder }
      } catch {
        this.activeProcs.delete(proc)
        try {
          await proc.dispose()
        } catch {}
        if (this.warmSpare?.proc === proc) this.warmSpare = undefined
      }
    })()
    this.warmSpareLock = p.finally(() => {
      this.warmSpareLock = undefined
    })
    return this.warmSpareLock
  }

  private async trackWarmedIdle(sessionID: string): Promise<void> {
    if (this.disposed) return
    const s = this.sessions.get(sessionID)
    // Only genuinely idle warmed sessions count: an in-flight start, a live
    // turn, a foreground reservation, a dead proc, or a torn-down session
    // means there's nothing to bound.
    if (!s || (s.foregroundCount ?? 0) > 0 || !s.proc || s.proc.isClosed || s.activeTurn || s.startLock || !s.acpSessionId) return
    this.untrackWarmedIdle(sessionID)
    this.warmedIdleSessions.push(sessionID)
    while (this.warmedIdleSessions.length > MAX_IDLE_WARMED_SESSIONS) {
      const victimID = this.warmedIdleSessions.find((id) => {
        const v = this.sessions.get(id)
        return (
          !!v &&
          !v.activeTurn &&
          !v.startLock &&
          !(v.foregroundCount && v.foregroundCount > 0) &&
          v.proc &&
          !v.proc.isClosed
        )
      })
      if (!victimID) break
      // Re-verify immediately before teardown so a turn that just started is
      // never interrupted by eviction.
      const victim = this.sessions.get(victimID)
      if (!victim || victim.activeTurn || victim.startLock || (victim.foregroundCount && victim.foregroundCount > 0)) break
      this.untrackWarmedIdle(victimID)
      try {
        // LRU eviction disposes ONLY the in-memory proc and clears s.proc —
        // it must NOT call resetSession / runStorageRemove, which would erase
        // the persisted acpSessionId needed for a later resume.
        const proc = victim.proc
        if (proc) {
          this.intentionallyDisposed.add(proc)
          this.activeProcs.delete(proc)
          if (victim.proc === proc) victim.proc = undefined
          if (!proc.isClosed) {
            try {
              await proc.dispose()
            } catch {}
          }
        }
      } catch {}
    }
  }

  private untrackWarmedIdle(sessionID: string): void {
    const idx = this.warmedIdleSessions.indexOf(sessionID)
    if (idx !== -1) this.warmedIdleSessions.splice(idx, 1)
  }

  /** For an extra account agy cannot use yet: how to sign it in. */
  signInRequiredMessage(err: unknown): string | undefined {
    if (!this.account.home) return undefined
    const msg = err instanceof Error ? err.message : String(err)
    if (!/Authentication required|No browser is available|not (signed|logged) in|sign in/i.test(msg)) return undefined
    return `The Antigravity account "${this.account.name}" is not signed in. Run \`agy-accounts login "${this.account.name}"\` in a terminal, then send your message again.`
  }

  getState(sessionID: string): SessionPublicState {
    const s = this.sessions.get(sessionID)
    return {
      sessionID,
      mode: s?.mode ?? "auto",
      authMethod: authMethodLabel(this.auth.method),
      starting: Boolean(s?.startLock),
      acpSessionId: s?.acpSessionId ?? null,
      connected: Boolean(s?.proc && !s.proc.isClosed && s.acpSessionId),
      busy: Boolean(s?.activeTurn),
      modelCount: this.getModels().length,
      account: this.account.name,
      lastError: s?.lastError ?? null,
      cooldownUntil: this.activeCooldownForSession(s)?.until ?? null,
    }
  }

  async setMode(sessionID: string, mode: AcpMode): Promise<SessionPublicState> {
    const s = this.getOrCreateSession(sessionID)
    s.mode = mode
    if (s.proc && !s.proc.isClosed && s.acpSessionId) {
      try {
        await s.proc.setMode(s.acpSessionId, mode)
        s.lastModeApplied = mode
      } catch (err) {
        s.lastError = err instanceof Error ? err.message : String(err)
      }
    }
    this.notifyChanged(sessionID)
    return this.getState(sessionID)
  }

  async resetSession(sessionID: string): Promise<SessionPublicState> {
    const s = this.sessions.get(sessionID)
    if (s) {
      // Publish a completion barrier BEFORE doing anything async: joiners in
      // ensureAcpSession (and its stale-start retry) await this lock, so a
      // replacement session never reads storage or spawns until our cleanup —
      // including runStorageRemove below — has fully finished.
      let releaseReset!: () => void
      const resetGate = new Promise<void>((r) => {
        releaseReset = r
      })
      const prevReset = s.resetLock
      s.resetLock = resetGate
      // A torn-down session is idle-warmed no longer; drop it so stale
      // entries can't inflate the cap or get evicted later.
      this.untrackWarmedIdle(sessionID)
      try {
        if (prevReset) {
          try {
            await prevReset
          } catch {}
        }
        // Invalidate any in-flight ensureAcpSession start, then wait for it to
        // settle so it cannot install a stale proc after we clean up.
        // A foreground turn already awaiting ensureAcpSession retries after
        // this reset; background warms never retry, so a reset stays torn down.
        s.startGeneration++
        const inFlight = s.startLock
        if (inFlight) {
          try {
            await inFlight
          } catch {}
        }
        await this.handleInterrupt(sessionID, "Session reset by user")
        if (s.proc) {
          const proc = s.proc
          const acpSid = s.acpSessionId
          this.intentionallyDisposed.add(proc)
          s.proc = undefined
          s.acpSessionId = undefined
          if (acpSid) await proc.closeSession(acpSid)
          await proc.dispose()
          this.activeProcs.delete(proc)
        }
        s.acpSessionId = undefined
        s.lastModelId = undefined
        s.lastModeApplied = undefined
        s.lastError = null
        s.pendingResumeLost = undefined
        s.settlingPrompt = undefined
        s.lastContextUsed = undefined
        this.untrackWarmedIdle(sessionID)
        await this.runStorageRemove(sessionID)
        await this.removeSessionAttachments(sessionID)
      } finally {
        if (s.resetLock === resetGate) s.resetLock = undefined
        releaseReset()
      }
    }
    this.notifyChanged(sessionID)
    return this.getState(sessionID)
  }

  async deleteSession(sessionID: string): Promise<void> {
    await this.resetSession(sessionID)
    const s = this.sessions.get(sessionID)
    if (s && !s.activeTurn && !s.startLock) {
      this.sessions.delete(sessionID)
    }
    this.notifyChanged(sessionID)
  }

  async handleInterrupt(sessionID: string, reason = "Cancelled"): Promise<void> {
    const s = this.sessions.get(sessionID)
    if (!s?.activeTurn) return
    const turn = s.activeTurn
    if (turn.flushTimer) {
      clearTimeout(turn.flushTimer)
      turn.flushTimer = undefined
    }
    // NOTE: do NOT detach the controller here — finishControllerWithError
    // detaches it itself after enqueueing the error + close. Detaching first
    // would orphan the stream: the error would sit in bufferedParts and any
    // reader would hang forever on a never-closing stream.
    for (const call of turn.pendingQuestions.values()) {
      if (!call.resolved) {
        call.resolved = true
        try {
          call.abortCleanup?.()
        } catch {}
        call.abortCleanup = undefined
        call.resolve({
          content: [{ type: "text", text: reason }],
          isError: true,
        })
      } else {
        try {
          call.abortCleanup?.()
        } catch {}
        call.abortCleanup = undefined
      }
    }
    turn.pendingQuestions.clear()
    turn.dispatchedCallIds.clear()

    if (s.proc && !s.proc.isClosed && s.acpSessionId) {
      try {
        await s.proc.cancel(s.acpSessionId)
      } catch {}
    }
    this.finishControllerWithError(turn, new Error(reason))
    s.activeTurn = undefined
    this.notifyChanged(sessionID)
  }

  private finishTurnCleanStop(
    s: BridgeSession,
    turn: ActiveTurn,
    text: string,
    rawFinish: string,
    local = false,
  ): void {
    if (turn.flushTimer) {
      clearTimeout(turn.flushTimer)
      turn.flushTimer = undefined
    }
    for (const call of turn.pendingQuestions.values()) {
      if (!call.resolved) {
        call.resolved = true
        try {
          call.abortCleanup?.()
        } catch {}
        call.abortCleanup = undefined
        call.resolve({
          content: [{ type: "text", text }],
          isError: true,
        })
      } else {
        try {
          call.abortCleanup?.()
        } catch {}
        call.abortCleanup = undefined
      }
    }
    turn.pendingQuestions.clear()
    turn.dispatchedCallIds.clear()

    this.closeOpenBlocks(turn)
    this.finishUnconfirmedNativeTools(turn)
    const textId = `t_${++turn.partSeq}`
    const meta = local
      ? { providerMetadata: { [this.providerID]: { localStatus: true } } }
      : { providerMetadata: this.acpMarker }
    this.emitPart(turn, {
      type: "text-start",
      id: textId,
      ...meta,
    })
    this.emitPart(turn, {
      type: "text-delta",
      id: textId,
      delta: text,
    })
    this.emitPart(turn, {
      type: "text-end",
      id: textId,
      ...meta,
    })
    this.emitPart(turn, {
      type: "finish",
      finishReason: { unified: "stop", raw: rawFinish },
      usage: buildUsage(turn.promptResult?.usage, s.lastContextUsed),
      ...meta,
    })
    const ctrl = this.detachController(turn)
    try {
      ctrl?.close()
    } catch {}
    if (s.activeTurn === turn) {
      s.activeTurn = undefined
    }
  }

  async disposeAll(): Promise<void> {
    this.disposed = true
    // Let an in-flight spare warm settle, then dispose it so zero orphan procs leak.
    const warmLock = this.warmSpareLock
    if (warmLock) {
      try {
        await warmLock
      } catch {}
    }
    const spare = this.warmSpare
    if (spare) {
      this.warmSpare = undefined
      this.intentionallyDisposed.add(spare.proc)
      this.activeProcs.delete(spare.proc)
      try {
        await spare.proc.dispose()
      } catch {}
    }
    const snapshot = [...this.sessions.values()]
    for (const s of snapshot) {
      if (s.activeTurn) {
        this.finishTurnCleanStop(
          s,
          s.activeTurn,
          "Plugin reloaded (e.g. file saved during development) — agy sessions were torn down. Send a new message to continue; Antigravity resumes its own session.",
          "plugin_unloaded",
          true,
        )
      }
    }
    const disposeJobs: Promise<void>[] = []
    for (const s of snapshot) {
      if (s.proc) {
        const proc = s.proc
        const acpSid = s.acpSessionId
        this.intentionallyDisposed.add(proc)
        s.proc = undefined
        s.acpSessionId = undefined
        if (!proc.isClosed && acpSid) {
          try {
            proc.notifyCancel(acpSid)
          } catch {}
        }
        this.activeProcs.delete(proc)
        disposeJobs.push(
          (async () => {
            try {
              await proc.dispose()
            } catch {}
          })(),
        )
      }
    }
    await Promise.allSettled(disposeJobs)
    const remaining = [...this.activeProcs]
    await Promise.allSettled(
      remaining.map(async (proc) => {
        this.intentionallyDisposed.add(proc)
        try {
          await proc.dispose()
        } catch {}
      }),
    )
    this.activeProcs.clear()
    this.sessions.clear()
    this.warmedIdleSessions.length = 0
  }

  private notifyChanged(sessionID: string): void {
    try {
      this.onStateChanged?.(sessionID)
    } catch {}
  }

  private async runStorageGet(sessionID: string): Promise<string | undefined> {
    try {
      const val = await Effect.runPromise(this.ctx.storage.get(`${this.keys.session}${sessionID}`))
      return typeof val === "string" && val.length > 0 ? val : undefined
    } catch {
      return undefined
    }
  }

  private async runStorageSet(sessionID: string, acpSessionId: string): Promise<void> {
    try {
      await Effect.runPromise(
        this.ctx.storage.set(`${this.keys.session}${sessionID}`, acpSessionId),
      )
    } catch {}
  }

  private async runStorageRemove(sessionID: string): Promise<void> {
    try {
      await Effect.runPromise(this.ctx.storage.remove(`${this.keys.session}${sessionID}`))
    } catch {}
    try {
      await Effect.runPromise(this.ctx.storage.remove(`${this.keys.turns}${sessionID}`))
    } catch {}
  }

  private async loadDeliveredTurns(sessionID: string): Promise<DeliveredTurns | undefined> {
    try {
      const raw = await Effect.runPromise(this.ctx.storage.get(`${this.keys.turns}${sessionID}`))
      return isDeliveredTurns(raw) ? raw : undefined
    } catch {
      return undefined
    }
  }

  private async saveDeliveredTurns(sessionID: string, record: DeliveredTurns): Promise<void> {
    try {
      await Effect.runPromise(
        this.ctx.storage.set(`${this.keys.turns}${sessionID}`, record as any),
      )
    } catch {}
  }

  private async ensureAcpSession(
    s: BridgeSession,
    opts?: { readonly retryOnStale?: boolean; readonly markResumeLost?: boolean },
  ): Promise<{ proc: AcpProcess; acpSessionId: string; resumeLost: boolean }> {
    if (this.disposed) throw new PluginDisposedError()
    // Join in-flight work instead of fanning out: every waiter that survives a
    // superseded lock re-reads state, so only one spawner ever exists and no
    // orphan procs are left behind. Each continue follows a settled await, so
    // the loop always terminates (return or single-spawner break).
    for (;;) {
      if (this.disposed) throw new PluginDisposedError()
      // A reset in progress tears down proc + storage; wait for its completion
      // barrier before reading storage or spawning a replacement.
      const reset = s.resetLock
      if (reset) {
        try {
          await reset
        } catch {}
        continue
      }
      const lock = s.startLock
      if (lock) {
        try {
          await lock
        } catch (err) {
          if (!(err instanceof StaleAcpStartError)) throw err
        }
        continue
      }
      if (s.proc && !s.proc.isClosed && s.acpSessionId) {
        return { proc: s.proc, acpSessionId: s.acpSessionId, resumeLost: false }
      }
      break
    }
    if (this.disposed) throw new PluginDisposedError()

    // Capture the generation up front: a concurrent resetSession() invalidates
    // this start before it installs s.proc. Re-checked after every await below
    // so an invalidation landing mid-start aborts before any further side
    // effects (spawn, storage read, resume, session/new), not just before install.
    const startGeneration = s.startGeneration
    const throwIfStale = () => {
      if (s.startGeneration !== startGeneration) throw new StaleAcpStartError()
    }
    let resumeFailed = false
    // Boxed so the adoption below survives analysis: assignments made inside
    // the start closure are invisible to outer control-flow narrowing, which
    // would otherwise shrink a plain `let` to its `undefined` initializer.
    const adoption: { winner?: { proc: AcpProcess; acpSessionId: string } } = {}
    const startPromise = (async () => {
      try {
        const info = await Effect.runPromise(
          this.ctx.session.get({ sessionID: s.sessionID as any }),
        )
        const dir = (info as any)?.location?.directory ?? (info as any)?.directory
        if (typeof dir === "string" && dir.length > 0) {
          s.cwd = dir
        }
      } catch {}

      if (this.disposed) throw new PluginDisposedError()
      throwIfStale()

      let disposedByBridge = false
      // Reuse the session's live proc when its ACP session was dropped but the
      // proc survived (no respawn/re-auth). Otherwise claim a pre-warmed spare
      // when it matches this session's cwd (already initialize()d +
      // authenticate()d). Otherwise spawn fresh.
      let proc: AcpProcess
      let claimedSpare = false
      let reusedLiveProc = false
      const spare = this.warmSpare
      if (s.proc && !s.proc.isClosed) {
        proc = s.proc
        reusedLiveProc = true
      } else if (spare && !spare.proc.isClosed && spare.cwd === s.cwd && !spare.holder.owner) {
        this.warmSpare = undefined
        spare.holder.owner = s
        proc = spare.proc
        claimedSpare = true
      } else {
        proc = this.createProcFn({
          cwd: s.cwd,
          dangerouslySkipPermissions: false,
          onUpdate: (_sid, update) => this.handleAcpUpdate(s, update),
          onPermissionRequest: (params) => this.handlePermissionRequest(s, params),
          onElicitation: (params) => this.handleElicitation(s, params),
          onExit: (code, signal, tail) => {
            this.handleProcExit(s, proc, code, signal, tail, disposedByBridge)
          },
        })
      }
      this.activeProcs.add(proc)

      try {
        if (!claimedSpare && !reusedLiveProc) {
          await proc.initialize()
          if (this.disposed) throw new PluginDisposedError()
          // Explicit ACP auth with exactly the selected method, never another.
          // Benign already-authenticated errors are ignored so a cached sign-in works.
          try {
            await proc.authenticate()
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err)
            if (!/already (authenticated|logged in|signed in)/i.test(msg)) throw err
          }
        }
        if (this.disposed) throw new PluginDisposedError()
        // Unbounded waits above (initialize/authenticate, possibly gated for a
        // long time): re-check before touching storage or the ACP session.
        throwIfStale()

        const storedId = s.acpSessionId ?? (await this.runStorageGet(s.sessionID))
        if (s.startGeneration !== startGeneration) throw new StaleAcpStartError()
        if (this.disposed) throw new PluginDisposedError()
        let res: any
        if (storedId) {
          try {
            res = await proc.resumeSession({ sessionId: storedId, cwd: s.cwd })
          } catch {
            res = undefined
          }
          if (s.startGeneration !== startGeneration) throw new StaleAcpStartError()
          if (!res?.sessionId) resumeFailed = true
        }

        if (this.disposed) throw new PluginDisposedError()
        if (!res?.sessionId) {
          res = await proc.newSession({ cwd: s.cwd })
        }

        if (this.disposed) throw new PluginDisposedError()
        // Mode flipped (or session reset) while this start was in flight:
        // let the catch block dispose the stale proc without installing it.
        throwIfStale()
        if (s.proc && !s.proc.isClosed && s.acpSessionId) {
          // Lost a concurrent-start race after the entry check (defense in
          // depth — the join loop above normally prevents this): dispose our
          // just-created proc and adopt the winner instead of orphaning it.
          disposedByBridge = true
          this.activeProcs.delete(proc)
          await proc.dispose()
          adoption.winner = { proc: s.proc, acpSessionId: s.acpSessionId }
          return
        }
        s.proc = proc
        s.acpSessionId = String(res.sessionId)
        s.lastError = null
        // A warm-driven *replacement* (a stored id existed but resume failed)
        // owns no history: the first real turn tells the user. Persisting is
        // deferred until that turn consumes `pendingResumeLost` (see doStream),
        // so a bridge restart before turn 1 retries the prior id instead of
        // silently adopting the empty session with the notice lost. Brand-new
        // warms persist immediately so LRU eviction keeps a resumable id.
        if (resumeFailed && opts?.markResumeLost) {
          s.pendingResumeLost = true
        } else {
          await this.runStorageSet(s.sessionID, s.acpSessionId)
        }

        if (res?.models?.availableModels?.length || res?.configOptions?.length) {
          const live = normalizeCatalog(buildModelCatalog(res))
          if (live.length > 0 && catalogSignature(live) !== catalogSignature(this.catalog)) {
            const updatedAt = Date.now()
            this.catalog = live
            sharedCatalog = live
            sharedCatalogUpdatedAt = updatedAt
            void this.persistCatalog(live, updatedAt)
            if (!this.disposed) {
              this.onCatalogChanged?.()
            }
          }
        }

        if (s.mode !== "default") {
          await proc.setMode(s.acpSessionId, s.mode).catch(() => {})
          s.lastModeApplied = s.mode
        }
        if (this.disposed) throw new PluginDisposedError()
      } catch (err) {
        disposedByBridge = true
        this.activeProcs.delete(proc)
        this.intentionallyDisposed.add(proc)
        if (s.proc === proc) {
          s.proc = undefined
          s.acpSessionId = undefined
        }
        await proc.dispose()
        throw err
      }
    })()

    s.startLock = startPromise.finally(() => {
      s.startLock = undefined
    })
    try {
      await s.startLock
    } catch (err) {
      // Our own start was superseded mid-flight (reset): the stale
      // proc was already disposed without being installed. Foreground turns
      // retry once (each retry needs a fresh
      // invalidation, so no loop); background warms stay quiet so a reset
      // really tears down instead of eagerly reinstalling behind it.
      if (err instanceof StaleAcpStartError && !this.disposed) {
        if (opts?.retryOnStale === false) throw err
        return this.ensureAcpSession(s, opts)
      }
      throw err
    }
    // Adopted a concurrent winner that installed while we were in flight
    // (defense-in-depth; the join loop above normally prevents this).
    const winner = adoption.winner
    if (winner) {
      if (this.disposed) throw new PluginDisposedError()
      this.notifyChanged(s.sessionID)
      return { proc: winner.proc, acpSessionId: winner.acpSessionId, resumeLost: false }
    }
    if (this.disposed || !s.proc || !s.acpSessionId) {
      throw new PluginDisposedError()
    }
    this.notifyChanged(s.sessionID)
    return { proc: s.proc, acpSessionId: s.acpSessionId, resumeLost: resumeFailed }
  }

  private handleProcExit(
    s: BridgeSession,
    proc: AcpProcess,
    code: number | null,
    signal: NodeJS.Signals | null,
    tail: string,
    disposedByBridge = false,
  ): void {
    this.activeProcs.delete(proc)
    this.untrackWarmedIdle(s.sessionID)
    if (
      disposedByBridge ||
      this.disposed ||
      this.intentionallyDisposed.has(proc) ||
      (s.proc && s.proc !== proc)
    ) {
      return
    }
    s.lastError = `agy acp exited (code=${code}, signal=${signal})${tail ? `: ${tail.split("\n").at(-1)}` : ""}`
    s.acpSessionId = undefined
    s.lastModelId = undefined
    s.lastModeApplied = undefined
    s.settlingPrompt = undefined
    s.pendingResumeLost = undefined
    if (s.activeTurn) {
      const turn = s.activeTurn
      if (turn.flushTimer) {
        clearTimeout(turn.flushTimer)
        turn.flushTimer = undefined
      }
      this.finishControllerWithError(
        turn,
        new Error(s.lastError),
      )
      for (const c of turn.pendingQuestions.values()) {
        if (!c.resolved) {
          c.resolved = true
          try {
            c.abortCleanup?.()
          } catch {}
          c.abortCleanup = undefined
          c.resolve({ content: [{ type: "text", text: "ACP process exited" }], isError: true })
        } else {
          try {
            c.abortCleanup?.()
          } catch {}
          c.abortCleanup = undefined
        }
      }
      turn.pendingQuestions.clear()
      turn.dispatchedCallIds.clear()
      turn.bufferedParts.length = 0
      s.activeTurn = undefined
    }
    if (s.proc === proc) s.proc = undefined
    this.notifyChanged(s.sessionID)
  }

  private async handlePermissionRequest(
    s: BridgeSession,
    params: AcpPermissionRequestParams,
  ): Promise<AcpPermissionOutcome> {
    const opts = params.options ?? []
    const allowOpt =
      opts.find((o) => o.kind === "allow_once") ??
      opts.find((o) => o.kind === "allow_always" || o.optionId.includes("allow")) ??
      opts[0]
    const alwaysOpt = opts.find((o) => o.kind === "allow_always")
    const denyOpt = opts.find(
      (o) => o.kind === "reject_once" || o.kind === "reject_always" || o.optionId.includes("deny"),
    )

    // agy sends its native multiple-choice questions through the permission
    // method; their options are answers, never approvals.
    if (isAcpUserInputRequest(params)) {
      return this.askNativeChoiceQuestion(s, params)
    }

    const toolName = String(params.toolCall?.name ?? params.toolCall?.kind ?? "unknown")

    if (s.mode === "auto") {
      return allowOpt
        ? { outcome: "selected", optionId: allowOpt.optionId }
        : { outcome: "cancelled" }
    }

    const title = String(params.toolCall?.title ?? toolName)
    const resources: string[] = []
    if (Array.isArray(params.toolCall?.locations)) {
      for (const loc of params.toolCall.locations) {
        if (loc?.path) resources.push(loc.path)
      }
    }
    if (resources.length === 0) resources.push(title)

    // OpenCode offers "Allow always" only with save patterns, so it appears
    // only when agy offers allow_always, carrying agy's security warning.
    const warning = alwaysOpt ? antigravitySecurityWarning(alwaysOpt) : undefined
    try {
      await Effect.runPromise(
        this.ctx.permission.assert({
          sessionID: s.sessionID as any,
          agent: (s.contextSnapshot?.agent ?? "build") as any,
          action: `antigravity.${params.toolCall?.kind ?? toolName}`,
          resources,
          ...(alwaysOpt ? { save: resources } : {}),
          metadata: {
            tool: toolName,
            title,
            rawInput: params.toolCall?.rawInput,
            ...(warning ? { [ANTIGRAVITY_WARNING_METADATA_KEY]: warning } : {}),
          },
        }),
      )
      return allowOpt
        ? { outcome: "selected", optionId: allowOpt.optionId }
        : { outcome: "cancelled" }
    } catch {
      return denyOpt
        ? { outcome: "selected", optionId: denyOpt.optionId }
        : { outcome: "cancelled" }
    }
  }

  private async handleElicitation(
    s: BridgeSession,
    params: AcpElicitationRequestParams,
  ): Promise<AcpElicitationResponse> {
    let bridged
    try {
      bridged = elicitationToQuestions(params)
    } catch (err) {
      this.diag(s, "question bridge: failed to translate elicitation", err)
      return { action: "cancel" }
    }
    if (!bridged) {
      this.diag(s, "question bridge: declined unsupported elicitation form", undefined, {
        mode: params.mode,
      })
      return { action: "decline" }
    }
    const answers = await this.askOpenCodeQuestions(s, bridged.questions, params.toolCallId)
    if (!answers) {
      this.diag(s, "question bridge: question cancelled or unavailable")
      return { action: "cancel" }
    }
    const content = bridged.respond(answers)
    if (!content) {
      this.diag(s, "question bridge: no answers, cancelling elicitation")
      return { action: "cancel" }
    }
    return { action: "accept", content }
  }

  private async askNativeChoiceQuestion(
    s: BridgeSession,
    params: AcpPermissionRequestParams,
  ): Promise<AcpPermissionOutcome> {
    const bridged = permissionToQuestion(params)
    if (!bridged) {
      this.diag(s, "question bridge: unsupported native choice question")
      return { outcome: "cancelled" }
    }
    const answers = await this.askOpenCodeQuestions(s, [bridged.question], params.toolCall?.toolCallId)
    const optionId = bridged.respond(answers?.[0])
    if (!optionId) {
      this.diag(s, "question bridge: native choice question cancelled or unanswered")
      return { outcome: "cancelled" }
    }
    return { outcome: "selected", optionId }
  }

  /** Non-fatal diagnostic for the question bridge; never surfaces as an error. */
  private diag(
    s: BridgeSession,
    message: string,
    err?: unknown,
    meta?: Record<string, unknown>,
  ): void {
    const detail = err instanceof Error ? err.message : err === undefined ? undefined : String(err)
    try {
      console.warn(
        `[antigravity-acp:${s.sessionID}] ${message}${detail ? ` (${detail})` : ""}`,
        meta ?? "",
      )
    } catch {}
  }

  /**
   * Asks through OpenCode's native `question` tool by emitting a tool call in
   * the active turn. Resolves with one answer list per
   * question, or `undefined` when the question is unavailable or dismissed.
   */
  private async askOpenCodeQuestions(
    s: BridgeSession,
    questions: readonly OpenCodeQuestion[],
    toolCallIdHint?: string,
  ): Promise<Array<string[] | undefined> | undefined> {
    const turn = s.activeTurn
    if (!turn || !s.contextSnapshot?.hasQuestionTool) {
      this.diag(s, "question bridge: OpenCode question tool unavailable")
      return undefined
    }
    const nativeToolCallId = this.findNativeQuestionCall(turn, questions, toolCallIdHint)
    if (!nativeToolCallId) {
      this.diag(s, "question bridge: could not identify agy's ask_question call", undefined, {
        openNativeTools: [...turn.activeNativeTools.keys()].length,
      })
    }

    const toolCallId = `oc_question_${++turn.partSeq}_${Math.random().toString(36).slice(2, 8)}`
    const result = await new Promise<ToolResultForAgy>((resolve) => {
      turn.pendingQuestions.set(toolCallId, {
        toolCallId,
        openCodeToolName: OPENCODE_QUESTION_TOOL,
        args: { questions },
        emittedToOpenCode: false,
        resolved: false,
        resolve,
        nativeToolCallId,
        bypassNativeTools: nativeToolCallId === undefined,
      })
      this.scheduleFlushToolCalls(turn)
    })
    if (result.isError) return undefined
    const parsed = parseQuestionToolAnswers(result.content.map((c) => c.text).join("\n"), questions)
    if (!parsed) this.diag(s, "question bridge: could not parse OpenCode answers")
    return parsed
  }

  /**
   * Identifies agy's open ask_question call: the ACP-provided tool call ID,
   * else the open call whose title/name/input names the question or the
   * ask_question tool. Never guesses an unrelated tool: settling the wrong
   * call would fabricate its result and drop its real output.
   */
  private findNativeQuestionCall(
    turn: ActiveTurn,
    questions: readonly OpenCodeQuestion[],
    hint?: string,
  ): string | undefined {
    if (hint && turn.activeNativeTools.has(hint)) return hint
    const open = [...turn.activeNativeTools.keys()]
    const firstQuestion = questions[0]?.question
    if (firstQuestion) {
      const byText = open.find((id) => turn.nativeToolText?.get(id)?.includes(firstQuestion))
      if (byText) return byText
    }
    return open.find((id) => /ask_question/i.test(turn.nativeToolText?.get(id) ?? ""))
  }

  private scheduleFlushToolCalls(turn: ActiveTurn): void {
    if (turn.flushTimer) clearTimeout(turn.flushTimer)
    turn.flushTimer = setTimeout(() => {
      turn.flushTimer = undefined
      this.tryFlushToolCalls(turn)
    }, 60)
  }

  private tryFlushToolCalls(turn: ActiveTurn): void {
    if (!turn.controller) return
    const unsent = [...turn.pendingQuestions.values()].filter((c) => !c.emittedToOpenCode)
    if (unsent.length === 0) return

    // agy's own ask_question call stays open until it is answered, so close
    // just that call here (only when it was positively identified); its later
    // updates are ignored. Text blocks close before the tool-result, matching
    // the rest of this file's ordering.
    const settleIds = new Set<string>()
    for (const call of unsent) {
      if (call.nativeToolCallId) settleIds.add(call.nativeToolCallId)
    }
    const bypass = unsent.some((c) => c.bypassNativeTools)
    if (settleIds.size > 0) {
      this.closeOpenBlocks(turn)
      for (const id of settleIds) this.settleNativeToolForUserInput(turn, id)
    }
    // Remaining open native tools block the normal flush. A question with no
    // identifiable native call may still ask the user, so it is not dropped.
    if (turn.activeNativeTools.size > 0 && !bypass) return
    if (settleIds.size === 0) this.closeOpenBlocks(turn)

    for (const call of unsent) {
      call.emittedToOpenCode = true
      turn.dispatchedCallIds.add(call.toolCallId)
      const jsonInput = JSON.stringify(call.args ?? {})
      this.emitPart(turn, {
        type: "tool-input-start",
        id: call.toolCallId,
        toolName: call.openCodeToolName,
        providerExecuted: false,
      })
      this.emitPart(turn, {
        type: "tool-input-delta",
        id: call.toolCallId,
        delta: jsonInput,
      })
      this.emitPart(turn, {
        type: "tool-input-end",
        id: call.toolCallId,
      })
      this.emitPart(turn, {
        type: "tool-call",
        toolCallId: call.toolCallId,
        toolName: call.openCodeToolName,
        input: jsonInput,
        providerExecuted: false,
        providerMetadata: this.acpMarker,
      })
    }

    const finishReason: LanguageModelV3FinishReason = {
      unified: "tool-calls",
      raw: "tool_calls",
    }
    this.emitPart(turn, {
      type: "finish",
      finishReason,
      usage: buildUsage(),
      providerMetadata: this.acpMarker,
    })
    const ctrl = this.detachController(turn)
    try {
      ctrl?.close()
    } catch {}
  }

  private detachController(turn: ActiveTurn): ReadableStreamDefaultController<LanguageModelV3StreamPart> | undefined {
    const ctrl = turn.controller
    turn.controller = undefined
    const cleanup = turn.controllerCleanup
    turn.controllerCleanup = undefined
    cleanup?.()
    return ctrl
  }

  private createBoundStream(
    s: BridgeSession,
    turn: ActiveTurn,
    abortSignal: AbortSignal | undefined,
    onStart: (controller: ReadableStreamDefaultController<LanguageModelV3StreamPart>) => void,
  ): ReadableStream<LanguageModelV3StreamPart> {
    let stepController: ReadableStreamDefaultController<LanguageModelV3StreamPart> | undefined
    return new ReadableStream<LanguageModelV3StreamPart>({
      start: (controller) => {
        stepController = controller
        turn.controller = controller
        if (abortSignal) {
          const onAbort = () => {
            if (turn.controller === stepController) {
              void this.handleInterrupt(s.sessionID, "Aborted")
            }
          }
          if (abortSignal.aborted) {
            onAbort()
          } else {
            abortSignal.addEventListener("abort", onAbort, { once: true })
            turn.controllerCleanup = () => abortSignal.removeEventListener("abort", onAbort)
          }
        }
        controller.enqueue({ type: "stream-start", warnings: [] })
        onStart(controller)
      },
      cancel: () => {
        if (turn.controller === stepController) {
          void this.handleInterrupt(s.sessionID, "Stream cancelled")
        }
      },
    })
  }

  private emitPart(turn: ActiveTurn, part: LanguageModelV3StreamPart): void {
    if (turn.controller) {
      try {
        turn.controller.enqueue(part)
        return
      } catch {}
    }
    turn.bufferedParts.push(part)
  }

  /** A plugin notice shown in the turn; marked local so it is never sent to agy. */
  private emitLocalNotice(turn: ActiveTurn, text: string): void {
    const id = `t_${++turn.partSeq}`
    const meta = { providerMetadata: { [this.providerID]: { localStatus: true } } }
    this.emitPart(turn, { type: "text-start", id, ...meta })
    this.emitPart(turn, { type: "text-delta", id, delta: text })
    this.emitPart(turn, { type: "text-end", id, ...meta })
  }

  private closeOpenBlocks(turn: ActiveTurn): void {
    if (turn.openReasoningId) {
      const id = turn.openReasoningId
      turn.openReasoningId = undefined
      this.emitPart(turn, {
        type: "reasoning-end",
        id,
        providerMetadata: this.acpMarker,
      })
    }
    if (turn.openTextId) {
      const id = turn.openTextId
      turn.openTextId = undefined
      this.emitPart(turn, {
        type: "text-end",
        id,
        providerMetadata: this.acpMarker,
      })
    }
  }

  private finishControllerWithError(turn: ActiveTurn, error: Error): void {
    const ctrl = this.detachController(turn)
    if (!ctrl) {
      turn.bufferedParts.push({ type: "error", error })
      return
    }
    try {
      ctrl.enqueue({ type: "error", error })
      ctrl.close()
    } catch {}
  }

  private handleAcpUpdate(s: BridgeSession, update: AcpSessionUpdate): void {
    const kind = update.sessionUpdate
    if (kind === "session_info_update" && typeof update.title === "string" && update.title.trim()) {
      const title = update.title.trim()
      if (s.lastTitleSent !== title) {
        s.lastTitleSent = title
        Effect.runFork(
          this.ctx.session.update({ sessionID: s.sessionID as any, title }).pipe(
            Effect.catch(() => Effect.void),
          ),
        )
      }
      return
    }

    if (kind === "current_mode_update") {
      const modeId = String(update.currentModeId ?? "")
      if (ACP_MODES.has(modeId as AcpMode) && s.mode !== modeId) {
        s.mode = modeId as AcpMode
        s.lastModeApplied = s.mode
        this.notifyChanged(s.sessionID)
      }
      return
    }

    if (kind === "usage_update") {
      if (typeof update.used === "number" && Number.isFinite(update.used) && update.used >= 0) {
        s.lastContextUsed = update.used
      }
      return
    }

    const turn = s.activeTurn
    if (!turn || turn.abortedOnApiError) return

    if (kind === "agent_thought_chunk") {
      const text = (update.content as any)?.text
      if (typeof text !== "string" || text.length === 0) return
      if (turn.openTextId) {
        const tid = turn.openTextId
        turn.openTextId = undefined
        this.emitPart(turn, {
          type: "text-end",
          id: tid,
          providerMetadata: this.acpMarker,
        })
      }
      if (!turn.openReasoningId) {
        turn.openReasoningId = `r_${++turn.partSeq}`
        this.emitPart(turn, {
          type: "reasoning-start",
          id: turn.openReasoningId,
          providerMetadata: this.acpMarker,
        })
      }
      this.emitPart(turn, {
        type: "reasoning-delta",
        id: turn.openReasoningId,
        delta: text,
      })
      return
    }

    if (kind === "agent_message_chunk") {
      const text = (update.content as any)?.text
      if (typeof text !== "string" || text.length === 0) return

      if (API_ERROR_ABORT_PATTERN.test(text)) {
        turn.abortedOnApiError = true
        if (isGlobalBreakerError(text)) {
          // Fatal/auth-level: trip the global breaker and tear the session down.
          const rec = this.tripCircuitBreaker(text, "global")
          s.lastError = rec.reason
          void this.runStorageRemove(s.sessionID)

          const proc = s.proc
          const sid = s.acpSessionId
          s.proc = undefined
          s.acpSessionId = undefined
          s.lastModelId = undefined
          s.lastModeApplied = undefined
          s.settlingPrompt = undefined
          if (proc) {
            this.intentionallyDisposed.add(proc)
            this.activeProcs.delete(proc)
            if (!proc.isClosed) {
              if (sid) proc.notifyCancel(sid)
              proc.killImmediate()
            }
          }

          this.finishTurnCleanStop(
            s,
            turn,
            `Antigravity ACP halted immediately after 1st upstream error to prevent retry loops:\n${text.trim()}`,
            "api_error_halted",
          )
        } else {
          // Model-pool quota: trip only this model's bucket and keep the live
          // session intact (proc, acpSessionId, and storage all preserved) so
          // switching to a healthy model in another pool resumes seamlessly.
          const bucket = quotaBucketForModel(s.lastModelId ?? "")
          const rec = this.tripCircuitBreaker(text, bucket)
          s.lastError = rec.reason
          if (s.proc && !s.proc.isClosed && s.acpSessionId) {
            s.proc.notifyCancel(s.acpSessionId)
          }

          this.finishTurnCleanStop(
            s,
            turn,
            `Antigravity ACP halted this turn on a ${bucket} quota error (60s cooldown for ${bucket} models — other model pools are unaffected, switch models to continue immediately):\n${text.trim()}`,
            "quota_cooldown",
          )
        }
        this.notifyChanged(s.sessionID)
        return
      }

      if (turn.openReasoningId) {
        const rid = turn.openReasoningId
        turn.openReasoningId = undefined
        this.emitPart(turn, {
          type: "reasoning-end",
          id: rid,
          providerMetadata: this.acpMarker,
        })
      }
      if (!turn.openTextId) {
        turn.openTextId = `t_${++turn.partSeq}`
        this.emitPart(turn, {
          type: "text-start",
          id: turn.openTextId,
          providerMetadata: this.acpMarker,
        })
      }
      this.emitPart(turn, {
        type: "text-delta",
        id: turn.openTextId,
        delta: text,
      })
      return
    }

    if (kind === "tool_call" || kind === "tool_call_update") {
      const callId = String(update.toolCallId ?? "")
      if (!callId || turn.relayedUpdateIds.has(callId)) return

      const status = String(update.status ?? "")
      // OpenCode requires the result to use the name emitted on the call.
      let displayName = turn.activeNativeTools.get(callId)
      if (displayName === undefined) {
        const name = String(update.name ?? update.kind ?? "tool")
        if (kind !== "tool_call") return

        this.closeOpenBlocks(turn)
        const display = describeAcpToolCall(update)
        displayName = display.name
        turn.activeNativeTools.set(callId, displayName)
        const rawInput = update.rawInput ?? update.args ?? {}
        const jsonInput = JSON.stringify(display.input)
        ;(turn.nativeToolText ??= new Map()).set(
          callId,
          `${name}\n${update.title ?? ""}\n${JSON.stringify(rawInput)}`,
        )
        this.emitPart(turn, {
          type: "tool-input-start",
          id: callId,
          toolName: displayName,
          providerExecuted: true,
        })
        this.emitPart(turn, {
          type: "tool-input-delta",
          id: callId,
          delta: jsonInput,
        })
        this.emitPart(turn, {
          type: "tool-input-end",
          id: callId,
        })
        this.emitPart(turn, {
          type: "tool-call",
          toolCallId: callId,
          toolName: displayName,
          input: jsonInput,
          providerExecuted: true,
          providerMetadata: this.acpMarker,
        })
      }

      if (status === "completed" || status === "failed" || status === "error" || status === "cancelled") {
        turn.activeNativeTools.delete(callId)
        const isError = status !== "completed"
        const resultPayload = describeAcpToolResult(update, s.cwd)
        this.emitPart(turn, {
          type: "tool-result",
          toolCallId: callId,
          toolName: displayName,
          result: (resultPayload ?? { status }) as any,
          isError,
          providerMetadata: this.acpMarker,
        })

        // If any OpenCode questions were waiting for this native tool to settle, flush them now!
        if (turn.pendingQuestions.size > 0) {
          this.tryFlushToolCalls(turn)
        }
      }
    }
  }

  /** Closes agy's ask_question call; the OpenCode question part shows the answer. */
  private settleNativeToolForUserInput(turn: ActiveTurn, toolCallId: string): void {
    const toolName = turn.activeNativeTools.get(toolCallId)
    if (toolName === undefined) return
    turn.activeNativeTools.delete(toolCallId)
    turn.relayedUpdateIds.add(toolCallId)
    this.emitPart(turn, {
      type: "tool-result",
      toolCallId,
      toolName,
      result: { status: "asked", message: "Asked the user with OpenCode's question tool." },
      isError: false,
      providerMetadata: this.acpMarker,
    })
  }

  private finishUnconfirmedNativeTools(turn: ActiveTurn): void {
    for (const [toolCallId, toolName] of turn.activeNativeTools) {
      this.emitPart(turn, {
        type: "tool-result",
        toolCallId,
        toolName,
        result: {
          status: "unknown",
          message: "ACP did not report a final status for this tool call.",
        },
        isError: true,
        providerMetadata: this.acpMarker,
      })
    }
    turn.activeNativeTools.clear()
  }

  private finalizeTurnStop(s: BridgeSession, turn: ActiveTurn): void {
    if (turn.flushTimer) {
      clearTimeout(turn.flushTimer)
      turn.flushTimer = undefined
    }
    for (const call of turn.pendingQuestions.values()) {
      if (!call.resolved) {
        call.resolved = true
        try {
          call.abortCleanup?.()
        } catch {}
        call.abortCleanup = undefined
        call.resolve({
          content: [{ type: "text", text: "Turn ended before OpenCode tool dispatch." }],
          isError: true,
        })
      } else {
        try {
          call.abortCleanup?.()
        } catch {}
        call.abortCleanup = undefined
      }
    }
    turn.pendingQuestions.clear()
    turn.dispatchedCallIds.clear()

    this.closeOpenBlocks(turn)
    this.finishUnconfirmedNativeTools(turn)

    const stopReason = turn.promptResult?.stopReason
    const unified: LanguageModelV3FinishReason["unified"] =
      stopReason === "max_tokens" ? "length" : "stop"

    this.emitPart(turn, {
      type: "finish",
      finishReason: { unified, raw: stopReason ?? "end_turn" },
      usage: buildUsage(turn.promptResult?.usage, s.lastContextUsed),
      providerMetadata: this.acpMarker,
    })

    const ctrl = this.detachController(turn)
    try {
      ctrl?.close()
    } catch {}
    if (s.activeTurn === turn) {
      s.activeTurn = undefined
    }
    this.notifyChanged(s.sessionID)
  }

  private createImmediateTextStream(
    text: string,
    rawFinish: string,
  ): ReadableStream<LanguageModelV3StreamPart> {
    // Local harness statuses (cooldown blocks, restarts, missing CLI), not
    // turns that ran through `agy acp`. Tagged with a localStatus marker so
    // hasNonAcpAssistantHistory skips them: they are not another model's turn.
    const id = "t_1"
    const localMeta = { providerMetadata: { [this.providerID]: { localStatus: true } } } as const
    return new ReadableStream<LanguageModelV3StreamPart>({
      start: (controller) => {
        controller.enqueue({ type: "stream-start", warnings: [] })
        controller.enqueue({
          type: "text-start",
          id,
          ...localMeta,
        })
        controller.enqueue({ type: "text-delta", id, delta: text })
        controller.enqueue({
          type: "text-end",
          id,
          ...localMeta,
        })
        controller.enqueue({
          type: "finish",
          finishReason: { unified: "stop", raw: rawFinish },
          usage: buildUsage(),
          ...localMeta,
        })
        controller.close()
      },
    })
  }

  createLanguageModel(modelID: string): LanguageModelV3 {
    const bridge = this
    return {
      specificationVersion: "v3",
      provider: bridge.providerID,
      modelId: modelID,
      supportedUrls: {},
      async doGenerate(options: LanguageModelV3CallOptions) {
        const { stream } = await this.doStream(options)
        const reader = stream.getReader()
        const texts: string[] = []
        const reasonings: string[] = []
        let finishReason: LanguageModelV3FinishReason = { unified: "stop", raw: "stop" }
        let usage: LanguageModelV3Usage = buildUsage()

        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          if (value.type === "text-delta") texts.push(value.delta)
          else if (value.type === "reasoning-delta") reasonings.push(value.delta)
          else if (value.type === "finish") {
            finishReason = value.finishReason
            usage = value.usage
          } else if (value.type === "error") {
            throw value.error
          }
        }
        const content: any[] = []
        if (reasonings.length > 0) content.push({ type: "reasoning", text: reasonings.join("") })
        if (texts.length > 0) content.push({ type: "text", text: texts.join("") })
        return {
          content,
          finishReason,
          usage,
          warnings: [],
        }
      },
      async doStream(options: LanguageModelV3CallOptions) {
        if (bridge.disposed) {
          return {
            stream: bridge.createImmediateTextStream(
              "Antigravity ACP plugin was disabled or reloaded. Send a new message to continue.",
              "plugin_disposed",
            ),
          }
        }
        const hdrs = options.headers ?? {}
        const sessionID = String(hdrs["x-opencode-session-id"] ?? "__default__")
        const variant = String(hdrs["x-opencode-variant"] ?? "") || undefined
        // Only the user's own turns reach agy. OpenCode's auxiliary requests
        // (compaction, generate) would send OpenCode-written prompts as turns.
        const requestKind = String(hdrs["x-opencode-request-kind"] ?? "primary")
        if (requestKind === "title") {
          return { stream: bridge.createImmediateTextStream("Antigravity session", "local_title") }
        }
        if (requestKind !== "primary") {
          return {
            stream: bridge.createImmediateTextStream(
              `Antigravity doesn't run OpenCode ${requestKind} requests. It manages its own context; send /compact to have Antigravity compact its conversation.`,
              "unsupported_request",
            ),
          }
        }
        const s = bridge.getOrCreateSession(sessionID)

        // Check if this is an OpenCode tool-result continuation step for an active ACP turn
        const existingTurn = s.activeTurn
        if (existingTurn && existingTurn.dispatchedCallIds.size > 0) {
          const matchedResults = extractToolResultsFromPrompt(
            options.prompt,
            existingTurn.dispatchedCallIds,
          )
          if (matchedResults.size > 0) {
            const stream = bridge.createBoundStream(s, existingTurn, options.abortSignal, (controller) => {
              while (existingTurn.bufferedParts.length > 0) {
                controller.enqueue(existingTurn.bufferedParts.shift()!)
              }

              // Feed OpenCode's question answers back to the waiting agy questions
              for (const callId of [...existingTurn.dispatchedCallIds]) {
                existingTurn.dispatchedCallIds.delete(callId)
                const pending = existingTurn.pendingQuestions.get(callId)
                if (!pending) continue
                existingTurn.pendingQuestions.delete(callId)
                if (!pending.resolved) {
                  pending.resolved = true
                  try {
                    pending.abortCleanup?.()
                  } catch {}
                  pending.abortCleanup = undefined
                  const res = matchedResults.get(callId) ?? {
                    text: "Tool result missing for " + callId,
                    isError: true,
                  }
                  pending.resolve({
                    content: [{ type: "text", text: res.text }],
                    isError: res.isError,
                  })
                } else {
                  try {
                    pending.abortCleanup?.()
                  } catch {}
                  pending.abortCleanup = undefined
                }
              }

              if (existingTurn.promptSettled) {
                if (existingTurn.promptError) {
                  bridge.finishControllerWithError(existingTurn, existingTurn.promptError)
                  s.activeTurn = undefined
                } else {
                  bridge.finalizeTurnStop(s, existingTurn)
                }
              } else if (!existingTurn.flushTimer && existingTurn.pendingQuestions.size > 0) {
                bridge.scheduleFlushToolCalls(existingTurn)
              }
            })
            return { stream }
          }

          // Mismatched turn (user interrupted & sent new prompt): tear down stale activeTurn
          await bridge.handleInterrupt(sessionID, "Superseded by new prompt")
        } else if (existingTurn) {
          await bridge.handleInterrupt(sessionID, "Superseded by new prompt")
        }

        // T3 Code keeps a thread on one provider. A session that already has
        // replies from another model stays there: Antigravity is never handed
        // that model's conversation.
        if (hasNonAcpAssistantHistory(options.prompt)) {
          return {
            stream: bridge.createImmediateTextStream(FOREIGN_HISTORY_MESSAGE, "foreign_history"),
          }
        }

        let target: ReturnType<typeof resolveAcpModelTarget>
        try {
          target = resolveAcpModelTarget(bridge.getModels(), modelID, variant)
        } catch (err) {
          if (!(err instanceof UnavailableModelError)) throw err
          return { stream: bridge.createImmediateTextStream(err.message, "model_unavailable") }
        }

        if (isSyntheticRestartAfterError(options.prompt)) {
          return {
            stream: bridge.createImmediateTextStream(
              "Skipped auto-resume after server restart because the previous Antigravity turn halted on an API error. Send a new message when ready.",
              "restart_skipped",
            ),
          }
        }

        await bridge.loadPersistedCooldown()

        // Per-pool breaker: the global cooldown blocks everything, otherwise
        // only the current turn's quota pool is gated — switching pools works
        // with zero lockout.
        const activeCooldown = bridge.cooldownForModel(modelID)
        if (activeCooldown) {
          const secs = Math.ceil((activeCooldown.until - Date.now()) / 1000)
          return {
            stream: bridge.createImmediateTextStream(
              `Antigravity ACP cooldown active (${secs}s remaining) after upstream API error (${activeCooldown.reason}) to protect your account from retry loops.`,
              "circuit_open",
            ),
          }
        }

        // A real turn is starting on this session: it is no longer an idle
        // warmed session, so drop it from the LRU pool (eviction only bounds
        // sessions that never ran a turn).
        bridge.untrackWarmedIdle(sessionID)

        // Foreground reservation: protects `s.proc` from idle-LRU eviction
        // while ensureAcpSession / setModel await. Released once s.activeTurn
        // is installed (which then protects the session) or on early exit.
        s.foregroundCount = (s.foregroundCount ?? 0) + 1
        try {
          // A quota-cancelled prompt resolves asynchronously server-side; don't
        // fire a new prompt on the same live proc until the previous one has
        // settled. `s.settlingPrompt` stays installed as the shared recovery
        // barrier until the cancelled prompt settles OR the wedged proc is
        // replaced (including storage cleanup) — it is never cleared before
        // awaiting, so concurrent follow-ups all join the same barrier instead
        // of racing past it. Bounded wait — a wedged proc is torn down instead.
        // The wait is tied to the exact proc + startGeneration that owned the
        // prompt: only that owner is disposed, and only if still current.
        const settling = s.settlingPrompt
        const settlingProc = s.proc
        const settlingGeneration = s.startGeneration
        if (settling) {
          let settleTimer: ReturnType<typeof setTimeout> | undefined
          const hung = await Promise.race([
            settling.then(
              () => false,
              () => false,
            ),
            new Promise<true>((resolve) => {
              settleTimer = setTimeout(() => resolve(true), SETTLING_PROMPT_TIMEOUT_MS)
            }),
          ])
          if (settleTimer) clearTimeout(settleTimer)
          if (hung) {
            if (
              settlingProc &&
              !settlingProc.isClosed &&
              s.proc === settlingProc &&
              s.startGeneration === settlingGeneration &&
              s.settlingPrompt === settling
            ) {
              bridge.intentionallyDisposed.add(settlingProc)
              bridge.activeProcs.delete(settlingProc)
              s.proc = undefined
              s.acpSessionId = undefined
              // Drop cached model/mode targets so the replacement proc below
              // is (re)configured instead of inheriting the wedged state.
              s.lastModelId = undefined
              s.lastModeApplied = undefined
              s.lastError =
                "Previous Antigravity prompt did not settle in time; started a fresh session."
              // Await the removal so the replacement session below never
              // resumes the wedged id, even if storage is slow.
              await bridge.runStorageRemove(sessionID)
              try {
                await settlingProc.dispose()
              } catch {}
              // Replaced (including storage cleanup): release the barrier.
              if (s.settlingPrompt === settling) s.settlingPrompt = undefined
            }
          }
          // Settled path: the tracked prompt clears `s.settlingPrompt` itself
          // on settle; the barrier stays until it does, so a concurrent
          // follow-up still joins it rather than racing past.
        }

        // The settling prompt may have tripped a pool breaker while we waited:
        // recheck AFTER the barrier (and before ensureAcpSession) so the
        // follow-up is blocked for that pool while unrelated pools proceed.
        {
          const postSettleCooldown = bridge.cooldownForModel(modelID)
          if (postSettleCooldown) {
            const secs = Math.ceil((postSettleCooldown.until - Date.now()) / 1000)
            return {
              stream: bridge.createImmediateTextStream(
                `Antigravity ACP cooldown active (${secs}s remaining) after upstream API error (${postSettleCooldown.reason}) to protect your account from retry loops.`,
                "circuit_open",
              ),
            }
          }
        }

        // Like T3 Code's rollback: when OpenCode's history no longer holds
        // a message agy received (revert, undo, edit), continuing agy's
        // session would answer from removed turns. Replace it with a fresh
        // session that gets the kept conversation instead.
        const turnHistory = readTurnHistory(options.prompt)
        const delivered = await bridge.loadDeliveredTurns(sessionID)
        let rewound = false
        if (delivered && historyDiverged(delivered, turnHistory)) {
          const currentAcpId = s.acpSessionId ?? (await bridge.runStorageGet(sessionID))
          if (currentAcpId === delivered.acpSessionId) {
            bridge.diag(s, "rewind: OpenCode history diverged from agy session; starting fresh")
            await bridge.resetSession(sessionID)
            rewound = true
          }
        }

        let ensured: { proc: AcpProcess; acpSessionId: string; resumeLost: boolean }
        try {
          ensured = await bridge.ensureAcpSession(s)
        } catch (err) {
          if (err instanceof PluginDisposedError || bridge.disposed) {
            return {
              stream: bridge.createImmediateTextStream(
                "Antigravity ACP plugin was disabled or reloaded. Send a new message to continue.",
                "plugin_disposed",
              ),
            }
          }
          if (err instanceof AgyNotFoundError || (err as NodeJS.ErrnoException)?.code === "ENOENT") {
            const msg = err instanceof Error ? err.message : String(err)
            s.lastError = msg
            bridge.notifyChanged(sessionID)
            return {
              stream: bridge.createImmediateTextStream(msg, "agy_unavailable"),
            }
          }
          const signIn = bridge.signInRequiredMessage(err)
          if (signIn) {
            s.lastError = signIn
            bridge.notifyChanged(sessionID)
            return { stream: bridge.createImmediateTextStream(signIn, "sign_in_required") }
          }
          throw err
        }
        let { proc, acpSessionId, resumeLost } = ensured
        let ensuredGeneration = s.startGeneration

        // Apply model + thinking level target. agy rejecting both forms is
        // reported, never replaced by whichever model the session had.
        const applyModelTarget = async (): Promise<void> => {
          if (s.lastModelId !== target.acpModelId) {
            try {
              await proc.setModel(acpSessionId, target.acpModelId)
            } catch (setModelErr) {
              // Runtimes that list base models take the model and level as config options.
              try {
                await proc.setConfigOption(acpSessionId, "model", target.baseModelId)
                if (target.thoughtLevel) {
                  await proc.setConfigOption(acpSessionId, "thought_level", target.thoughtLevel)
                }
              } catch {
                const reason = setModelErr instanceof Error ? setModelErr.message : String(setModelErr)
                throw new UnavailableModelError(
                  `Antigravity did not accept the model "${target.acpModelId}" (${reason.split("\n")[0]}). Pick another Antigravity model.`,
                )
              }
            }
            s.lastModelId = target.acpModelId
          }
        }
        try {
          await applyModelTarget()
        } catch (err) {
          if (!(err instanceof UnavailableModelError)) throw err
          s.lastError = err.message
          bridge.notifyChanged(sessionID)
          return { stream: bridge.createImmediateTextStream(err.message, "model_unavailable") }
        }

        // A resetSession landing during setModel disposes `proc` and clears the
        // session: revalidate BEFORE installing s.activeTurn or calling
        // proc.prompt. If the session moved on, retry setup with the current
        // session rather than prompting a disposed process. Empty session
        // slots (test-injected ensure stubs that return without installing)
        // are not stale — only a generation bump or a *different* installed
        // proc/id indicates a reset raced us.
        const isStaleInstall = (): boolean =>
          s.startGeneration !== ensuredGeneration ||
          (s.proc !== undefined && s.proc !== proc) ||
          (s.acpSessionId !== undefined && s.acpSessionId !== acpSessionId)
        if (isStaleInstall()) {
          const retry = await bridge.ensureAcpSession(s)
          proc = retry.proc
          acpSessionId = retry.acpSessionId
          resumeLost = resumeLost || retry.resumeLost
          ensuredGeneration = s.startGeneration
          await applyModelTarget()
          if (isStaleInstall()) {
            throw new StaleAcpStartError()
          }
        }

        // Like T3 Code, only the user's latest message and its attachments go
        // to agy: agy owns its session history, nothing earlier is replayed.
        // When resume failed, the new agy session has no history; the user is
        // told once instead of the conversation being sent again.
        // pendingResumeLost covers the warm path, where the replacement
        // session was installed in an earlier call.
        const hadPendingResumeLost = s.pendingResumeLost === true
        s.pendingResumeLost = undefined
        if (hadPendingResumeLost) {
          // The warm deferred its storage write until this turn consumed the flag.
          await bridge.runStorageSet(sessionID, acpSessionId)
        }
        const hasPriorTurns = options.prompt.some((m) => m.role === "assistant")
        const showResumeLost = (resumeLost || hadPendingResumeLost) && hasPriorTurns
        const promptBlocks = buildThinAcpPromptBlocks(options.prompt, {
          storeAttachment: (file) => bridge.storeAttachment(sessionID, file),
        })
        const keptConversation = rewound ? buildKeptConversation(options.prompt) : undefined
        if (keptConversation) promptBlocks.unshift({ type: "text", text: keptConversation })
        const deliveredRecord = recordDelivery(turnHistory, acpSessionId)

        const turn: ActiveTurn = {
          bufferedParts: [],
          partSeq: 0,
           activeNativeTools: new Map(),
          relayedUpdateIds: new Set(),
          pendingQuestions: new Map(),
          dispatchedCallIds: new Set(),
          promptSettled: false,
        }
        s.lastContextUsed = undefined
        s.activeTurn = turn
        bridge.notifyChanged(sessionID)

        const stream = bridge.createBoundStream(s, turn, options.abortSignal, () => {
          if (rewound) bridge.emitLocalNotice(turn, REWIND_NOTICE)
          else if (showResumeLost) bridge.emitLocalNotice(turn, RESUME_LOST_NOTICE)
          const pending = proc.prompt(acpSessionId, promptBlocks)
          if (deliveredRecord) void bridge.saveDeliveredTurns(sessionID, deliveredRecord)
          // Track the in-flight prompt so a follow-up turn waits for a
          // cancelled prompt to settle server-side before sending a new one
          // on the same live proc. Never rejects; clears itself on settle.
          const tracked: Promise<void> = pending.then(
            () => {
              if (s.settlingPrompt === tracked) s.settlingPrompt = undefined
            },
            () => {
              if (s.settlingPrompt === tracked) s.settlingPrompt = undefined
            },
          )
          s.settlingPrompt = tracked
          pending
            .then((res) => {
              if (turn.abortedOnApiError || bridge.disposed) return
              turn.promptSettled = true
              turn.promptResult = res
              // agy reports an exhausted model quota as the `refusal` stop
              // reason: cool down that quota pool like a quota error message.
              if (res?.stopReason === "refusal") {
                turn.abortedOnApiError = true
                const bucket = quotaBucketForModel(s.lastModelId ?? modelID)
                const rec = bridge.tripCircuitBreaker("quota exhausted (stop reason: refusal)", bucket)
                s.lastError = rec.reason
                bridge.finishTurnCleanStop(
                  s,
                  turn,
                  `Antigravity ACP stopped this turn: the ${bucket} model quota is exhausted (60s cooldown for this model pool; other pools are unaffected, switch models to continue).`,
                  "quota_cooldown",
                )
                bridge.notifyChanged(sessionID)
                return
              }
              s.lastError = null
              if (turn.flushTimer) {
                clearTimeout(turn.flushTimer)
                turn.flushTimer = undefined
              }
              // Wait if any OpenCode tool call is still mid-roundtrip (shouldn't happen before HTTP reply, unless aborted)
              if (turn.dispatchedCallIds.size === 0 && turn.controller) {
                bridge.finalizeTurnStop(s, turn)
              }
            })
            .catch((err) => {
              if (turn.abortedOnApiError || bridge.disposed) return
              turn.promptSettled = true
              const error = err instanceof Error ? err : new Error(String(err))
              turn.promptError = error

              if (API_ERROR_ABORT_PATTERN.test(error.message)) {
                turn.abortedOnApiError = true
                if (isGlobalBreakerError(error.message)) {
                  // Fatal/auth-level: trip the global breaker and tear the session down.
                  const rec = bridge.tripCircuitBreaker(error.message, "global")
                  s.lastError = rec.reason
                  void bridge.runStorageRemove(sessionID)
                  bridge.intentionallyDisposed.add(proc)
                  bridge.activeProcs.delete(proc)
                  if (s.proc === proc) {
                    s.proc = undefined
                    s.acpSessionId = undefined
                  }
                  s.lastModelId = undefined
                  s.lastModeApplied = undefined
                  s.settlingPrompt = undefined
                  proc.killImmediate()
                  bridge.finishTurnCleanStop(
                    s,
                    turn,
                    `Antigravity ACP halted immediately after upstream API error to prevent retry loops:\n${error.message}`,
                    "api_error_halted",
                  )
                } else {
                  // Model-pool quota: trip only this turn's bucket; keep the
                  // live proc, session id, and storage so a healthy pool
                  // resumes the same session seamlessly.
                  const rec = bridge.tripCircuitBreaker(
                    error.message,
                    quotaBucketForModel(s.lastModelId ?? modelID),
                  )
                  s.lastError = rec.reason
                  if (!proc.isClosed) {
                    proc.notifyCancel(acpSessionId)
                  }
                  bridge.finishTurnCleanStop(
                    s,
                    turn,
                    `Antigravity ACP halted this turn on a quota error (60s cooldown for this model pool — other pools are unaffected, switch models to continue immediately):\n${error.message}`,
                    "quota_cooldown",
                  )
                }
                bridge.notifyChanged(sessionID)
                return
              }

              if (turn.flushTimer) {
                clearTimeout(turn.flushTimer)
                turn.flushTimer = undefined
              }
              for (const c of turn.pendingQuestions.values()) {
                if (!c.resolved) {
                  c.resolved = true
                  try {
                    c.abortCleanup?.()
                  } catch {}
                  c.abortCleanup = undefined
                  c.resolve({ content: [{ type: "text", text: error.message }], isError: true })
                } else {
                  try {
                    c.abortCleanup?.()
                  } catch {}
                  c.abortCleanup = undefined
                }
              }
              turn.pendingQuestions.clear()
              turn.dispatchedCallIds.clear()

              s.lastError = error.message
              bridge.finishControllerWithError(turn, error)
              if (s.activeTurn === turn) s.activeTurn = undefined
              bridge.notifyChanged(sessionID)
            })
        })

        return { stream }
        } finally {
          s.foregroundCount = Math.max(0, (s.foregroundCount ?? 1) - 1)
        }
      },
    }
  }
}
