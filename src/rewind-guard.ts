import { createHash } from "node:crypto"
import type { LanguageModelV3Prompt } from "@ai-sdk/provider"

/**
 * Detects when OpenCode's history no longer matches what agy holds. agy keeps
 * its own session history; OpenCode's revert/undo and message edits only
 * change OpenCode's copy. Like T3 Code, a session whose history was rolled
 * back is replaced with a fresh agy session that receives the kept
 * conversation instead of continuing with turns the user removed.
 */

/** The last user message agy received in its current session, persisted per OpenCode session. */
export interface DeliveredTurns {
  readonly acpSessionId: string
  /** Position of that message among OpenCode's user messages. */
  readonly index: number
  /** Fingerprint of every user message up to and including that one. */
  readonly hash: string
  /** Compaction summaries in the history when it was sent. */
  readonly compactions: number
}

const COMPACTION_PREFIX = /^\[(Prior conversation summary\]\n|Prior conversation checkpoint\]$)/

export function isDeliveredTurns(raw: unknown): raw is DeliveredTurns {
  if (!raw || typeof raw !== "object") return false
  const r = raw as Record<string, unknown>
  return (
    typeof r.acpSessionId === "string" &&
    typeof r.hash === "string" &&
    Number.isInteger(r.index) &&
    typeof r.compactions === "number"
  )
}

function userMessageHash(msg: LanguageModelV3Prompt[number]): string {
  const h = createHash("sha256")
  for (const part of msg.content as any[]) {
    if (part?.type === "text") h.update(`t:${String(part.text)}\n`)
    else if (part?.type === "file") h.update(`f:${String(part.filename ?? "")}:${String(part.mediaType ?? "")}\n`)
  }
  return h.digest("hex").slice(0, 16)
}

function countCompactions(prompt: LanguageModelV3Prompt): number {
  let n = 0
  for (const msg of prompt) {
    if (!Array.isArray(msg.content)) continue
    for (const part of msg.content as any[]) {
      if (part?.type === "text" && typeof part.text === "string" && COMPACTION_PREFIX.test(part.text)) n++
    }
  }
  return n
}

interface TurnHistory {
  /** For each of OpenCode's user messages, a fingerprint of it and every earlier one. */
  readonly hashes: readonly string[]
  readonly compactions: number
}

export function readTurnHistory(prompt: LanguageModelV3Prompt): TurnHistory {
  const hashes: string[] = []
  let chain = ""
  for (const msg of prompt) {
    if (msg.role !== "user") continue
    chain = createHash("sha256").update(`${chain}:${userMessageHash(msg)}`).digest("hex").slice(0, 24)
    hashes.push(chain)
  }
  return { hashes, compactions: countCompactions(prompt) }
}

/**
 * Whether the messages agy received are no longer OpenCode's history:
 * reverting or editing removes or changes one of them. Messages agy
 * never received (a local cooldown reply, for example) only add to the
 * history. A compaction shortens the history, so nothing is checked until
 * the next message is recorded.
 */
export function historyDiverged(record: DeliveredTurns | undefined, history: TurnHistory): boolean {
  if (!record || record.compactions !== history.compactions) return false
  return history.hashes[record.index] !== record.hash
}

/** The record after the latest message is sent to `acpSessionId`. */
export function recordDelivery(history: TurnHistory, acpSessionId: string): DeliveredTurns | undefined {
  const index = history.hashes.length - 1
  if (index < 0) return undefined
  return { acpSessionId, index, hash: history.hashes[index], compactions: history.compactions }
}

const MAX_HANDOFF_CHARS = 120_000
const MAX_HANDOFF_MESSAGE_CHARS = 8_000

function messageText(msg: LanguageModelV3Prompt[number]): string {
  if (typeof msg.content === "string") return msg.content
  const out: string[] = []
  for (const part of msg.content as any[]) {
    if (part?.type === "text" && typeof part.text === "string" && part.text.trim()) out.push(part.text)
    else if (part?.type === "file") out.push(`[Attached file: ${String(part.filename ?? "file")}]`)
  }
  const text = out.join("\n").trim()
  return text.length > MAX_HANDOFF_MESSAGE_CHARS
    ? `${text.slice(0, MAX_HANDOFF_MESSAGE_CHARS)}\n[... truncated]`
    : text
}

/**
 * The conversation kept before the latest message, for a fresh agy session.
 * Newest messages win when it is too long. `undefined` when nothing was kept.
 */
export function buildKeptConversation(prompt: LanguageModelV3Prompt): string | undefined {
  const nonSystem = prompt.filter((m) => m.role === "user" || m.role === "assistant")
  let lastUser = nonSystem.length - 1
  while (lastUser >= 0 && nonSystem[lastUser].role !== "user") lastUser--
  const kept = nonSystem.slice(0, Math.max(lastUser, 0))
  const entries: string[] = []
  let size = 0
  for (let i = kept.length - 1; i >= 0; i--) {
    const text = messageText(kept[i])
    if (!text) continue
    const entry = `${kept[i].role === "user" ? "User" : "Assistant"}:\n${text}`
    if (size + entry.length > MAX_HANDOFF_CHARS) break
    entries.unshift(entry)
    size += entry.length
  }
  if (entries.length === 0) return undefined
  return [
    "<earlier_conversation>",
    "Messages in this conversation were rewound or edited, so it continues in a new session. This is the conversation so far; continue from it. Files may differ from what it describes.",
    "",
    entries.join("\n\n"),
    "</earlier_conversation>",
  ].join("\n")
}
