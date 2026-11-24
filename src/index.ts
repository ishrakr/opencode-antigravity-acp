import { Plugin } from "@opencode/plugin/effect"
import { Effect, Stream } from "effect"
import { isLegacyAcpModel, resolveAcpAuthConfig, type AcpDiscoveredModel } from "./acp-client.js"
import {
  ACP_PROVIDER_ID,
  sanitizeForAcpModel,
  sanitizeForNonAcpModel,
} from "./history-sanitizer.js"
import { AcpRpc } from "./rpc.js"
import { ANTIGRAVITY_WARNING_METADATA_KEY, SessionBridgeManager } from "./session-bridge.js"

function buildModelEntries(models: readonly AcpDiscoveredModel[], bridgeGeneration: string): any[] {
  return models.map((m) => ({
    id: m.id,
    modelID: m.id,
    providerID: ACP_PROVIDER_ID,
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
  id: ACP_PROVIDER_ID,
  effect: (ctx) =>
    Effect.gen(function* () {
      const bridgeGeneration = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
      // An invalid sign-in setting stops the plugin from loading instead of
      // silently using a different method.
      const auth = yield* Effect.try(() => resolveAcpAuthConfig(ctx.options))
      const bridge = new SessionBridgeManager(ctx, ctx.location.directory, undefined, {
        auth,
        onCatalogChanged: () => {
          Effect.runFork(ctx.provider.reload().pipe(Effect.catch(() => Effect.void)))
        },
      })

      yield* Effect.addFinalizer(() => Effect.promise(() => bridge.disposeAll()))

      const cacheStatus = yield* Effect.promise(() => bridge.loadCachedModels())

      yield* ctx.provider.transform((editor) => {
        if (editor.get(ACP_PROVIDER_ID as any)) {
          editor.remove(ACP_PROVIDER_ID as any)
        }
        editor.add({
          info: {
            id: ACP_PROVIDER_ID as any,
            name: "Antigravity (ACP)",
            activation: "enabled",
            package: "aisdk:antigravity-acp",
          } as any,
          models: buildModelEntries(bridge.getModels(), bridgeGeneration) as any,
        })
      })

      // Both sdk and language AISDK hooks are required when using "aisdk:antigravity-acp"
      yield* ctx.aisdk.hook(
        "sdk",
        (input) =>
          Effect.sync(() => {
            input.sdk = {
              languageModel: (id: string) => bridge.createLanguageModel(id),
            }
          }),
        { providerID: ACP_PROVIDER_ID as any },
      )

      yield* ctx.aisdk.hook(
        "language",
        (input) =>
          Effect.sync(() => {
            const id = String(input.model.modelID ?? input.model.id)
            input.language = bridge.createLanguageModel(id)
          }),
        { providerID: ACP_PROVIDER_ID as any },
      )

      // Antigravity is the agent: OpenCode's system prompt and tools never
      // reach agy. Only OpenCode's `question` tool stays, so a question agy
      // asks can be shown to the user and answered.
      yield* ctx.session.hook("context", (input) =>
        Effect.sync(() => {
          if (input.model.providerID === ACP_PROVIDER_ID) {
            sanitizeForAcpModel(input.messages as any[])
            const question = input.tools.question
            bridge.updateContextSnapshot(input.sessionID, {
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

      // Pass exact sessionID, request kind, and selected variant into LanguageModelV3.doStream via headers
      yield* ctx.session.hook(
        "model.request",
        (input) =>
          Effect.sync(() => {
            input.headers["x-opencode-session-id"] = input.sessionID
            input.headers["x-opencode-request-kind"] = input.kind
            input.headers["x-opencode-agent"] = input.agent
            input.headers["x-opencode-variant"] = input.model.variant ?? ""
          }),
        { providerID: ACP_PROVIDER_ID as any },
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
        { providerID: ACP_PROVIDER_ID as any },
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
        { providerID: ACP_PROVIDER_ID as any },
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
          const { sessionID } = input as { sessionID: string }
          return Effect.sync(() => bridge.getState(sessionID))
        },
        setMode: (input) => {
          const { sessionID, mode } = input as {
            sessionID: string
            mode: "auto" | "accept-edits" | "default" | "plan"
          }
          return Effect.promise(() => bridge.setMode(sessionID, mode))
        },
        resetSession: (input) => {
          const { sessionID } = input as { sessionID: string }
          return Effect.promise(() => bridge.resetSession(sessionID))
        },
        warmSession: (input) => {
          const { sessionID } = input as { sessionID?: string }
          return Effect.promise(() => bridge.warmSession(sessionID))
        },
        reloadModels: () =>
          Effect.gen(function* () {
            const { models } = yield* Effect.promise(() => bridge.refreshModels({ force: true }))
            yield* ctx.provider.reload()
            return { modelCount: models.length }
          }).pipe(Effect.orDie),
      })

      if (cacheStatus.stale) {
        yield* Effect.forkScoped(
          Effect.promise(() => bridge.refreshModelsInBackground()).pipe(
            Effect.catch(() => Effect.void),
          ),
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
              if (typeof sid !== "string" || sid.length === 0 || !bridge.hasSession(sid)) {
                return Effect.void
              }
              return Effect.promise(async () => {
                if (evt.type === "session.deleted") {
                  await bridge.deleteSession(sid)
                  return
                }
                await bridge.handleInterrupt(
                  sid,
                  evt.type === "session.execution.interrupted"
                    ? "Interrupted by user"
                    : "Session execution failed",
                )
              })
            }),
            Effect.catch(() => Effect.void),
          ),
      )

      yield* Effect.logInfo("Antigravity ACP plugin loaded", {
        directory: ctx.location.directory,
        models: bridge.getModels().length,
        authMethod: auth.method,
      })
    }).pipe(Effect.orDie),
})
