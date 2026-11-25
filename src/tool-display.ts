import type { AcpSessionUpdate } from "./acp-client.js"

/**
 * Shapes agy's native tool calls like OpenCode's own tools so clients
 * (OpenCode, OpenChamber) render them with their usual views: file path,
 * diff, command and output. Names keep the `antigravity.` prefix, so they
 * never collide with OpenCode's executable tools; clients that read the last
 * dotted segment (OpenChamber) still pick the matching renderer.
 */

const ACP_TOOL_PREFIX = "antigravity."

export function isAcpToolName(name: unknown): boolean {
  const n = String(name ?? "")
  return n.startsWith(ACP_TOOL_PREFIX)
}

type Shape = "read" | "edit" | "write" | "shell" | "grep" | "glob" | "list" | "websearch" | "webfetch"

const SHAPE_BY_NAME: Record<string, Shape> = {
  read_file: "read",
  view_file: "read",
  edit_file: "edit",
  replace_file_content: "edit",
  multi_replace_file_content: "edit",
  write_file: "write",
  write_to_file: "write",
  run_command: "shell",
  grep_search: "grep",
  find_by_name: "glob",
  list_dir: "list",
  search_web: "websearch",
  read_url_content: "webfetch",
}

const SHAPE_BY_KIND: Record<string, Shape> = {
  read: "read",
  edit: "edit",
  execute: "shell",
  fetch: "webfetch",
}

const DISPLAY_NAME: Record<Shape, string> = {
  read: "read",
  edit: "edit",
  write: "write",
  shell: "shell",
  grep: "grep",
  glob: "glob",
  list: "list_dir",
  websearch: "websearch",
  webfetch: "webfetch",
}

interface AcpToolDisplay {
  readonly name: string
  readonly input: Record<string, unknown>
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined
}

function str(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined
}

function num(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined
}

function pick(raw: Record<string, unknown>, ...keys: string[]): unknown {
  for (const key of keys) {
    if (raw[key] !== undefined && raw[key] !== null && raw[key] !== "") return raw[key]
  }
  return undefined
}

function rawInputOf(update: AcpSessionUpdate): Record<string, unknown> {
  return asRecord(update.rawInput) ?? asRecord(update.args) ?? {}
}

function locationPath(update: AcpSessionUpdate): string | undefined {
  if (!Array.isArray(update.locations)) return undefined
  for (const loc of update.locations as unknown[]) {
    const path = str(asRecord(loc)?.path)
    if (path) return path
  }
  return undefined
}

function shapeOf(update: AcpSessionUpdate): Shape | undefined {
  const name = String(update.name ?? "")
  return SHAPE_BY_NAME[name] ?? (name ? undefined : SHAPE_BY_KIND[String(update.kind ?? "")])
}

function withoutUndefined(input: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(input).filter(([, v]) => v !== undefined))
}

/** The OpenCode-style name and input for agy's tool call. */
export function describeAcpToolCall(update: AcpSessionUpdate): AcpToolDisplay {
  const raw = rawInputOf(update)
  const shape = shapeOf(update)
  const toolName = String(update.name ?? update.kind ?? "tool")
  if (!shape) return { name: `${ACP_TOOL_PREFIX}${toolName}`, input: raw }

  const path = str(pick(raw, "Path", "AbsolutePath", "TargetFile", "FilePath", "File")) ?? locationPath(update)
  let input: Record<string, unknown>
  switch (shape) {
    case "read": {
      const start = num(pick(raw, "StartLine"))
      const end = num(pick(raw, "EndLine"))
      input = {
        path,
        offset: start,
        limit: start !== undefined && end !== undefined && end >= start ? end - start + 1 : undefined,
      }
      break
    }
    case "edit":
      input = {
        path,
        oldString: pick(raw, "Target", "TargetContent"),
        newString: pick(raw, "Replacement", "ReplacementContent"),
        replaceAll: pick(raw, "AllowMultiple"),
      }
      break
    case "write":
      input = { path, content: pick(raw, "Content", "CodeContent") }
      break
    case "shell":
      input = {
        command: pick(raw, "CommandLine", "Command") ?? str(update.title),
        description: pick(raw, "toolSummary", "Description"),
        cwd: pick(raw, "Cwd"),
      }
      break
    case "grep":
      input = { pattern: pick(raw, "Query", "Pattern"), path: pick(raw, "SearchPath", "SearchDirectory") ?? path }
      break
    case "glob":
      input = { pattern: pick(raw, "Pattern", "Query"), path: pick(raw, "SearchDirectory", "SearchPath") ?? path }
      break
    case "list":
      input = { path: pick(raw, "DirectoryPath", "SearchDirectory") ?? path }
      break
    case "websearch":
      input = { query: pick(raw, "Query", "query") }
      break
    case "webfetch":
      input = { url: pick(raw, "Url", "url") }
      break
  }
  return { name: `${ACP_TOOL_PREFIX}${DISPLAY_NAME[shape]}`, input: withoutUndefined(input) }
}

interface DiffContent {
  readonly path?: string
  readonly oldText: string
  readonly newText: string
}

function diffsOf(update: AcpSessionUpdate): DiffContent[] {
  if (!Array.isArray(update.content)) return []
  const diffs: DiffContent[] = []
  for (const block of update.content as unknown[]) {
    const b = asRecord(block)
    if (b?.type !== "diff" || typeof b.newText !== "string") continue
    diffs.push({
      path: str(b.path),
      oldText: typeof b.oldText === "string" ? b.oldText : "",
      newText: b.newText,
    })
  }
  return diffs
}

function textBlocksOf(update: AcpSessionUpdate): string[] {
  if (!Array.isArray(update.content)) return []
  const texts: string[] = []
  for (const block of update.content as unknown[]) {
    const b = asRecord(block)
    if (b?.type === "text" && typeof b.text === "string") texts.push(b.text)
    else {
      const inner = asRecord(b?.content)
      if (inner?.type === "text" && typeof inner.text === "string") texts.push(inner.text)
    }
  }
  return texts
}

function isEmptyValue(value: unknown): boolean {
  if (value === undefined || value === null || value === "") return true
  const rec = asRecord(value)
  return rec !== undefined && Object.keys(rec).length === 0
}

/** agy prefixes command output with timestamps and a status line. */
function formatCommandOutput(output: string, exitCode: number | undefined): string {
  const normalized = output.replace(/\r\n/g, "\n")
  const marker = "Command output:\n"
  const at = normalized.indexOf(marker)
  const body = at >= 0 ? normalized.slice(at + marker.length) : normalized
  const trimmed = body.replace(/\n+$/, "")
  const status = exitCode !== undefined && exitCode !== 0 ? `\n\nExit code ${exitCode}` : ""
  return `${trimmed || "(no output)"}${status}`
}

function toDisplayPath(path: string, cwd: string | undefined): string {
  if (cwd && path.startsWith(`${cwd.replace(/\/+$/, "")}/`)) return path.slice(cwd.replace(/\/+$/, "").length + 1)
  return path
}

/**
 * The tool result as text OpenCode clients render natively: a unified diff
 * for edits, the command output for shell calls, else agy's text output.
 */
export function describeAcpToolResult(update: AcpSessionUpdate, cwd?: string): unknown {
  const diffs = diffsOf(update)
  const path = locationPath(update) ?? str(rawInputOf(update).Path)
  if (diffs.length > 0) {
    return diffs
      .map((d) => unifiedDiff(toDisplayPath(d.path ?? path ?? "file", cwd), d.oldText, d.newText))
      .join("\n")
  }

  const rawOutput = asRecord(update.rawOutput)
  const output = str(rawOutput?.output) ?? str(rawOutput?.combinedOutput) ?? str(rawOutput?.combined_output)
  if (output !== undefined) {
    const exitCode = num(rawOutput?.exit_code) ?? num(rawOutput?.exitCode)
    return shapeOf(update) === "shell" || exitCode !== undefined ? formatCommandOutput(output, exitCode) : output
  }

  const texts = textBlocksOf(update)
  if (texts.length > 0) return texts.join("\n")
  if (!isEmptyValue(update.rawOutput)) return update.rawOutput

  if (Array.isArray(update.content)) {
    const other = (update.content as unknown[]).filter((b) => !isEmptyValue(b))
    if (other.length > 0) return JSON.stringify(other)
  }
  const title = str(update.title)
  const shape = shapeOf(update)
  if (shape === "read" && path) return `Read ${toDisplayPath(path, cwd)}`
  if ((shape === "edit" || shape === "write") && path) return `Updated ${toDisplayPath(path, cwd)}`
  return title ?? String(update.status ?? "completed")
}

const DIFF_CONTEXT = 3
/** Above this many changed-region cells, skip line matching and replace the region. */
const MAX_DIFF_CELLS = 2_000_000

type Op = readonly [" " | "-" | "+", string]

function splitLines(text: string): string[] {
  if (text === "") return []
  const lines = text.split("\n")
  if (lines[lines.length - 1] === "") lines.pop()
  return lines
}

function diffOps(a: readonly string[], b: readonly string[]): Op[] {
  let start = 0
  while (start < a.length && start < b.length && a[start] === b[start]) start++
  let endA = a.length
  let endB = b.length
  while (endA > start && endB > start && a[endA - 1] === b[endB - 1]) {
    endA--
    endB--
  }
  const ops: Op[] = a.slice(0, start).map((l) => [" ", l] as const)
  const midA = a.slice(start, endA)
  const midB = b.slice(start, endB)
  const n = midA.length
  const m = midB.length
  if (n > 0 && m > 0 && (n + 1) * (m + 1) <= MAX_DIFF_CELLS) {
    // Longest common subsequence over the changed region.
    const width = m + 1
    const table = new Uint32Array((n + 1) * width)
    for (let i = n - 1; i >= 0; i--) {
      for (let j = m - 1; j >= 0; j--) {
        table[i * width + j] =
          midA[i] === midB[j]
            ? table[(i + 1) * width + j + 1] + 1
            : Math.max(table[(i + 1) * width + j], table[i * width + j + 1])
      }
    }
    let i = 0
    let j = 0
    while (i < n && j < m) {
      if (midA[i] === midB[j]) {
        ops.push([" ", midA[i]])
        i++
        j++
      } else if (table[(i + 1) * width + j] >= table[i * width + j + 1]) {
        ops.push(["-", midA[i++]])
      } else {
        ops.push(["+", midB[j++]])
      }
    }
    while (i < n) ops.push(["-", midA[i++]])
    while (j < m) ops.push(["+", midB[j++]])
  } else {
    for (const l of midA) ops.push(["-", l])
    for (const l of midB) ops.push(["+", l])
  }
  for (const l of a.slice(endA)) ops.push([" ", l])
  return ops
}

/** A unified diff (git style headers) between two versions of a file. */
export function unifiedDiff(path: string, oldText: string, newText: string): string {
  const header = `Index: ${path}\n===================================================================\n--- ${path}\n+++ ${path}\n`
  if (oldText === newText) return header
  const ops = diffOps(splitLines(oldText), splitLines(newText))
  const changed: number[] = []
  ops.forEach((op, idx) => {
    if (op[0] !== " ") changed.push(idx)
  })
  const hunks: string[] = []
  let k = 0
  while (k < changed.length) {
    let first = changed[k]
    let last = first
    while (k + 1 < changed.length && changed[k + 1] - last <= DIFF_CONTEXT * 2 + 1) last = changed[++k]
    k++
    const from = Math.max(0, first - DIFF_CONTEXT)
    const to = Math.min(ops.length, last + DIFF_CONTEXT + 1)
    let oldLine = 1
    let newLine = 1
    for (let idx = 0; idx < from; idx++) {
      if (ops[idx][0] !== "+") oldLine++
      if (ops[idx][0] !== "-") newLine++
    }
    let oldCount = 0
    let newCount = 0
    const body: string[] = []
    for (let idx = from; idx < to; idx++) {
      const [kind, line] = ops[idx]
      if (kind !== "+") oldCount++
      if (kind !== "-") newCount++
      body.push(`${kind}${line}`)
    }
    hunks.push(
      `@@ -${oldCount === 0 ? oldLine - 1 : oldLine},${oldCount} +${newCount === 0 ? newLine - 1 : newLine},${newCount} @@\n${body.join("\n")}`,
    )
  }
  return `${header}${hunks.join("\n")}\n`
}
