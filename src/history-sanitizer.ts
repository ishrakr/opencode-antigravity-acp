import type {
  LanguageModelV3Prompt,
  LanguageModelV3ToolResultOutput,
} from "@ai-sdk/provider"
import type { AcpContentBlock } from "./acp-client.js"
import { isAcpToolName } from "./tool-display.js"

export const ACP_PROVIDER_ID = "antigravity-acp"

export const API_ERROR_ABORT_PATTERN =
  /API error \(attempt \d+\)|RESOURCE_EXHAUSTED|Individual quota reached|\(code 429\)|\(code 403\)|PERMISSION_DENIED/i

function truncateText(text: string, maxLen = 6000): string {
  if (text.length <= maxLen) return text
  return `${text.slice(0, maxLen)}\n... [truncated ${text.length - maxLen} chars]`
}

function stringifyCompact(value: unknown, maxLen = 2000): string {
  if (typeof value === "string") return truncateText(value, maxLen)
  try {
    return truncateText(JSON.stringify(value), maxLen)
  } catch {
    return truncateText(String(value), maxLen)
  }
}

function summarizeToolResultValue(result: any): string {
  if (!result || typeof result !== "object") return stringifyCompact(result)
  if (result.type === "content" && Array.isArray(result.value)) {
    return result.value
      .map((item: any) =>
        item?.type === "text"
          ? String(item.text ?? "")
          : `[file ${item?.mime ?? ""} ${item?.name ?? ""}]`,
      )
      .join("\n")
  }
  if ("value" in result) return stringifyCompact(result.value, 6000)
  return stringifyCompact(result, 6000)
}

/**
 * Rewrites Antigravity providerExecuted (hosted) tool calls/results into plain text blocks
 * when a non-Antigravity model runs next, preventing Anthropic/OpenAI protocol serializers
 * from rejecting unfamiliar server-executed tool names.
 */
export function sanitizeForNonAcpModel(messages: any[]): void {
  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i]
    if (!msg || !Array.isArray(msg.content)) continue

    let changed = false
    const nextContent: any[] = []
    for (const part of msg.content) {
      if (!part || typeof part !== "object") {
        nextContent.push(part)
        continue
      }

      if (part.type === "compaction") {
        changed = true
        nextContent.push({
          type: "text",
          text: part.text
            ? `[Prior conversation summary]\n${String(part.text)}`
            : "[Prior conversation checkpoint]",
        })
        continue
      }

      if (part.type === "effort") {
        changed = true
        continue
      }

      if (msg.role === "assistant") {
        const isAcpHosted =
          (part.type === "tool-call" || part.type === "tool-result") &&
          part.providerExecuted === true &&
          (Boolean(part.providerMetadata?.[ACP_PROVIDER_ID]) ||
            isAcpToolName(part.name))

        if (isAcpHosted) {
          changed = true
          if (part.type === "tool-call") {
            nextContent.push({
              type: "text",
              text: `[Antigravity tool call \`${part.name}\`: ${stringifyCompact(part.input, 1200)}]`,
            })
          } else {
            nextContent.push({
              type: "text",
              text: `[Antigravity tool \`${part.name}\` result: ${summarizeToolResultValue(part.result)}]`,
            })
          }
          continue
        }
      }

      nextContent.push(part)
    }

    if (changed) {
      const merged = mergeAdjacentTextParts(nextContent)
      messages[i] =
        merged.length > 0
          ? { ...msg, content: merged }
          : {
              ...msg,
              content: [{
                type: "text",
                text: msg.role === "assistant" ? "[Antigravity turn completed]" : "[Checkpoint]",
              }],
            }
    }
  }
}

/**
 * Rewrites native compaction parts, effort parts, and provider media refs before
 * OpenCode's AI SDK adapter serializes history into LanguageModelV3Prompt.
 */
export function sanitizeForAcpModel(messages: any[]): void {
  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i]
    if (!msg || !Array.isArray(msg.content)) continue

    let changed = false
    const nextContent: any[] = []
    for (const part of msg.content) {
      if (!part || typeof part !== "object") {
        nextContent.push(part)
        continue
      }
      if (part.type === "compaction") {
        changed = true
        nextContent.push({
          type: "text",
          text: part.text
            ? `[Prior conversation summary]\n${String(part.text)}`
            : "[Prior conversation checkpoint]",
        })
        continue
      }
      if (part.type === "effort") {
        changed = true
        continue
      }
      if (part.type === "media" && part.media?.source?.type === "ref") {
        changed = true
        nextContent.push({
          type: "text",
          text: `[Provider media ref ${String(part.media.source.provider ?? "")}:${String(part.media.source.id ?? "")}]`,
        })
        continue
      }
      nextContent.push(part)
    }

    if (changed) {
      const merged = mergeAdjacentTextParts(nextContent)
      messages[i] =
        msg.role === "assistant" && merged.length === 0
          ? { ...msg, content: [{ type: "text", text: "[Prior assistant step]" }] }
          : { ...msg, content: merged }
    }
  }
}

function mergeAdjacentTextParts(parts: any[]): any[] {
  const out: any[] = []
  for (const part of parts) {
    const prev = out[out.length - 1]
    if (
      part?.type === "text" &&
      prev?.type === "text" &&
      !part.providerMetadata &&
      !prev.providerMetadata
    ) {
      out[out.length - 1] = {
        ...prev,
        text: `${prev.text}\n${part.text}`,
      }
    } else {
      out.push(part)
    }
  }
  return out
}

export function extractToolResultsFromPrompt(
  prompt: LanguageModelV3Prompt,
  expectedCallIds: ReadonlySet<string>,
): Map<string, { text: string; isError: boolean }> {
  const results = new Map<string, { text: string; isError: boolean }>()
  for (let i = prompt.length - 1; i >= 0; i--) {
    const msg = prompt[i]
    if (msg.role !== "tool" && msg.role !== "assistant") continue
    for (const part of msg.content) {
      if (part.type !== "tool-result") continue
      if (!expectedCallIds.has(part.toolCallId) || results.has(part.toolCallId)) continue
      results.set(part.toolCallId, formatToolResultOutput(part.output))
    }
    if (results.size >= expectedCallIds.size) break
  }
  return results
}

function formatToolResultOutput(output: LanguageModelV3ToolResultOutput): {
  text: string
  isError: boolean
} {
  switch (output.type) {
    case "text":
      return { text: output.value, isError: false }
    case "json":
      return { text: JSON.stringify(output.value), isError: false }
    case "error-text":
      return { text: output.value, isError: true }
    case "error-json":
      return { text: JSON.stringify(output.value), isError: true }
    case "execution-denied":
      return {
        text: output.reason ? `Tool execution denied: ${output.reason}` : "Tool execution denied",
        isError: true,
      }
    case "content": {
      const text = output.value
        .map((c) => {
          if (c.type === "text") return c.text
          if (c.type === "file-data" || c.type === "image-data") {
            const fname = "filename" in c ? c.filename : undefined
            return `[Attachment ${c.mediaType}${fname ? `: ${fname}` : ""}]`
          }
          if (c.type === "file-url" || c.type === "image-url") {
            return `[Attachment URL: ${c.url}]`
          }
          return "[Attachment]"
        })
        .join("\n")
      return { text, isError: false }
    }
    default:
      return { text: stringifyCompact(output), isError: false }
  }
}

function hasAcpMarker(msg: LanguageModelV3Prompt[number]): boolean {
  if (msg.role !== "assistant") return false
  const msgOpts = (msg as any).providerOptions
  if (msgOpts && ACP_PROVIDER_ID in msgOpts) return true
  const msgMeta = (msg as any).providerMetadata
  if (msgMeta && ACP_PROVIDER_ID in msgMeta) return true
  return (msg.content as any[]).some((part) => {
    if (!part || typeof part !== "object") return false
    const partOpts = (part as any).providerOptions
    if (partOpts && ACP_PROVIDER_ID in partOpts) return true
    const partMeta = (part as any).providerMetadata
    return !!(partMeta && ACP_PROVIDER_ID in partMeta)
  })
}

function fileDataToBase64(data: Uint8Array | string | URL): string | undefined {
  if (data instanceof Uint8Array) {
    return Buffer.from(data).toString("base64")
  }
  if (typeof data === "string") {
    // data: URIs carry inline base64 after the marker. The wrapper regex alone
    // is not trusted: the captured payload must itself be valid non-empty
    // base64 (no whitespace, padded length, base64 alphabet only).
    if (data.startsWith("data:")) {
      const match = /^data:[^;]+;base64,(.*)$/s.exec(data)
      if (!match) return undefined
      const payload = match[1]
      if (!payload || payload.length === 0) return undefined
      if (/\s/.test(payload)) return undefined
      if (payload.length % 4 !== 0) return undefined
      if (!/^[A-Za-z0-9+/]*={0,2}$/.test(payload)) return undefined
      return payload
    }
    // Raw inline base64 is also accepted (no URL/path/whitespace, valid
    // alphabet, padded length). Anything else — URLs, filesystem paths,
    // plain strings, refs — falls back to an "[Attached file]" placeholder
    // and is never sent as image bytes.
    if (isInlineBase64(data)) return data
    return undefined
  }
  return undefined
}

/**
 * Conservative inline-base64 test: standard alphabet only, padded length, a
 * minimum size so short ids/tokens never masquerade as images, and no URL,
 * scheme, or whitespace markers anywhere in the string.
 *
 * Real base64-encoded JPEGs start with `/9j/` — a leading `/` alone must NOT
 * reject them. Only known filesystem path prefixes (`/tmp/`, `/var/`,
 * `/home/`, `/Users/`, `/etc/`, `/usr/`, `/opt/`, `./`, `../`, `~/`) plus
 * backslashes still reject; everything else starting with `/` that matches
 * the base64 alphabet is accepted as inline image bytes.
 */
const KNOWN_PATH_PREFIXES = [
  "/tmp/",
  "/var/",
  "/home/",
  "/Users/",
  "/etc/",
  "/usr/",
  "/opt/",
  "./",
  "../",
  "~/",
] as const

function isInlineBase64(data: string): boolean {
  if (data.length < 32 || data.length % 4 !== 0) return false
  if (/\s/.test(data)) return false
  if (data.includes("://")) return false
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(data)) return false
  if (data.includes("\\")) return false
  for (const prefix of KNOWN_PATH_PREFIXES) {
    if (data.startsWith(prefix)) return false
  }
  // Unix-path-shaped strings like `/workspace/assets/screenshots/abcdef` use
  // only path-safe chars and slashes but are not image bytes. A leading `/`
  // with 2+ path-like segments (`[A-Za-z0-9_.-]+`) and no base64-only markers
  // (`=` padding or `+`) is rejected — except real JPEG base64, which starts
  // with `/9j/` and must keep working.
  if (data.startsWith("/") && !data.startsWith("/9j/")) {
    const rest = data.slice(1)
    if (rest.includes("/")) {
      const segments = data.split("/").filter(Boolean)
      if (
        segments.length >= 2 &&
        segments.every((seg) => /^[A-Za-z0-9_.\-]+$/.test(seg)) &&
        !/[+=]/.test(data)
      ) {
        return false
      }
    }
  }
  return /^[A-Za-z0-9+/]*={0,2}$/.test(data)
}

const ACP_IMAGE_MIME_TYPES = new Set(["image/bmp", "image/jpeg", "image/png", "image/webp"])

const TEXT_MIME_TYPES = new Set([
  "application/json",
  "application/ld+json",
  "application/javascript",
  "application/typescript",
  "application/xml",
  "application/yaml",
  "application/x-yaml",
  "application/x-sh",
])

/** Same limits as T3 Code: 1 MiB per text file, 50 MiB of native attachments per message. */
export const MAX_TEXT_ATTACHMENT_BYTES = 1024 * 1024
export const MAX_TOTAL_ATTACHMENT_BYTES = 50 * 1024 * 1024

/**
 * Writes an attachment where agy can read it and returns its `file://` URI.
 * agy cannot take a PDF inline ("unsupported blob type"), only as a link to a
 * file inside its workspace or an `--add-dir`.
 */
export type AttachmentStore = (input: {
  readonly bytes: Uint8Array
  readonly filename: string
  readonly mediaType: string
}) => string | undefined

export interface AcpPromptOptions {
  readonly storeAttachment?: AttachmentStore
}

function fileDataToBytes(data: Uint8Array | string | URL): Uint8Array | undefined {
  if (data instanceof Uint8Array) return data
  const b64 = fileDataToBase64(data)
  return b64 === undefined ? undefined : Buffer.from(b64, "base64")
}

function decodeTextAttachment(bytes: Uint8Array): string | undefined {
  const encoding =
    bytes[0] === 0xff && bytes[1] === 0xfe
      ? "utf-16le"
      : bytes[0] === 0xfe && bytes[1] === 0xff
        ? "utf-16be"
        : "utf-8"
  try {
    const text = new TextDecoder(encoding, { fatal: true }).decode(bytes)
    return text.includes("\0") ? undefined : text
  } catch {
    return undefined
  }
}

function attachmentName(filename: string | undefined): string {
  const base = (filename ?? "").split(/[\\/]/).pop()?.trim()
  return base && base.length > 0 ? base : "attachment"
}

/**
 * Builds what `agy acp` receives for a turn: only the user's latest message
 * and its attachments, as an ACP client such as T3 Code or Zed sends it. No
 * OpenCode system prompt, tools or earlier turns: Antigravity owns its own
 * session history via `session/new` / `session/resume`.
 *
 * Attachments follow T3 Code: images inline, text files as embedded
 * resources, PDFs as links to a stored copy. agy declines audio
 * (`promptCapabilities.audio: false`), so audio and other types are named
 * in text only.
 */
export function buildThinAcpPromptBlocks(
  prompt: LanguageModelV3Prompt,
  options: AcpPromptOptions = {},
): AcpContentBlock[] {
  const nonSystem = prompt.filter((m) => m.role !== "system")
  if (nonSystem.length === 0) {
    return [{ type: "text", text: "Continue." }]
  }
  // Latest human user message is the only turn trigger.
  let lastUserIdx = nonSystem.length - 1
  while (lastUserIdx >= 0 && nonSystem[lastUserIdx].role !== "user") {
    lastUserIdx--
  }
  const currentUserMsg = lastUserIdx >= 0 ? nonSystem[lastUserIdx] : undefined
  const blocks: AcpContentBlock[] = []
  let totalBytes = 0
  if (currentUserMsg && currentUserMsg.role === "user") {
    for (const part of currentUserMsg.content) {
      if (part.type === "text") {
        if (part.text.length > 0) {
          blocks.push({ type: "text", text: part.text })
        }
      } else if (part.type === "file") {
        const block = attachmentBlock(part, options, totalBytes)
        totalBytes += block.bytes
        blocks.push(block.block)
      }
    }
  }
  if (blocks.length === 0) {
    blocks.push({ type: "text", text: "Continue." })
  }
  return blocks
}

function attachmentBlock(
  part: { readonly data: Uint8Array | string | URL; readonly mediaType: string; readonly filename?: string },
  options: AcpPromptOptions,
  totalBytes: number,
): { readonly block: AcpContentBlock; readonly bytes: number } {
  const name = attachmentName(part.filename)
  const mediaType = part.mediaType.split(";", 1)[0]?.trim().toLowerCase() ?? ""
  const placeholder = (reason?: string) => ({
    block: {
      type: "text" as const,
      text: `[Attached file: ${name} (${mediaType || "unknown type"})${reason ? `: ${reason}` : ""}]`,
    },
    bytes: 0,
  })

  const isImage = ACP_IMAGE_MIME_TYPES.has(mediaType)
  const isPdf = mediaType === "application/pdf"
  const isText = mediaType.startsWith("text/") || TEXT_MIME_TYPES.has(mediaType)
  if (!isImage && !isPdf && !isText) {
    return placeholder(mediaType.startsWith("audio/") ? "Antigravity does not accept audio" : undefined)
  }

  const bytes = fileDataToBytes(part.data)
  if (!bytes) return placeholder()
  if (totalBytes + bytes.length > MAX_TOTAL_ATTACHMENT_BYTES) {
    return placeholder("attachments exceed 50 MiB for this message")
  }

  if (isImage) {
    return {
      block: { type: "image", data: Buffer.from(bytes).toString("base64"), mimeType: mediaType },
      bytes: bytes.length,
    }
  }
  if (isText) {
    if (bytes.length > MAX_TEXT_ATTACHMENT_BYTES) return placeholder("larger than 1 MiB")
    const text = decodeTextAttachment(bytes)
    if (text === undefined) return placeholder("not a text file")
    return {
      block: {
        type: "resource",
        resource: { uri: `attachment:///${encodeURIComponent(name)}`, mimeType: mediaType, text },
      },
      bytes: bytes.length,
    }
  }
  let uri: string | undefined
  try {
    uri = options.storeAttachment?.({ bytes, filename: name, mediaType })
  } catch {
    uri = undefined
  }
  if (!uri) return placeholder("could not be stored for Antigravity")
  return {
    block: { type: "resource_link", uri, name, mimeType: mediaType },
    bytes: bytes.length,
  }
}

/** Placeholder texts `sanitizeForAcpModel` writes for compaction and effort parts. */
const SANITIZER_PLACEHOLDER = /^\[(Prior conversation summary\]\n|Prior conversation checkpoint\]$|Prior assistant step\]$)/

function isSanitizerPlaceholder(msg: LanguageModelV3Prompt[number]): boolean {
  const parts = msg.content as any[]
  return (
    parts.length > 0 &&
    parts.every((p) => p?.type === "text" && typeof p.text === "string" && SANITIZER_PLACEHOLDER.test(p.text))
  )
}

/**
 * Detects OpenCode session history produced by non-ACP models. Antigravity
 * owns its own session history and is never handed another model's
 * conversation, so such a session stays locked to that model (as T3 Code
 * keeps a thread on one provider): the user starts a new session instead.
 * Plugin notices and compaction placeholders are not another model's turns.
 */
export function hasNonAcpAssistantHistory(prompt: LanguageModelV3Prompt): boolean {
  for (const msg of prompt) {
    if (msg.role !== "assistant" || !Array.isArray(msg.content)) continue
    if (msg.content.length === 0) continue
    if (isLocalStatusMessage(msg)) continue
    if (isSanitizerPlaceholder(msg)) continue
    if (!hasAcpMarker(msg)) return true
  }
  return false
}

/**
 * Local plugin status/cooldown replies (circuit-open, restart-skip, missing
 * CLI) are emitted by `createImmediateTextStream` with a
 * `{ [ACP_PROVIDER_ID]: { localStatus: true } }` marker. They are neither ACP
 * turns nor foreign model turns and must be skipped when scanning history.
 */
export function isLocalStatusMessage(msg: LanguageModelV3Prompt[number]): boolean {
  const check = (holder: any): boolean => {
    if (!holder || typeof holder !== "object") return false
    const meta = holder.providerMetadata?.[ACP_PROVIDER_ID] ?? holder.providerOptions?.[ACP_PROVIDER_ID]
    return !!meta && typeof meta === "object" && (meta as any).localStatus === true
  }
  if (check(msg)) return true
  if (check((msg as any).providerOptions)) return true
  if (check((msg as any).providerMetadata)) return true
  const content = (msg as any).content
  if (Array.isArray(content)) {
    for (const part of content) {
      if (!part || typeof part !== "object") continue
      if (check(part)) return true
    }
  }
  return false
}

/**
 * Detects an OpenCode synthetic auto-resume prompt following a halted API error turn so the
 * bridge does not automatically replay an erroring request on server restart.
 */
export function isSyntheticRestartAfterError(prompt: LanguageModelV3Prompt): boolean {
  const nonSystem = prompt.filter((m) => m.role !== "system")
  if (nonSystem.length === 0) return false

  const last = nonSystem[nonSystem.length - 1]
  if (last.role !== "user") return false

  const lastText = last.content
    .filter(
      (p): p is { type: "text"; text: string } =>
        p.type === "text" && typeof p.text === "string",
    )
    .map((p) => p.text)
    .join("\n")

  if (!lastText.includes("The server restarted while you were working.")) return false

  for (let i = nonSystem.length - 2; i >= 0; i--) {
    const msg = nonSystem[i]
    if (msg.role !== "assistant") continue
    const assistantText = msg.content
      .filter(
        (p): p is { type: "text"; text: string } =>
          p.type === "text" && typeof p.text === "string",
      )
      .map((p) => p.text)
      .join("\n")
    return (
      assistantText.includes("Antigravity ACP halted") ||
      API_ERROR_ABORT_PATTERN.test(assistantText)
    )
  }

  return false
}
