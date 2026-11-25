import { describe, expect, test } from "bun:test"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { Effect } from "effect"
import { AcpProcess } from "../src/acp-client.js"
import {
  accountAgyEnv,
  accountIdOfProvider,
  accountProviderID,
  findAccount,
  hasSavedLogin,
  isAntigravityProvider,
  newAccountId,
  prepareAccountHome,
  readAccounts,
  savedLoginFiles,
  validateAccountName,
  writeAccounts,
} from "../src/accounts.js"
import { hasNonAcpAssistantHistory, isLocalStatusMessage } from "../src/history-sanitizer.js"
import { FOREIGN_HISTORY_MESSAGE, SessionBridgeManager, resetSharedCatalogForTests } from "../src/session-bridge.js"

function tempDir(): string {
  return fs.mkdtempSync(path.join(process.env.TMPDIR || os.tmpdir(), "agy-accounts-"))
}

function makeCtx(store = new Map<string, unknown>()) {
  return {
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
    permission: { assert: () => Effect.void },
  } as any
}

async function readAll(stream: ReadableStream<any>) {
  const reader = stream.getReader()
  const parts: any[] = []
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    parts.push(value)
  }
  return parts
}

describe("account registry", () => {
  test("provider IDs map to accounts and back", () => {
    expect(accountProviderID("main")).toBe("antigravity-acp")
    expect(accountProviderID("work")).toBe("antigravity-acp-work")
    expect(accountIdOfProvider("antigravity-acp")).toBe("main")
    expect(accountIdOfProvider("antigravity-acp-work")).toBe("work")
    expect(accountIdOfProvider("antigravity-acp-")).toBeNull()
    expect(accountIdOfProvider("google")).toBeNull()
    expect(isAntigravityProvider("antigravity-acp-work")).toBe(true)
    expect(isAntigravityProvider("fs-cortex")).toBe(false)
  })

  test("names become stable, unique IDs", () => {
    expect(newAccountId("Account 1", [])).toBe("account-1")
    expect(newAccountId("Account 1", ["account-1"])).toBe("account-1-2")
    expect(newAccountId("Main!", [])).toBe("main-2")
    expect(newAccountId("Ünïcode Work", [])).toBe("unicode-work")
    expect(newAccountId("!!!", [])).toBe("account")
    expect(() => validateAccountName("  ")).toThrow()
    expect(() => validateAccountName("main")).toThrow()
    expect(() => validateAccountName("a\nb")).toThrow()
    expect(validateAccountName("  Work ")).toBe("Work")
  })

  test("the registry round-trips and drops bad entries", () => {
    const dir = tempDir()
    try {
      const env = { ...process.env, ANTIGRAVITY_ACP_STATE_DIR: dir }
      expect(readAccounts(env)).toEqual([])
      writeAccounts([{ id: "work", name: "Work", createdAt: 1 }], env)
      expect(readAccounts(env)).toEqual([{ id: "work", name: "Work", createdAt: 1 }])
      expect(fs.statSync(path.join(dir, "accounts.json")).mode & 0o777).toBe(0o600)
      fs.writeFileSync(
        path.join(dir, "accounts.json"),
        JSON.stringify({
          accounts: [
            { id: "work", name: "Work" },
            { id: "work", name: "Dup" },
            { id: "main", name: "Main" },
            { id: "../x", name: "Bad" },
            { id: "ok", name: "" },
          ],
        }),
      )
      expect(readAccounts(env).map((a) => a.id)).toEqual(["work"])
      expect(findAccount(readAccounts(env), "WORK")?.id).toBe("work")
    } finally {
      fs.rmSync(dir, { recursive: true, force: true })
    }
  })

  test("an account folder links your rules and skills and starts signed out", () => {
    const dir = tempDir()
    try {
      const userHome = path.join(dir, "home")
      fs.mkdirSync(path.join(userHome, ".gemini", "config", "skills"), { recursive: true })
      fs.writeFileSync(path.join(userHome, ".gemini", "AGENTS.md"), "rules")
      fs.writeFileSync(path.join(userHome, ".gemini", "jetski-standalone-oauth-token"), "main login")
      const env = { ...process.env, HOME: userHome, ANTIGRAVITY_ACP_STATE_DIR: path.join(dir, "state") }
      const home = prepareAccountHome("work", env)
      expect(fs.readFileSync(path.join(home, "AGENTS.md"), "utf8")).toBe("rules")
      expect(fs.lstatSync(path.join(home, "config", "skills")).isSymbolicLink()).toBe(true)
      expect(hasSavedLogin(home)).toBe(false)
      fs.writeFileSync(path.join(home, "antigravity-acp", "antigravity-oauth-token"), "x")
      expect(savedLoginFiles(home)).toEqual([path.join(home, "antigravity-acp", "antigravity-oauth-token")])
      // Running it again keeps what is there.
      expect(prepareAccountHome("work", env)).toBe(home)
    } finally {
      fs.rmSync(dir, { recursive: true, force: true })
    }
  })

  test("agy runs with only the account's own login", () => {
    const env = accountAgyEnv("/acct", {
      PATH: "/bin",
      GEMINI_API_KEY: "k",
      GOOGLE_API_KEY: "g",
      GOOGLE_APPLICATION_CREDENTIALS: "/adc.json",
      GOOGLE_CLOUD_PROJECT: "p",
    })
    expect(env).toEqual({
      PATH: "/bin",
      GEMINI_HOME: "/acct",
      AGY_ACP_FORCE_FILE_STORAGE: "1",
      SSH_CONNECTION: "127.0.0.1 0 127.0.0.1 0",
    })
  })
})

describe("account bridges", () => {
  test("an account's agy gets its folder flags and environment", async () => {
    const dir = tempDir()
    try {
      const out = path.join(dir, "out.txt")
      const fake = path.join(dir, "agy")
      fs.writeFileSync(fake, `#!/bin/sh\necho "$* | $GEMINI_HOME | $AGY_ACP_FORCE_FILE_STORAGE" > ${out}\nsleep 5\n`)
      fs.chmodSync(fake, 0o755)
      const proc = new AcpProcess({ cwd: dir, binaryPath: fake, accountHome: "/acct/work" })
      const deadline = Date.now() + 5000
      while (!fs.existsSync(out) && Date.now() < deadline) await new Promise((r) => setTimeout(r, 20))
      await proc.dispose()
      expect(fs.readFileSync(out, "utf8").trim()).toBe(
        "acp --stdio --process-per-session --gemini_dir /acct/work --app_data_dir antigravity-acp | /acct/work | 1",
      )
    } finally {
      fs.rmSync(dir, { recursive: true, force: true })
    }
  })

  test("each account keeps its own session IDs and marks its replies with its provider", async () => {
    const store = new Map<string, unknown>()
    const ctx = makeCtx(store)
    const homes: (string | undefined)[] = []
    const fakeProc = (id: string) => (opts: any) => {
      homes.push(opts.accountHome)
      return {
        isClosed: false,
        initialize: async () => ({}),
        authenticate: async () => ({}),
        newSession: async () => ({ sessionId: id }),
        setModel: async () => {},
        setMode: async () => {},
        notifyCancel: () => {},
        dispose: async () => {},
        prompt: async (sid: string) => {
          opts.onUpdate?.(sid, { sessionUpdate: "agent_message_chunk", content: { type: "text", text: "hi" } })
          return { stopReason: "end_turn" }
        },
      } as any
    }
    const main = new SessionBridgeManager(ctx, "/tmp/acp-test-dir", { createProc: fakeProc("acp-main") })
    const work = new SessionBridgeManager(ctx, "/tmp/acp-test-dir", {
      createProc: fakeProc("acp-work"),
      account: { id: "work", name: "Work", home: "/acct/work" },
    })
    try {
      expect(work.providerID).toBe("antigravity-acp-work")
      const ask = (b: SessionBridgeManager, sid: string) =>
        b
          .createLanguageModel("gemini-4-neon")
          .doStream({
            prompt: [{ role: "user", content: [{ type: "text", text: "hello" }] }],
            headers: { "x-opencode-session-id": sid },
          } as any)
          .then(({ stream }) => readAll(stream))
      const mainParts = await ask(main, "ses-a")
      const workParts = await ask(work, "ses-b")
      expect(homes).toEqual([undefined, "/acct/work"])
      expect(store.get("antigravity-acp:session:ses-a")).toBe("acp-main")
      expect(store.get("antigravity-acp:account:work:session:ses-b")).toBe("acp-work")
      expect(store.has("antigravity-acp:session:ses-b")).toBe(false)
      expect(mainParts.find((p) => p.type === "finish").providerMetadata).toEqual({ "antigravity-acp": { acp: true } })
      expect(workParts.find((p) => p.type === "finish").providerMetadata).toEqual({ "antigravity-acp-work": { acp: true } })
      expect(work.getState("ses-b").account).toBe("Work")
      expect(main.getState("ses-a").account).toBe("Main")
    } finally {
      await Promise.all([main.disposeAll(), work.disposeAll()])
    }
  })

  test("a session stays on its account: another account's replies lock it like another model's", async () => {
    const main = [{ role: "user", content: [{ type: "text", text: "hi" }] }]
    const fromWork = {
      role: "assistant",
      content: [{ type: "text", text: "reply", providerOptions: { "antigravity-acp-work": { acp: true } } }],
    }
    const localWork = {
      role: "assistant",
      content: [{ type: "text", text: "notice", providerOptions: { "antigravity-acp-work": { localStatus: true } } }],
    }
    // Any Antigravity account's reply is Antigravity's, not another model's.
    expect(hasNonAcpAssistantHistory([...main, fromWork] as any)).toBe(false)
    expect(isLocalStatusMessage(localWork as any)).toBe(true)

    // OpenCode hands a reply's metadata only to its own provider: on another
    // account it arrives without the marker, so that account declines it.
    const bridge = new SessionBridgeManager(makeCtx(), "/tmp/acp-test-dir", {
      account: { id: "spare", name: "Spare", home: "/acct/spare" },
      createProc: () => {
        throw new Error("must not start agy")
      },
    })
    try {
      const { stream } = await bridge.createLanguageModel("gemini-4-neon").doStream({
        prompt: [
          ...main,
          { role: "assistant", content: [{ type: "text", text: "reply from Work" }] },
          { role: "user", content: [{ type: "text", text: "next" }] },
        ],
        headers: { "x-opencode-session-id": "ses-c" },
      } as any)
      const text = (await readAll(stream)).filter((p) => p.type === "text-delta").map((p) => p.delta).join("")
      expect(text).toBe(FOREIGN_HISTORY_MESSAGE)
    } finally {
      await bridge.disposeAll()
    }
  })

  test("a signed-out account says how to sign in", async () => {
    const bridge = new SessionBridgeManager(makeCtx(), "/tmp/acp-test-dir", {
      account: { id: "spare", name: "Spare", home: "/acct/spare" },
      createProc: () =>
        ({
          isClosed: false,
          initialize: async () => ({}),
          authenticate: async () => {
            throw new Error("No browser is available here (this is a remote (SSH) session)")
          },
          dispose: async () => {},
        }) as any,
    })
    try {
      const { stream } = await bridge.createLanguageModel("gemini-4-neon").doStream({
        prompt: [{ role: "user", content: [{ type: "text", text: "hello" }] }],
        headers: { "x-opencode-session-id": "ses-d" },
      } as any)
      const text = (await readAll(stream)).filter((p) => p.type === "text-delta").map((p) => p.delta).join("")
      expect(text).toContain('agy-accounts login "Spare"')
      expect(bridge.getState("ses-d").lastError).toContain("not signed in")
    } finally {
      await bridge.disposeAll()
    }
  })

  test("each account lists only the models its own agy offers", async () => {
    resetSharedCatalogForTests()
    const store = new Map<string, unknown>()
    const ctx = makeCtx(store)
    const model = (id: string) => ({ id, name: id, variants: [], defaultAcpModelId: id })
    const main = new SessionBridgeManager(ctx, "/tmp/w", {
      discoverModels: async () => [model("gemini-4-neon"), model("claude-opus-5-5")],
    })
    const work = new SessionBridgeManager(ctx, "/tmp/w", {
      account: { id: "work", name: "Work", home: "/acct/work" },
      discoverModels: async () => [model("gemini-3.8-flash")],
    })
    try {
      // Before its list is read, an extra account offers nothing.
      expect(work.getModels()).toEqual([])
      expect(main.getModels().length).toBeGreaterThan(0)
      await Promise.all([main.refreshModels({ force: true }), work.refreshModels({ force: true })])
      expect(main.getModels().map((m) => m.id)).toEqual(["gemini-4-neon", "claude-opus-5-5"])
      expect(work.getModels().map((m) => m.id)).toEqual(["gemini-3.8-flash"])
      expect((store.get("antigravity-acp:account:work:model-catalog:v1") as any).models).toHaveLength(1)
      expect((store.get("antigravity-acp:model-catalog:v1") as any).models).toHaveLength(2)
      // After a restart each account reads its own saved list.
      resetSharedCatalogForTests()
      const again = new SessionBridgeManager(ctx, "/tmp/w", {
        account: { id: "work", name: "Work", home: "/acct/work" },
      })
      expect((await again.loadCachedModels()).stale).toBe(false)
      expect(again.getModels().map((m) => m.id)).toEqual(["gemini-3.8-flash"])
      await again.disposeAll()
    } finally {
      await Promise.all([main.disposeAll(), work.disposeAll()])
      resetSharedCatalogForTests()
    }
  })
})
