import { Plugin } from "@opencode/plugin/effect"
import { Effect, Stream } from "effect"
import { isLegacyAcpModel, resolveAcpAuthConfig, type AcpDiscoveredModel } from "./acp-client.js"
import {
  MAIN_PROVIDER_ID,
  accountProviderID,
  hasSavedLogin,
  prepareAccountHome,
  readAccounts,
} from "./accounts.js"
import { sanitizeForAcpModel, sanitizeForNonAcpModel } from "./history-sanitizer.js"
import { AcpRpc } from "./rpc.js"
import { ANTIGRAVITY_WARNING_METADATA_KEY, SessionBridgeManager } from "./session-bridge.js"

function buildModelEntries(
  models: readonly AcpDiscoveredModel[],
  bridgeGeneration: string,
  providerID: string,
): any[] {
  return models.map((m) => ({
    id: m.id,
    modelID: m.id,
    providerID,
    type: "chat",
    family: m.family ?? m.id,
    name: m.name,
    package: "aisdk:antigravity-acp",
    // Per-bridge-generation marker. OpenCode caches LanguageModelV3 objects
    // keyed by {providerID, id, modelID, package, settings, headers, body,
    // limit} and never evicts on plugin reload, so a reloaded plugin would
    // otherwise keep resolving to the disposed bridge's stale LM. Bumping this
    // inert settings field forces a cache miss so turns resolve to the live
    // bridge. Ignored semantically (our sdk/language hooks override everything).
    settings: { antigravityBridgeGeneration: bridgeGeneration },
    capabilities: {
      tools: true,
      // PDFs are linked and text files embedded; agy declines audio.
      input: ["text", "image", "pdf"],
      output: ["text"],
    },
    variants: m.variants.map((v) => ({ id: v.id })),
    time: { released: 0 },
    cost: [],
    status: isLegacyAcpModel(m.id) ? "deprecated" : "active",
    enabled: true,
    limit: {
      context: 1048576,
      output: 65536,
    },
  }))
}

function summarizeTitleFromMessages(messages: readonly any[]): string | undefined {
  for (const msg of messages) {
    if (msg?.role !== "user" || !Array.isArray(msg.content)) continue
    const text = msg.content
      .filter((p: any) => p?.type === "text" && typeof p.text === "string")
      .map((p: any) => p.text)
      .join(" ")
      .replace(/\s+/g, " ")
      .trim()
    if (!text) continue
    return text.length > 60 ? `${text.slice(0, 57)}...` : text
  }
  return undefined
}

export default Plugin.define({
  id: MAIN_PROVIDER_ID,
  effect: (ctx) =>
    Effect.gen(function* () {
      const bridgeGeneration = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
      // An invalid sign-in setting stops the plugin from loading instead of
      // silently using a different method.
      const auth = yield* Effect.try(() => resolveAcpAuthConfig(ctx.options))
      const reloadProviders = () => {
        Effect.runFork(ctx.provider.reload().pipe(Effect.catch(() => Effect.void)))
      }
      // Your normal agy login, then one provider per extra account (as in
      // T3 Code). A session uses the account whose model it picked; nothing
      // switches accounts on its own. Accounts load when OpenCode starts.
      const bridges = new Map<string, SessionBridgeManager>()
      // A session you moved to another account: the accounts it left stop
      // their process for it, so only one account works on a session.
      const releaseElsewhere = (providerID: string) => async (sessionID: string) => {
        for (const [id, b] of bridges) {
          if (id !== providerID && b.hasSession(sessionID)) await b.resetSession(sessionID)
        }
      }
      const bridge = new SessionBridgeManager(ctx, ctx.location.directory, {
        auth,
        onCatalogChanged: reloadProviders,
        onSessionMoved: releaseElsewhere(MAIN_PROVIDER_ID),
      })
      bridges.set(MAIN_PROVIDER_ID, bridge)
      for (const account of readAccounts()) {
        let home: string
        try {
          home = prepareAccountHome(account.id)
        } catch {
          continue
        }
        bridges.set(
          accountProviderID(account.id),
          new SessionBridgeManager(ctx, ctx.location.directory, {
            // Extra accounts always sign in with their own Google login.
            auth: { method: "oauth-personal" },
            account: { id: account.id, name: account.name, home },
            onCatalogChanged: reloadProviders,
            onSessionMoved: releaseElsewhere(accountProviderID(account.id)),
          }),
        )
      }
      const bridgeFor = (providerID: unknown): SessionBridgeManager | undefined =>
        typeof providerID === "string" ? bridges.get(providerID) : undefined
      const bridgeForRpc = (providerID: unknown): SessionBridgeManager =>
        providerID === undefined ? bridge : (bridgeFor(providerID) ?? bridge)
      const accountNames = new Map(readAccounts().map((a) => [accountProviderID(a.id), a.name]))

      yield* Effect.addFinalizer(() =>
        Effect.promise(() => Promise.all([...bridges.values()].map((b) => b.disposeAll()))),
      )

      // Each account lists only the models Google allows it, read from its
      // own agy; a stale or missing list is read again in the background.
      const staleBridges: SessionBridgeManager[] = []
      for (const b of bridges.values()) {
        const { stale } = yield* Effect.promise(() => b.loadCachedModels())
        // A signed-out account would only fail to start agy.
        if (stale && (!b.account.home || hasSavedLogin(b.account.home))) staleBridges.push(b)
      }

      yield* ctx.provider.transform((editor) => {
        for (const [providerID, b] of bridges) {
          if (editor.get(providerID as any)) editor.remove(providerID as any)
          // An account whose models are not known yet (not signed in, or
          // still being read) stays out of the picker.
          if (b.getModels().length === 0) continue
          const name = accountNames.get(providerID)
          editor.add({
            info: {
              id: providerID as any,
              name: name ? `Antigravity (${name})` : "Antigravity (ACP)",
              activation: "enabled",
              package: "aisdk:antigravity-acp",
            } as any,
            models: buildModelEntries(b.getModels(), bridgeGeneration, providerID) as any,
          })
        }
      })

      for (const [providerID, b] of bridges) {
        // Both sdk and language AISDK hooks are required when using "aisdk:antigravity-acp"
        yield* ctx.aisdk.hook(
          "sdk",
          (input) =>
            Effect.sync(() => {
              input.sdk = {
                languageModel: (id: string) => b.createLanguageModel(id),
              }
            }),
          { providerID: providerID as any },
        )

        yield* ctx.aisdk.hook(
          "language",
          (input) =>
            Effect.sync(() => {
              const id = String(input.model.modelID ?? input.model.id)
              input.language = b.createLanguageModel(id)
            }),
          { providerID: providerID as any },
        )

        // Pass exact sessionID, request kind, and selected variant into LanguageModelV3.doStream via headers
        yield* ctx.session.hook(
          "model.request",
          (input) =>
            Effect.sync(() => {
              input.headers["x-opencode-session-id"] = input.sessionID
              input.headers["x-opencode-request-kind"] = input.kind
              input.headers["x-opencode-variant"] = input.model.variant ?? ""
            }),
          { providerID: providerID as any },
        )

        // Avoid burning an ACP session/turn just to auto-title new threads
        yield* ctx.session.hook(
          "title",
          (input) =>
            Effect.sync(() => {
              if (input.result) return
              const derived = summarizeTitleFromMessages(input.messages as any[])
              if (derived) input.result = derived
            }),
          { providerID: providerID as any },
        )

        // Antigravity manages its own context. OpenCode's compaction would
        // otherwise send a summarization prompt to agy as a user turn.
        yield* ctx.session.hook(
          "compaction",
          (input) =>
            Effect.sync(() => {
              if (input.result) return
              input.result = {
                summary: "Antigravity keeps its own conversation history; send /compact to compact it.",
              }
            }),
          { providerID: providerID as any },
        )
      }

      // Antigravity is the agent: OpenCode's system prompt and tools never
      // reach agy. Only OpenCode's `question` tool stays, so a question agy
      // asks can be shown to the user and answered.
      yield* ctx.session.hook("context", (input) =>
        Effect.sync(() => {
          const b = bridgeFor(input.model.providerID)
          if (b) {
            sanitizeForAcpModel(input.messages as any[])
            const question = input.tools.question
            b.updateContextSnapshot(input.sessionID, {
              agent: input.agent,
              hasQuestionTool: question !== undefined,
            })
            input.system = []
            input.tools = question ? { question } : {}
          } else {
            sanitizeForNonAcpModel(input.messages as any[])
          }
        }),
      )

      // Show agy's warning on an approval that offers "Allow always".
      yield* ctx.permission.hook("evaluate", (event) =>
        Effect.sync(() => {
          const warning = event.metadata?.[ANTIGRAVITY_WARNING_METADATA_KEY]
          if (event.action.startsWith("antigravity.") && typeof warning === "string" && warning) {
            event.message = event.message ? `${event.message}\n\n${warning}` : warning
          }
        }),
      )

      yield* ctx.rpc.register(AcpRpc, {
        getState: (input) => {
          const { sessionID, providerID } = input as { sessionID: string; providerID?: string }
          return Effect.sync(() => bridgeForRpc(providerID).getState(sessionID))
        },
        setMode: (input) => {
          const { sessionID, mode, providerID } = input as {
            sessionID: string
            providerID?: string
            mode: "auto" | "accept-edits" | "default" | "plan"
          }
          return Effect.promise(() => bridgeForRpc(providerID).setMode(sessionID, mode))
        },
        resetSession: (input) => {
          const { sessionID, providerID } = input as { sessionID: string; providerID?: string }
          return Effect.promise(() => bridgeForRpc(providerID).resetSession(sessionID))
        },
        warmSession: (input) => {
          const { sessionID, providerID } = input as { sessionID?: string; providerID?: string }
          return Effect.promise(() => bridgeForRpc(providerID).warmSession(sessionID))
        },
        reloadModels: (input) =>
          Effect.gen(function* () {
            const { providerID } = (input ?? {}) as { providerID?: string }
            const target = bridgeForRpc(providerID)
            const { models } = yield* Effect.promise(() => target.refreshModels({ force: true }))
            yield* ctx.provider.reload()
            return { modelCount: models.length }
          }).pipe(Effect.orDie),
      })

      for (const b of staleBridges) {
        yield* Effect.forkScoped(
          Effect.promise(() => b.refreshModelsInBackground()).pipe(Effect.catch(() => Effect.void)),
        )
      }

      // Ensure Stop / Esc / failures / session deletion interrupt or dispose `agy acp` cleanly
      yield* Effect.forkScoped(
        ctx.event
          .subscribe({
            types: ["session.execution.interrupted", "session.execution.failed", "session.deleted"],
          })
          .pipe(
            Stream.runForEach((evt: any) => {
              const sid = evt?.data?.sessionID
              if (typeof sid !== "string" || sid.length === 0) return Effect.void
              const owners = [...bridges.values()].filter((b) => b.hasSession(sid))
              if (owners.length === 0) return Effect.void
              return Effect.promise(async () => {
                for (const b of owners) {
                  if (evt.type === "session.deleted") {
                    await b.deleteSession(sid)
                    continue
                  }
                  await b.handleInterrupt(
                    sid,
                    evt.type === "session.execution.interrupted"
                      ? "Interrupted by user"
                      : "Session execution failed",
                  )
                }
              })
            }),
            Effect.catch(() => Effect.void),
          ),
      )

      yield* Effect.logInfo("Antigravity ACP plugin loaded", {
        directory: ctx.location.directory,
        models: bridge.getModels().length,
        authMethod: auth.method,
        accounts: bridges.size - 1,
      })
    }).pipe(Effect.orDie),
})
