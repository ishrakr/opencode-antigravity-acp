import { afterEach, describe, expect, test } from "bun:test"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { Effect } from "effect"
import {
  FALLBACK_MODELS,
  UnavailableModelError,
  buildModelCatalog,
  isLegacyAcpModel,
  resolveAcpModelTarget,
} from "../src/acp-client.js"
import { buildThinAcpPromptBlocks, MAX_TEXT_ATTACHMENT_BYTES } from "../src/history-sanitizer.js"
import {
  buildKeptConversation,
  historyDiverged,
  readTurnHistory,
  recordDelivery,
} from "../src/rewind-guard.js"
import {
  ANTIGRAVITY_WARNING_METADATA_KEY,
  REWIND_NOTICE,
  SessionBridgeManager,
  antigravitySecurityWarning,
  resetSharedCatalogForTests,
} from "../src/session-bridge.js"

const tmpRoots: string[] = []
function tmpDir(): string {
  const dir = fs.mkdtempSync(path.join(process.env.TMPDIR || os.tmpdir(), "agy-parity-"))
  tmpRoots.push(dir)
  return dir
}

afterEach(() => {
  resetSharedCatalogForTests()
  for (const dir of tmpRoots.splice(0)) fs.rmSync(dir, { recursive: true, force: true })
})

function makeCtx(assertImpl?: (input: any) => Effect.Effect<void, any>) {
  const store = new Map<string, unknown>()
  const asserts: any[] = []
  const ctx = {
    location: { directory: "/tmp/acp-test-dir" },
    storage: {
      get: (k: string) => Effect.succeed(store.get(k)),
      set: (k: string, v: unknown) => Effect.sync(() => void store.set(k, v)),
      remove: (k: string) => Effect.sync(() => void store.delete(k)),
    },
    session: {
      get: () => Effect.succeed({ location: { directory: "/tmp/acp-test-dir" } }),
      update: () => Effect.void,
    },
    permission: {
      assert: (input: any) => {
        asserts.push(input)
        return assertImpl ? assertImpl(input) : Effect.void
      },
    },
  } as any
  return { ctx, store, asserts }
}

async function readAllParts(stream: ReadableStream<any>) {
  const reader = stream.getReader()
  const parts: any[] = []
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    parts.push(value)
  }
  return parts
}

function textOf(parts: any[]): string {
  return parts.filter((p) => p.type === "text-delta").map((p) => p.delta).join("")
}

interface FakeProc {
  readonly prompts: Array<{ sessionId: string; blocks: any[] }>
  readonly closed: string[]
  readonly extraDirs: readonly string[]
  readonly models: string[]
}

function makeBridge(options: {
  readonly ctx: any
  readonly attachmentsDir?: string
  readonly onPrompt?: (proc: any, sessionId: string, blocks: any[]) => Promise<any> | any
  readonly setModel?: (id: string) => Promise<void>
}) {
  const procs: FakeProc[] = []
  let sessionSeq = 0
  const bridge = new SessionBridgeManager(options.ctx, "/tmp/acp-test-dir", undefined, {
    attachmentsDir: options.attachmentsDir ?? tmpDir(),
    createProc: (procOpts) => {
      const state: FakeProc = { prompts: [], closed: [], extraDirs: procOpts.extraDirs ?? [], models: [] }
      procs.push(state)
      const proc: any = {
        isClosed: false,
        options: procOpts,
        initialize: async () => ({}),
        authenticate: async () => ({}),
        newSession: async () => ({ sessionId: `acp-${++sessionSeq}` }),
        resumeSession: async (p: any) => ({ sessionId: p.sessionId }),
        setModel: async (_sid: string, id: string) => {
          state.models.push(id)
          if (options.setModel) await options.setModel(id)
        },
        setMode: async () => {},
        setConfigOption: async () => {
          if (options.setModel) throw new Error("rejected")
        },
        closeSession: async (sid: string) => void state.closed.push(sid),
        notifyCancel: () => {},
        cancel: async () => {},
        dispose: async () => {
          proc.isClosed = true
        },
        killImmediate: () => {},
        prompt: async (sessionId: string, blocks: any[]) => {
          state.prompts.push({ sessionId, blocks })
          if (options.onPrompt) return options.onPrompt(proc, sessionId, blocks)
          return { stopReason: "end_turn" }
        },
      }
      return proc
    },
  })
  return { bridge, procs }
}

async function turn(bridge: SessionBridgeManager, sid: string, prompt: any[], model = "gemini-4-neon", variant = "") {
  const lm = bridge.createLanguageModel(model)
  const res = await lm.doStream({
    prompt,
    headers: { "x-opencode-session-id": sid, "x-opencode-variant": variant },
  } as any)
  return readAllParts(res.stream)
}

const user = (text: string, extra: any[] = []) => ({ role: "user", content: [{ type: "text", text }, ...extra] })
const assistant = (text: string) => ({
  role: "assistant",
  content: [{ type: "text", text, providerOptions: { "antigravity-acp": { acp: true } } }],
})

describe("attachments (T3 Code parity)", () => {
  const pdfBytes = Buffer.from("%PDF-1.4\n% a small test document for the attachment path\n%%EOF\n")

  test("embeds text files, links stored PDFs, inlines images and names audio", () => {
    const stored: any[] = []
    const blocks = buildThinAcpPromptBlocks(
      [
        user("read these", [
          { type: "file", mediaType: "text/markdown", filename: "notes.md", data: Buffer.from("# hi") },
          { type: "file", mediaType: "application/pdf", filename: "../doc.pdf", data: pdfBytes.toString("base64") },
          { type: "file", mediaType: "image/png", filename: "a.png", data: new Uint8Array([1, 2, 3]) },
          { type: "file", mediaType: "audio/mpeg", filename: "a.mp3", data: new Uint8Array([1]) },
        ]),
      ] as any,
      {
        storeAttachment: (file) => {
          stored.push(file)
          return "file:///store/doc.pdf"
        },
      },
    )
    expect(blocks[0]).toEqual({ type: "text", text: "read these" })
    expect(blocks[1]).toEqual({
      type: "resource",
      resource: { uri: "attachment:///notes.md", mimeType: "text/markdown", text: "# hi" },
    })
    expect(blocks[2]).toEqual({ type: "resource_link", uri: "file:///store/doc.pdf", name: "doc.pdf", mimeType: "application/pdf" })
    expect(Buffer.from(stored[0].bytes).equals(pdfBytes)).toBe(true)
    expect(blocks[3]).toMatchObject({ type: "image", mimeType: "image/png" })
    expect(blocks[4]).toEqual({ type: "text", text: "[Attached file: a.mp3 (audio/mpeg): Antigravity does not accept audio]" })
  })

  test("names oversized, binary and unstorable files instead of sending them", () => {
    const blocks = buildThinAcpPromptBlocks([
      user("x", [
        { type: "file", mediaType: "text/plain", filename: "big.txt", data: new Uint8Array(MAX_TEXT_ATTACHMENT_BYTES + 1).fill(65) },
        { type: "file", mediaType: "text/plain", filename: "bin.txt", data: new Uint8Array([104, 0, 105]) },
        { type: "file", mediaType: "application/pdf", filename: "doc.pdf", data: new Uint8Array([1]) },
      ]),
    ] as any)
    expect(blocks.slice(1).map((b: any) => b.text)).toEqual([
      "[Attached file: big.txt (text/plain): larger than 1 MiB]",
      "[Attached file: bin.txt (text/plain): not a text file]",
      "[Attached file: doc.pdf (application/pdf): could not be stored for Antigravity]",
    ])
  })

  test("the bridge stores PDFs in a per-session folder agy may read, removed on reset", async () => {
    const { ctx } = makeCtx()
    const root = tmpDir()
    const { bridge, procs } = makeBridge({ ctx, attachmentsDir: root })
    try {
      await turn(bridge, "ses/pdf", [
        user("summarize", [{ type: "file", mediaType: "application/pdf", filename: "r.pdf", data: pdfBytes }]),
      ])
      expect(procs[0].extraDirs).toContain(root)
      const link = procs[0].prompts[0].blocks.find((b: any) => b.type === "resource_link")
      const file = fileURLToPath(link.uri)
      expect(path.dirname(file)).toBe(path.join(root, "ses_pdf"))
      expect(fs.readFileSync(file).equals(pdfBytes)).toBe(true)
      expect(fs.statSync(file).mode & 0o777).toBe(0o600)
      await bridge.resetSession("ses/pdf")
      expect(fs.existsSync(path.join(root, "ses_pdf"))).toBe(false)
    } finally {
      await bridge.disposeAll()
    }
  })
})

describe("rewind and edit guard", () => {
  test("detects a removed or edited message, not added ones", () => {
    const first = readTurnHistory([user("one")] as any)
    const rec = recordDelivery(first, "acp-1")!
    expect(historyDiverged(rec, readTurnHistory([user("one"), assistant("a"), user("two")] as any))).toBe(false)
    // Retry of the same message is not a rewind.
    expect(historyDiverged(rec, readTurnHistory([user("one")] as any))).toBe(false)
    const rec2 = recordDelivery(readTurnHistory([user("one"), assistant("a"), user("two")] as any), "acp-1")!
    // Reverted to before "two", then sent something else.
    expect(historyDiverged(rec2, readTurnHistory([user("one"), assistant("a"), user("three")] as any))).toBe(true)
    // Edited "one", then sent the same "two" again.
    expect(historyDiverged(rec2, readTurnHistory([user("uno"), assistant("a"), user("two"), user("x")] as any))).toBe(true)
    // Reverted everything.
    expect(historyDiverged(rec2, readTurnHistory([user("fresh")] as any))).toBe(true)
    // After a compaction the history is not comparable.
    const compacted = [{ role: "user", content: [{ type: "text", text: "[Prior conversation summary]\nsum" }] }, user("y")]
    expect(historyDiverged(rec2, readTurnHistory(compacted as any))).toBe(false)
  })

  test("the kept conversation excludes the latest message", () => {
    const kept = buildKeptConversation([
      { role: "system", content: "sys" },
      user("one"),
      assistant("answer one"),
      user("new question"),
    ] as any)!
    expect(kept).toContain("User:\none")
    expect(kept).toContain("Assistant:\nanswer one")
    expect(kept).not.toContain("new question")
    expect(kept).not.toContain("sys")
    expect(buildKeptConversation([user("only")] as any)).toBeUndefined()
  })

  test("a rewound session starts a fresh agy session seeded with the kept turns", async () => {
    const { ctx } = makeCtx()
    const { bridge, procs } = makeBridge({ ctx })
    try {
      await turn(bridge, "ses-rw", [user("one")])
      await turn(bridge, "ses-rw", [user("one"), assistant("a1"), user("two")])
      expect(procs[0].prompts.map((p) => p.sessionId)).toEqual(["acp-1", "acp-1"])

      // The user reverted "two" and sent "three".
      const parts = await turn(bridge, "ses-rw", [user("one"), assistant("a1"), user("three")])
      expect(textOf(parts).startsWith(REWIND_NOTICE)).toBe(true)
      const last = procs.at(-1)!.prompts.at(-1)!
      expect(last.sessionId).toBe("acp-2")
      expect(last.blocks[0].text).toContain("<earlier_conversation>")
      expect(last.blocks[0].text).toContain("User:\none")
      expect(last.blocks[0].text).not.toContain("two")
      expect(last.blocks.at(-1)).toEqual({ type: "text", text: "three" })
      expect(procs[0].closed).toEqual(["acp-1"])

      // Continuing normally keeps the new session.
      await turn(bridge, "ses-rw", [user("one"), assistant("a1"), user("three"), assistant("a3"), user("four")])
      const next = procs.at(-1)!.prompts.at(-1)!
      expect(next.sessionId).toBe("acp-2")
      expect(next.blocks).toEqual([{ type: "text", text: "four" }])
    } finally {
      await bridge.disposeAll()
    }
  })
})

describe("model availability and defaults", () => {
  test("an unknown model or thinking level is an error, not a substitute", () => {
    expect(() => resolveAcpModelTarget(FALLBACK_MODELS, "gemini-9")).toThrow(UnavailableModelError)
    expect(() => resolveAcpModelTarget(FALLBACK_MODELS, "gemini-4-argon", "xhigh")).toThrow(/low, medium, high/)
    expect(resolveAcpModelTarget(FALLBACK_MODELS, "gemini-3.8-flash").acpModelId).toBe("gemini-3.8-flash-high")
    // OpenCode's "default" variant means no level was picked.
    expect(resolveAcpModelTarget(FALLBACK_MODELS, "gemini-4-hydrogen", "default").acpModelId).toBe(
      "gemini-4-hydrogen-high",
    )
  })

  test("the default thinking level is agy's current one", () => {
    const catalog = buildModelCatalog({
      models: { availableModels: ["a-low", "a-medium", "a-high"].map((modelId) => ({ modelId })) },
      configOptions: [
        { id: "model", options: [{ value: "a", name: "A" }] },
        { id: "thought_level", currentValue: "low", options: [{ value: "low" }, { value: "medium" }, { value: "high" }] },
      ],
    })
    expect(catalog[0].defaultAcpModelId).toBe("a-low")
  })

  test("legacy families are recognized", () => {
    expect(isLegacyAcpModel("gemini-3.7-flash")).toBe(true)
    expect(isLegacyAcpModel("gemini-3.6-flash-high")).toBe(true)
    expect(isLegacyAcpModel("gemini-3.8-flash")).toBe(false)
    expect(isLegacyAcpModel("gemini-pro-orchestrator")).toBe(false)
  })

  test("a turn on an unavailable model reports it without prompting", async () => {
    const { ctx } = makeCtx()
    const { bridge, procs } = makeBridge({ ctx })
    try {
      const parts = await turn(bridge, "ses-model", [user("hi")], "gemini-9")
      expect(textOf(parts)).toContain('no longer offers the model "gemini-9"')
      expect(parts.at(-1)?.finishReason?.raw).toBe("model_unavailable")
      expect(procs).toHaveLength(0)
    } finally {
      await bridge.disposeAll()
    }
  })

  test("agy rejecting the model is reported instead of keeping another model", async () => {
    const { ctx } = makeCtx()
    const { bridge, procs } = makeBridge({ ctx, setModel: async () => Promise.reject(new Error("unknown model")) })
    try {
      const parts = await turn(bridge, "ses-reject", [user("hi")], "gemini-4-neon", "low")
      expect(textOf(parts)).toContain('did not accept the model "gemini-4-neon-low"')
      expect(procs[0].prompts).toHaveLength(0)
    } finally {
      await bridge.disposeAll()
    }
  })
})

describe("Allow for this thread", () => {
  test("reads agy's bounded security warning", () => {
    expect(antigravitySecurityWarning({ _meta: { "agy.security.warning": { title: "T", message: " M " } } })).toBe("M")
    expect(antigravitySecurityWarning({ _meta: { "agy.security.warning": { title: "T" } } })).toBe("T")
    expect(antigravitySecurityWarning({})).toBeUndefined()
    const long = antigravitySecurityWarning({ _meta: { "agy.security.warning": { message: "x".repeat(600) } } })!
    expect(long.length).toBe(512)
    expect(long.endsWith("...")).toBe(true)
  })

  async function requestPermission(options: any[]) {
    const { ctx, asserts } = makeCtx()
    let outcome: any
    const { bridge } = makeBridge({
      ctx,
      onPrompt: async (proc) => {
        outcome = await proc.options.onPermissionRequest({
          sessionId: "acp-1",
          toolCall: { toolCallId: "t1", kind: "execute", title: "ls" },
          options,
        })
        return { stopReason: "end_turn" }
      },
    })
    try {
      await bridge.setMode("ses-perm", "default")
      await turn(bridge, "ses-perm", [user("run ls")])
    } finally {
      await bridge.disposeAll()
    }
    return { assert: asserts[0], outcome }
  }

  test("offers Allow always only when agy offers allow_always, with its warning", async () => {
    const { assert, outcome } = await requestPermission([
      { optionId: "allow", name: "Allow", kind: "allow_once" },
      {
        optionId: "always",
        name: "Allow for this conversation",
        kind: "allow_always",
        _meta: { "agy.security.warning": { message: "Commands may read untrusted content." } },
      },
      { optionId: "deny", name: "Deny", kind: "reject_once" },
    ])
    expect(assert.save).toEqual(["ls"])
    expect(assert.metadata[ANTIGRAVITY_WARNING_METADATA_KEY]).toBe("Commands may read untrusted content.")
    expect(outcome).toEqual({ outcome: "selected", optionId: "allow" })
  })

  test("without allow_always only a one-time approval is asked", async () => {
    const { assert } = await requestPermission([
      { optionId: "allow", name: "Allow", kind: "allow_once" },
      { optionId: "deny", name: "Deny", kind: "reject_once" },
    ])
    expect(assert.save).toBeUndefined()
    expect(assert.metadata[ANTIGRAVITY_WARNING_METADATA_KEY]).toBeUndefined()
  })
})
