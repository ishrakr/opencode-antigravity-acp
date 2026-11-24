import { execFile, spawn, type ChildProcessWithoutNullStreams } from "node:child_process"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { StringDecoder } from "node:string_decoder"

export class AgyNotFoundError extends Error {
  constructor(binary: string) {
    super(
      `Antigravity CLI ("${binary}") was not found. Install Antigravity CLI, sign in with "agy", and ensure "agy" is in PATH (or set AGY_BIN=/path/to/agy).`,
    )
    this.name = "AgyNotFoundError"
  }
}

function isExecutableFile(filePath: string): boolean {
  try {
    const stat = fs.statSync(filePath)
    if (!stat.isFile()) return false
    fs.accessSync(
      filePath,
      process.platform === "win32" ? fs.constants.F_OK : fs.constants.X_OK,
    )
    return true
  } catch {
    return false
  }
}

export function resolveAgyBinary(env: NodeJS.ProcessEnv = process.env): string {
  const override = env.AGY_BIN?.trim()
  if (override) return override

  const candidates = process.platform === "win32" ? ["agy.exe", "agy.cmd", "agy"] : ["agy"]
  const pathDirs = (env.PATH ?? "").split(path.delimiter).filter(Boolean)
  for (const dir of pathDirs) {
    for (const name of candidates) {
      const candidate = path.join(dir, name)
      if (isExecutableFile(candidate)) return candidate
    }
  }

  const home = env.HOME || env.USERPROFILE || os.homedir()
  const fallbackPaths =
    process.platform === "win32"
      ? [
          ...(env.LOCALAPPDATA
            ? [path.join(env.LOCALAPPDATA, "Programs", "Antigravity", "bin", "agy.exe")]
            : []),
          ...(home ? [path.join(home, ".local", "bin", "agy.exe")] : []),
        ]
      : [
          ...(home
            ? [path.join(home, ".local", "bin", "agy"), path.join(home, "bin", "agy")]
            : []),
          "/opt/homebrew/bin/agy",
          "/usr/local/bin/agy",
          "/opt/Antigravity/bin/agy",
          "/usr/bin/agy",
        ]

  for (const candidate of fallbackPaths) {
    if (isExecutableFile(candidate)) return candidate
  }

  return "agy"
}

export interface AcpDiscoveredModel {
  readonly id: string
  readonly name: string
  readonly family?: string
  readonly variants: readonly {
    readonly id: string
    readonly acpModelId: string
    readonly thoughtLevel?: string
  }[]
  readonly defaultAcpModelId: string
}

export interface AcpPermissionOption {
  readonly optionId: string
  readonly name?: string
  readonly kind?: string
  readonly _meta?: Record<string, unknown>
}

export interface AcpPermissionRequestParams {
  readonly sessionId?: string
  readonly toolCall?: {
    readonly toolCallId?: string
    readonly title?: string
    readonly name?: string
    readonly kind?: string
    readonly rawInput?: unknown
    readonly locations?: ReadonlyArray<{ readonly path?: string; readonly line?: number }>
  }
  readonly options?: ReadonlyArray<AcpPermissionOption>
}

export interface AcpElicitationRequestParams {
  readonly sessionId?: string
  readonly mode?: string
  readonly message?: string
  readonly requestedSchema?: unknown
  readonly toolCallId?: string
  readonly [key: string]: unknown
}

export type AcpElicitationResponse =
  | { readonly action: "accept"; readonly content: Record<string, unknown> }
  | { readonly action: "decline" }
  | { readonly action: "cancel" }

export type AcpPermissionOutcome =
  | { readonly outcome: "selected"; readonly optionId: string }
  | { readonly outcome: "cancelled" }

export type AcpContentBlock =
  | { readonly type: "text"; readonly text: string }
  | { readonly type: "image"; readonly data: string; readonly mimeType: string }
  /** Embedded text file; agy advertises `embeddedContext`. */
  | {
      readonly type: "resource"
      readonly resource: { readonly uri: string; readonly mimeType: string; readonly text: string }
    }
  /** A file on disk that agy reads with its own tools, such as a PDF. */
  | { readonly type: "resource_link"; readonly uri: string; readonly name: string; readonly mimeType?: string }

export interface AcpSessionUpdate {
  readonly sessionUpdate: string
  readonly content?: { readonly type?: string; readonly text?: string } | ReadonlyArray<unknown>
  readonly toolCallId?: string
  readonly name?: string
  readonly title?: string
  readonly kind?: string
  readonly status?: string
  readonly args?: unknown
  readonly rawInput?: unknown
  readonly rawOutput?: unknown
  readonly locations?: unknown
  readonly used?: number
  readonly size?: number
  readonly [key: string]: unknown
}

export interface AcpPromptResult {
  readonly stopReason?: string
  readonly usage?: {
    readonly inputTokens?: number
    readonly outputTokens?: number
    readonly cachedReadTokens?: number
    readonly cachedWriteTokens?: number
    readonly thoughtTokens?: number
    readonly totalTokens?: number
    readonly input_tokens?: number
    readonly output_tokens?: number
    readonly cached_read_tokens?: number
    readonly cached_write_tokens?: number
    readonly thought_tokens?: number
    readonly total_tokens?: number
  }
}

export const FALLBACK_MODELS: readonly AcpDiscoveredModel[] = [
  {
    id: "gemini-4-neon",
    name: "Gemini 4 Neon",
    family: "gemini-4-neon",
    defaultAcpModelId: "gemini-4-neon-high",
    variants: [
      { id: "low", acpModelId: "gemini-4-neon-low", thoughtLevel: "low" },
      { id: "medium", acpModelId: "gemini-4-neon-medium", thoughtLevel: "medium" },
      { id: "high", acpModelId: "gemini-4-neon-high", thoughtLevel: "high" },
      { id: "xhigh", acpModelId: "gemini-4-neon-xhigh", thoughtLevel: "xhigh" },
    ],
  },
  {
    id: "gemini-4-argon",
    name: "Gemini 4 Argon",
    family: "gemini-4-argon",
    defaultAcpModelId: "gemini-4-argon-high",
    variants: [
      { id: "low", acpModelId: "gemini-4-argon-low", thoughtLevel: "low" },
      { id: "medium", acpModelId: "gemini-4-argon-medium", thoughtLevel: "medium" },
      { id: "high", acpModelId: "gemini-4-argon-high", thoughtLevel: "high" },
    ],
  },
  {
    id: "gemini-4-hydrogen",
    name: "Gemini 4 Hydrogen",
    family: "gemini-4-hydrogen",
    defaultAcpModelId: "gemini-4-hydrogen-high",
    variants: [
      { id: "low", acpModelId: "gemini-4-hydrogen-low", thoughtLevel: "low" },
      { id: "medium", acpModelId: "gemini-4-hydrogen-medium", thoughtLevel: "medium" },
      { id: "high", acpModelId: "gemini-4-hydrogen-high", thoughtLevel: "high" },
      { id: "xhigh", acpModelId: "gemini-4-hydrogen-xhigh", thoughtLevel: "xhigh" },
    ],
  },
  {
    id: "gemini-pro-orchestrator-neon",
    name: "Orchestrator (Neon)",
    family: "gemini-pro-orchestrator-neon",
    defaultAcpModelId: "gemini-pro-orchestrator-neon",
    variants: [],
  },
  {
    id: "gemini-pro-orchestrator-g1-pro",
    name: "Orchestrator (Argon)",
    family: "gemini-pro-orchestrator-g1-pro",
    defaultAcpModelId: "gemini-pro-orchestrator-g1-pro",
    variants: [],
  },
  {
    id: "gemini-3.8-flash",
    name: "Gemini 3.8 Flash",
    family: "gemini-3.8-flash",
    defaultAcpModelId: "gemini-3.8-flash-high",
    variants: [
      { id: "low", acpModelId: "gemini-3.8-flash-low", thoughtLevel: "low" },
      { id: "medium", acpModelId: "gemini-3.8-flash-medium", thoughtLevel: "medium" },
      { id: "high", acpModelId: "gemini-3.8-flash-high", thoughtLevel: "high" },
    ],
  },
  {
    id: "claude-opus-5-5",
    name: "Claude Opus 5.5",
    family: "claude-opus-5-5",
    defaultAcpModelId: "claude-opus-5-5-high",
    variants: [
      { id: "low", acpModelId: "claude-opus-5-5-low", thoughtLevel: "low" },
      { id: "medium", acpModelId: "claude-opus-5-5-medium", thoughtLevel: "medium" },
      { id: "high", acpModelId: "claude-opus-5-5-high", thoughtLevel: "high" },
    ],
  },
  {
    id: "claude-sonnet-5-5",
    name: "Claude Sonnet 5.5",
    family: "claude-sonnet-5-5",
    defaultAcpModelId: "claude-sonnet-5-5-high",
    variants: [
      { id: "low", acpModelId: "claude-sonnet-5-5-low", thoughtLevel: "low" },
      { id: "medium", acpModelId: "claude-sonnet-5-5-medium", thoughtLevel: "medium" },
      { id: "high", acpModelId: "claude-sonnet-5-5-high", thoughtLevel: "high" },
    ],
  },
  {
    id: "gpt-oss-120b-medium",
    name: "GPT-OSS 120B (Medium)",
    family: "gpt-oss-120b-medium",
    defaultAcpModelId: "gpt-oss-120b-medium",
    variants: [],
  },
]

/**
 * Families T3 Code's model manifest marks legacy. OpenCode hides `deprecated`
 * models from its pickers, as T3 Code hides legacy ones; a session already
 * on such a model keeps working while agy still offers it.
 */
const LEGACY_MODEL_PREFIXES = ["gemini-3.7-flash", "gemini-3.6-flash", "gemini-pro-agent", "gemini-3.1-pro"]

export function isLegacyAcpModel(id: string): boolean {
  return LEGACY_MODEL_PREFIXES.some((prefix) => id === prefix || id.startsWith(`${prefix}-`))
}

function cleanDisplayName(raw: string | undefined, fallback: string): string {
  return (raw ?? fallback).replace(/\s*\(ACP\)\s*$/i, "").trim() || fallback
}

export function buildModelCatalog(sessionResult: any): readonly AcpDiscoveredModel[] {
  const availableModels: Array<{ modelId: string; name?: string }> =
    sessionResult?.models?.availableModels ?? []
  const configOptions: Array<any> = sessionResult?.configOptions ?? []
  const modelOpt = configOptions.find((c) => c?.id === "model")
  const thoughtOpt = configOptions.find((c) => c?.id === "thought_level")
  const thoughtOrder: string[] = Array.isArray(thoughtOpt?.options)
    ? thoughtOpt.options.map((o: any) => String(o.value))
    : ["low", "medium", "high", "xhigh"]
  // agy's own default thinking level, as T3 Code keeps the session's current setting.
  const defaultLevel = typeof thoughtOpt?.currentValue === "string" ? thoughtOpt.currentValue : "high"

  const baseList: Array<{ value: string; name: string }> = Array.isArray(modelOpt?.options)
    ? modelOpt.options.map((o: any) => ({ value: String(o.value), name: String(o.name ?? o.value) }))
    : []

  if (baseList.length === 0 && availableModels.length === 0) {
    return FALLBACK_MODELS
  }

  if (baseList.length === 0) {
    return availableModels.map((m) => ({
      id: m.modelId,
      name: cleanDisplayName(m.name, m.modelId),
      family: m.modelId,
      defaultAcpModelId: m.modelId,
      variants: [],
    }))
  }

  const availIds = new Set(availableModels.map((m) => m.modelId))
  const baseIds = new Set(baseList.map((b) => b.value))
  const matchedAvailIds = new Set<string>()

  const catalog: AcpDiscoveredModel[] = baseList.map((base) => {
    const variants: Array<{ id: string; acpModelId: string; thoughtLevel?: string }> = []
    if (availIds.has(base.value)) {
      matchedAvailIds.add(base.value)
    }

    for (const level of thoughtOrder) {
      const candidate = `${base.value}-${level}`
      if (availIds.has(candidate) && !baseIds.has(candidate)) {
        variants.push({ id: level, acpModelId: candidate, thoughtLevel: level })
        matchedAvailIds.add(candidate)
      }
    }

    const prefix = `${base.value}-`
    for (const m of availableModels) {
      if (!m.modelId.startsWith(prefix) || matchedAvailIds.has(m.modelId) || baseIds.has(m.modelId)) {
        continue
      }
      const suffix = m.modelId.slice(prefix.length)
      if (!suffix) continue
      variants.push({ id: suffix, acpModelId: m.modelId, thoughtLevel: suffix })
      matchedAvailIds.add(m.modelId)
    }

    const defaultAcpModelId = availIds.has(base.value)
      ? base.value
      : variants.find((v) => v.id === defaultLevel)?.acpModelId ??
        variants.find((v) => v.id === "high")?.acpModelId ??
        variants.find((v) => v.id === "medium")?.acpModelId ??
        variants[0]?.acpModelId ??
        base.value

    return {
      id: base.value,
      name: cleanDisplayName(base.name, base.value),
      family: base.value,
      variants,
      defaultAcpModelId,
    }
  })

  for (const m of availableModels) {
    if (matchedAvailIds.has(m.modelId) || baseIds.has(m.modelId)) continue
    catalog.push({
      id: m.modelId,
      name: cleanDisplayName(m.name, m.modelId),
      family: m.modelId,
      defaultAcpModelId: m.modelId,
      variants: [],
    })
  }

  return catalog
}

export class UnavailableModelError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "UnavailableModelError"
  }
}

/**
 * Maps an OpenCode model and variant to the ID agy runs. A model or thinking
 * level agy no longer offers is an error, never a silent substitute.
 */
export function resolveAcpModelTarget(
  models: readonly AcpDiscoveredModel[],
  baseModelId: string,
  variant?: string,
): { acpModelId: string; baseModelId: string; thoughtLevel?: string } {
  const found = models.find((m) => m.id === baseModelId)
  if (!found) {
    throw new UnavailableModelError(
      `Antigravity no longer offers the model "${baseModelId}". Pick another Antigravity model; reload the model list if it is missing.`,
    )
  }
  // OpenCode sends "default" when no level is picked: use agy's default level.
  if (variant && variant !== "default") {
    const matched = found.variants.find((v) => v.id === variant)
    if (matched) {
      return {
        baseModelId: found.id,
        acpModelId: matched.acpModelId,
        thoughtLevel: matched.thoughtLevel,
      }
    }
    throw new UnavailableModelError(
      found.variants.length > 0
        ? `${found.name} has no "${variant}" thinking level in Antigravity. Pick one of: ${found.variants.map((v) => v.id).join(", ")}.`
        : `${found.name} has no thinking levels in Antigravity. Clear the "${variant}" variant.`,
    )
  }
  return {
    baseModelId: found.id,
    acpModelId: found.defaultAcpModelId,
    thoughtLevel: found.variants.find((v) => v.acpModelId === found.defaultAcpModelId)?.thoughtLevel,
  }
}

export interface AcpProcessOptions {
  readonly cwd: string
  /** The selected sign-in method; the personal Google account when omitted. */
  readonly auth?: AcpAuthConfig
  readonly binaryPath?: string
  readonly extraDirs?: readonly string[]
  readonly dangerouslySkipPermissions?: boolean
  readonly onUpdate?: (sessionId: string, update: AcpSessionUpdate) => void
  readonly onPermissionRequest?: (
    params: AcpPermissionRequestParams,
  ) => Promise<AcpPermissionOutcome>
  /** Answers form elicitations such as `ask_question`. Without it, forms are declined. */
  readonly onElicitation?: (params: AcpElicitationRequestParams) => Promise<AcpElicitationResponse>
  readonly onExit?: (code: number | null, signal: NodeJS.Signals | null, stderrTail: string) => void
  readonly onLog?: (level: "warn" | "debug", message: string, meta?: Record<string, unknown>) => void
}

interface PendingRpc {
  readonly resolve: (value: any) => void
  readonly reject: (reason?: any) => void
  readonly timer?: ReturnType<typeof setTimeout>
  readonly signal?: AbortSignal
  readonly onAbort?: () => void
}

const MAX_STDOUT_BUFFER_BYTES = 16 * 1024 * 1024

const MAX_STDERR_LINES = 200

export type AcpAuthMethodId =
  | "oauth-personal"
  | "oauth-business"
  | "gemini-api-key"
  | "agent-platform"

const KNOWN_AUTH_METHODS: readonly string[] = [
  "oauth-personal",
  "oauth-business",
  "gemini-api-key",
  "agent-platform",
]

/**
 * The sign-in method the user selected, and what it needs. Like T3 Code, the
 * plugin uses exactly this method and never falls back to another one.
 */
export interface AcpAuthConfig {
  readonly method: AcpAuthMethodId
  /** gemini-api-key: the Gemini API key. agent-platform: an Agent Platform API key. */
  readonly apiKey?: string
  /** oauth-business and agent-platform. */
  readonly gcpProject?: string
  readonly gcpLocation?: string
}

export class AcpAuthConfigError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "AcpAuthConfigError"
  }
}

function optionString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined
}

/**
 * Reads the sign-in method from the plugin options, else from
 * `ANTIGRAVITY_ACP_AUTH_METHOD`, else uses the personal Google account.
 * Credentials come only from the plugin options or the plugin's own
 * `ANTIGRAVITY_ACP_*` variables: an ambient `GEMINI_API_KEY` or `GOOGLE_*`
 * variable never selects or changes the method.
 */
export function resolveAcpAuthConfig(
  options: Readonly<Record<string, unknown>> = {},
  env: NodeJS.ProcessEnv = process.env,
): AcpAuthConfig {
  const raw = optionString(options.authMethod) ?? optionString(env.ANTIGRAVITY_ACP_AUTH_METHOD)
  if (raw !== undefined && !KNOWN_AUTH_METHODS.includes(raw)) {
    throw new AcpAuthConfigError(
      `Unknown Antigravity sign-in method "${raw}". Use one of: ${KNOWN_AUTH_METHODS.join(", ")}.`,
    )
  }
  const method = (raw ?? "oauth-personal") as AcpAuthMethodId
  const apiKey = optionString(options.apiKey) ?? optionString(env.ANTIGRAVITY_ACP_API_KEY)
  const gcpProject = optionString(options.gcpProject) ?? optionString(env.ANTIGRAVITY_ACP_GCP_PROJECT)
  const gcpLocation = optionString(options.gcpLocation) ?? optionString(env.ANTIGRAVITY_ACP_GCP_LOCATION)
  switch (method) {
    case "oauth-personal":
      return { method }
    case "oauth-business":
      return { method, gcpProject, gcpLocation }
    case "gemini-api-key":
      if (!apiKey) {
        throw new AcpAuthConfigError(
          'Sign-in method "gemini-api-key" needs an API key: set the plugin option "apiKey" or ANTIGRAVITY_ACP_API_KEY.',
        )
      }
      return { method, apiKey }
    case "agent-platform":
      if (!apiKey && !(gcpProject && gcpLocation)) {
        throw new AcpAuthConfigError(
          'Sign-in method "agent-platform" needs an API key, or a GCP project and location (plugin options "gcpProject" and "gcpLocation") with Application Default Credentials.',
        )
      }
      return { method, apiKey, gcpProject, gcpLocation }
  }
}

/** Human-readable name of a sign-in method, as T3 Code labels them. */
export function authMethodLabel(method: AcpAuthMethodId): string {
  switch (method) {
    case "oauth-personal":
      return "Google account"
    case "oauth-business":
      return "Gemini Enterprise"
    case "gemini-api-key":
      return "Gemini API key"
    case "agent-platform":
      return "Agent Platform"
  }
}

/** Ambient credentials `agy` would otherwise pick up on its own. */
const AMBIENT_CREDENTIAL_ENV_KEYS = [
  "GEMINI_API_KEY",
  "GOOGLE_API_KEY",
  "GOOGLE_CLOUD_PROJECT",
  "GOOGLE_CLOUD_LOCATION",
  "GOOGLE_GENAI_USE_VERTEXAI",
  "GOOGLE_APPLICATION_CREDENTIALS",
] as const

/**
 * Builds the child-process env for spawning `agy acp`: ambient Gemini and
 * Google credential variables are removed, then only the selected method's
 * own values are set. Agent Platform with a project keeps
 * `GOOGLE_APPLICATION_CREDENTIALS`, since Application Default Credentials
 * live on the machine. On Windows the match is case-insensitive.
 */
export function buildAgySpawnEnv(
  auth: AcpAuthConfig,
  source: NodeJS.ProcessEnv = process.env,
  platform: NodeJS.Platform = process.platform,
): Record<string, string | undefined> {
  const env: Record<string, string | undefined> = { ...source }
  const keepAdc = auth.method === "agent-platform" && !auth.apiKey
  const doomed = new Set<string>(
    AMBIENT_CREDENTIAL_ENV_KEYS.filter((k) => !(keepAdc && k === "GOOGLE_APPLICATION_CREDENTIALS")),
  )
  for (const key of Object.keys(env)) {
    if (doomed.has(platform === "win32" ? key.toUpperCase() : key)) delete env[key]
  }
  for (const key of Object.keys(env)) {
    if (key.startsWith("ANTIGRAVITY_ACP_")) delete env[key]
  }
  if (auth.method === "gemini-api-key" && auth.apiKey) {
    env.GEMINI_API_KEY = auth.apiKey
  }
  if (auth.method === "agent-platform" && auth.apiKey) {
    env.GOOGLE_API_KEY = auth.apiKey
  }
  if (auth.method === "agent-platform" || auth.method === "oauth-business") {
    if (auth.gcpProject) env.GOOGLE_CLOUD_PROJECT = auth.gcpProject
    if (auth.gcpLocation) env.GOOGLE_CLOUD_LOCATION = auth.gcpLocation
  }
  return env
}

export class AcpProcess {
  private proc: ChildProcessWithoutNullStreams
  private nextId = 1
  private pending = new Map<number, PendingRpc>()
  private buffer = ""
  private decoder = new StringDecoder("utf8")
  private stderrDecoder = new StringDecoder("utf8")
  private stderrLines: string[] = []
  private closed = false
  private exitNotified = false
  private binary: string
  readonly auth: AcpAuthConfig

  constructor(private readonly options: AcpProcessOptions) {
    this.auth = options.auth ?? { method: "oauth-personal" }
    const args = ["acp", "--stdio", "--process-per-session"]
    if (options.dangerouslySkipPermissions) {
      args.push("--dangerously-skip-permissions")
    }
    for (const dir of options.extraDirs ?? []) {
      if (dir) args.push("--add-dir", dir)
    }

    const binary = options.binaryPath ?? resolveAgyBinary()
    this.binary = binary
    this.proc = spawn(binary, args, {
      cwd: options.cwd,
      stdio: ["pipe", "pipe", "pipe"],
      env: buildAgySpawnEnv(this.auth),
      detached: process.platform !== "win32",
    })

    this.proc.stdin.on("error", (err) => {
      this.closed = true
      this.failAllPending(err)
    })

    this.proc.stdout.on("error", () => {})

    this.proc.stderr.on("error", () => {})

    this.proc.stdout.on("data", (chunk: Buffer) => {
      this.buffer += this.decoder.write(chunk)
      if (this.buffer.length > MAX_STDOUT_BUFFER_BYTES) {
        this.buffer = ""
        this.failAllPending(
          new Error(
            `ACP stdout buffer overflow: exceeded ${MAX_STDOUT_BUFFER_BYTES} bytes; agy output too large, killing process`,
          ),
        )
        this.killImmediate()
        return
      }
      let nl: number
      while ((nl = this.buffer.indexOf("\n")) !== -1) {
        const line = this.buffer.slice(0, nl).trim()
        this.buffer = this.buffer.slice(nl + 1)
        if (line.length > 0) this.handleLine(line)
      }
    })

    this.proc.stderr.on("data", (chunk: Buffer) => {
      const text = this.stderrDecoder.write(chunk)
      for (const line of text.split(/\r?\n/)) {
        if (!line.trim()) continue
        this.stderrLines.push(line)
        if (this.stderrLines.length > MAX_STDERR_LINES) this.stderrLines.shift()
      }
    })

    this.proc.on("error", (err) => {
      this.closed = true
      if ((err as NodeJS.ErrnoException)?.code === "ENOENT") {
        this.failAllPending(new AgyNotFoundError(binary))
        return
      }
      this.failAllPending(err)
    })

    this.proc.on("exit", (code, signal) => {
      this.closed = true
      const tail = this.stderrLines.join("\n")
      this.failAllPending(
        new Error(
          `agy acp exited unexpectedly (code=${code}, signal=${signal})${tail ? `\n${tail}` : ""}`,
        ),
      )
      this.notifyExit(code, signal, tail)
    })

    this.proc.on("close", (code, signal) => {
      this.closed = true
      const tail = this.stderrLines.join("\n")
      this.failAllPending(
        new Error(
          `agy acp exited unexpectedly (code=${code}, signal=${signal})${tail ? `\n${tail}` : ""}`,
        ),
      )
      this.notifyExit(code, signal, tail)
    })
  }

  get isClosed(): boolean {
    return this.closed
  }

  private notifyExit(
    code: number | null,
    signal: NodeJS.Signals | null,
    tail: string,
  ): void {
    if (this.exitNotified) return
    this.exitNotified = true
    this.options.onExit?.(code, signal, tail)
  }

  private signalProcess(sig: NodeJS.Signals): void {
    const pid = this.proc.pid
    if (pid === undefined) {
      try {
        this.proc.kill(sig)
      } catch {}
      return
    }
    if (process.platform === "win32") {
      if (sig === "SIGKILL") {
        try {
          execFile("taskkill", ["/PID", String(pid), "/T", "/F"], { windowsHide: true }, () => {})
          return
        } catch {}
      }
      try {
        this.proc.kill(sig)
      } catch {}
      return
    }
    try {
      process.kill(-pid, sig)
    } catch {
      try {
        this.proc.kill(sig)
      } catch {}
    }
  }

  private destroyStreams(): void {
    try {
      this.proc.stdin.end?.()
    } catch {}
    for (const stream of [this.proc.stdin, this.proc.stdout, this.proc.stderr] as const) {
      try {
        ;(stream as unknown as { destroy?: () => void }).destroy?.()
      } catch {}
    }
  }

  private failAllPending(err: Error): void {
    for (const [id, entry] of this.pending) {
      if (entry.timer) clearTimeout(entry.timer)
      if (entry.signal && entry.onAbort) {
        try {
          entry.signal.removeEventListener("abort", entry.onAbort)
        } catch {}
      }
      this.pending.delete(id)
      entry.reject(err)
    }
  }

  private handleLine(line: string): void {
    let msg: any
    try {
      msg = JSON.parse(line)
    } catch {
      this.options.onLog?.("warn", "Ignoring malformed ACP JSON line", {
        line: line.slice(0, 500),
      })
      return
    }

    // Response to an outbound request
    if (msg.id !== undefined && msg.method === undefined) {
      const entry = this.pending.get(Number(msg.id))
      if (!entry) {
        this.options.onLog?.("debug", "Ignoring late ACP response for removed request", {
          id: msg.id,
        })
        return
      }
      if (entry.timer) clearTimeout(entry.timer)
      if (entry.signal && entry.onAbort) {
        try {
          entry.signal.removeEventListener("abort", entry.onAbort)
        } catch {}
      }
      this.pending.delete(Number(msg.id))
      if (msg.error) {
        const err = new Error(
          typeof msg.error.message === "string"
            ? `${msg.error.message}${msg.error.code !== undefined ? ` (ACP code ${msg.error.code})` : ""}`
            : JSON.stringify(msg.error),
        )
        ;(err as any).acpCode = msg.error.code
        ;(err as any).acpData = msg.error.data
        entry.reject(err)
      } else {
        entry.resolve(msg.result)
      }
      return
    }

    // Server -> Client request (e.g. session/request_permission)
    if (msg.id !== undefined && typeof msg.method === "string") {
      void this.handleServerRequest(msg.id, msg.method, msg.params)
      return
    }

    // Notification
    if (msg.method === "session/update" && msg.params?.update) {
      const sid = String(msg.params.sessionId ?? "")
      this.options.onUpdate?.(sid, msg.params.update as AcpSessionUpdate)
    }
  }

  private async handleServerRequest(id: number | string, method: string, params: any): Promise<void> {
    if (method === "session/request_permission") {
      try {
        const outcome: AcpPermissionOutcome = this.options.onPermissionRequest
          ? await this.options.onPermissionRequest(params as AcpPermissionRequestParams)
          : await this.fallbackAutoSelect(params)
        this.write({ jsonrpc: "2.0", id, result: { outcome } })
      } catch (err) {
        this.options.onLog?.("warn", "onPermissionRequest failed; auto-cancelling", {
          error: err instanceof Error ? err.message : String(err),
        })
        this.write({
          jsonrpc: "2.0",
          id,
          result: { outcome: { outcome: "cancelled" } },
        })
      }
      return
    }

    if (method === "elicitation/create") {
      let result: AcpElicitationResponse
      try {
        result = this.options.onElicitation
          ? await this.options.onElicitation((params ?? {}) as AcpElicitationRequestParams)
          : { action: "decline" }
      } catch (err) {
        this.options.onLog?.("warn", "onElicitation failed; cancelling", {
          error: err instanceof Error ? err.message : String(err),
        })
        result = { action: "cancel" }
      }
      this.write({ jsonrpc: "2.0", id, result })
      return
    }

    this.write({
      jsonrpc: "2.0",
      id,
      error: { code: -32601, message: `Unsupported client method: ${method}` },
    })
  }

  private async fallbackAutoSelect(params: AcpPermissionRequestParams): Promise<AcpPermissionOutcome> {
    const opts = params?.options ?? []
    const allow = opts.find((o) => {
      const kind = (o.kind ?? "").toLowerCase()
      const optionId = (o.optionId ?? "").toLowerCase()
      return kind.includes("allow") || optionId.includes("allow") || optionId.includes("approve")
    })
    if (allow) return { outcome: "selected", optionId: allow.optionId }
    if (opts[0]) return { outcome: "selected", optionId: opts[0].optionId }
    return { outcome: "cancelled" }
  }

  private write(payload: unknown): boolean {
    if (
      this.closed ||
      this.proc.exitCode !== null ||
      this.proc.signalCode !== null ||
      !this.proc.stdin.writable ||
      (this.proc.stdin as unknown as { destroyed?: boolean }).destroyed
    ) {
      return false
    }
    try {
      let ok = true
      this.proc.stdin.write(`${JSON.stringify(payload)}\n`, (err) => {
        if (err) ok = false
      })
      return ok
    } catch {
      return false
    }
  }

  request<T = any>(method: string, params: unknown, timeoutMs?: number, signal?: AbortSignal): Promise<T> {
    if (this.closed) {
      return Promise.reject(new Error(`Cannot call ${method}: agy acp process is closed`))
    }
    if (signal?.aborted) {
      return Promise.reject(
        (signal.reason as Error | undefined) ?? new Error(`ACP request ${method} aborted`),
      )
    }
    const id = this.nextId++
    return new Promise<T>((resolve, reject) => {
      let timer: ReturnType<typeof setTimeout> | undefined
      const onAbort = () => {
        if (this.pending.has(id)) {
          if (timer) clearTimeout(timer)
          this.pending.delete(id)
          try {
            signal?.removeEventListener("abort", onAbort)
          } catch {}
          reject(
            (signal?.reason as Error | undefined) ??
              new Error(`ACP request ${method} aborted`),
          )
        }
      }
      const cleanup = () => {
        if (timer) clearTimeout(timer)
        if (signal && onAbort) {
          try {
            signal.removeEventListener("abort", onAbort)
          } catch {}
        }
      }
      timer =
        timeoutMs && timeoutMs > 0
          ? setTimeout(() => {
              this.pending.delete(id)
              try {
                signal?.removeEventListener("abort", onAbort)
              } catch {}
              const err = new Error(`ACP request ${method} timed out after ${timeoutMs}ms`)
              ;(err as any).acpTimeout = true
              reject(err)
            }, timeoutMs)
          : undefined
      this.pending.set(id, { resolve, reject, timer, signal, onAbort })
      if (signal) {
        try {
          signal.addEventListener("abort", onAbort, { once: true })
        } catch {}
      }
      const ok = this.write({ jsonrpc: "2.0", id, method, params })
      if (!ok) {
        cleanup()
        this.pending.delete(id)
        if (this.proc.pid === undefined) {
          reject(new AgyNotFoundError(this.binary))
        } else {
          reject(new Error(`Cannot write ${method}: agy acp pipe is closed`))
        }
      }
    })
  }

  notify(method: string, params: unknown): void {
    this.write({ jsonrpc: "2.0", method, params })
  }

  initialize(): Promise<any> {
    return this.request(
      "initialize",
      {
        protocolVersion: 1,
        // Form elicitation makes agy send `ask_question` as `elicitation/create`,
        // which supports multiple questions, multi-select and typed answers.
        clientCapabilities: { elicitation: { form: {} } },
        clientInfo: { name: "acp-bridge", version: "0.3.0" },
      },
      15_000,
    )
  }

  // No MCP servers: Antigravity uses its own, as with T3 Code.
  newSession(params: { readonly cwd: string }): Promise<any> {
    return this.request("session/new", { cwd: params.cwd, mcpServers: [] }, 30_000)
  }

  resumeSession(params: { readonly sessionId: string; readonly cwd: string }): Promise<any> {
    return this.request(
      "session/resume",
      { sessionId: params.sessionId, cwd: params.cwd, mcpServers: [] },
      20_000,
    )
  }

  setModel(sessionId: string, modelId: string): Promise<any> {
    return this.request("session/set_model", { sessionId, modelId }, 10_000)
  }

  setMode(sessionId: string, modeId: string): Promise<any> {
    return this.request("session/set_mode", { sessionId, modeId }, 10_000)
  }

  setConfigOption(sessionId: string, configId: string, value: string): Promise<any> {
    return this.request("session/set_config_option", { sessionId, configId, value }, 10_000)
  }

  /**
   * Official ACP `authenticate` with exactly the selected method, never
   * another one. The method's credentials reach `agy` through its
   * environment (see `buildAgySpawnEnv`). Benign already-authenticated
   * errors resolve `undefined` so a cached sign-in keeps working.
   */
  async authenticate(): Promise<any | undefined> {
    const payload = { methodId: this.auth.method }
    try {
      return await this.request("authenticate", payload, 10_000)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      if (/Method not found|Unsupported client method|-32601/.test(msg)) return undefined
      if (/already (authenticated|logged in|signed in)/i.test(msg)) return undefined
      throw err
    }
  }

  prompt(
    sessionId: string,
    prompt: readonly AcpContentBlock[],
    options?: { readonly signal?: AbortSignal; readonly timeoutMs?: number },
  ): Promise<AcpPromptResult> {
    return this.request("session/prompt", { sessionId, prompt }, options?.timeoutMs ?? 0, options?.signal)
  }

  notifyCancel(sessionId: string): void {
    this.notify("session/cancel", { sessionId })
  }

  cancel(sessionId: string): Promise<boolean> {
    const ok = this.write({ jsonrpc: "2.0", method: "session/cancel", params: { sessionId } })
    return Promise.resolve(ok)
  }

  killImmediate(): void {
    if (this.proc.exitCode !== null || this.proc.signalCode !== null) {
      this.closed = true
      this.failAllPending(new Error("AcpProcess halted immediately"))
      this.destroyStreams()
      return
    }
    if (this.closed) return
    this.closed = true
    this.failAllPending(new Error("AcpProcess halted immediately"))
    this.signalProcess("SIGTERM")
    const timer = setTimeout(() => {
      this.signalProcess("SIGKILL")
    }, 500)
    timer.unref?.()
    this.proc.once("exit", () => {
      clearTimeout(timer)
      this.destroyStreams()
    })
  }

  closeSession(sessionId: string): Promise<any> {
    return this.request("session/close", { sessionId }, 5_000).catch(() => undefined)
  }

  async dispose(): Promise<void> {
    if (this.proc.exitCode !== null || this.proc.signalCode !== null) {
      this.closed = true
      this.failAllPending(new Error("AcpProcess disposed"))
      this.destroyStreams()
      return
    }
    if (this.closed) return
    this.closed = true
    this.failAllPending(new Error("AcpProcess disposed"))
    try {
      this.proc.stdin.end()
    } catch {}
    this.signalProcess("SIGTERM")
    await new Promise<void>((resolve) => {
      let settled = false
      const done = () => {
        if (settled) return
        settled = true
        clearTimeout(timer)
        this.destroyStreams()
        resolve()
      }
      const timer = setTimeout(() => {
        this.signalProcess("SIGKILL")
        done()
      }, 1_500)
      timer.unref?.()
      this.proc.once("exit", done)
      this.proc.once("close", done as (...args: any[]) => void)
    })
  }
}

export async function discoverAcpModels(
  cwd: string,
  options?: { readonly binaryPath?: string; readonly auth?: AcpAuthConfig },
): Promise<readonly AcpDiscoveredModel[]> {
  const proc = new AcpProcess({ cwd, binaryPath: options?.binaryPath, auth: options?.auth })
  try {
    await proc.initialize()
    await proc.authenticate()
    const sess = await proc.newSession({ cwd })
    const catalog = buildModelCatalog(sess)
    if (sess?.sessionId) {
      await proc.closeSession(String(sess.sessionId))
    }
    return catalog
  } finally {
    await proc.dispose()
  }
}
