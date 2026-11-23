import { Plugin } from "@opencode/plugin/effect"
import { Effect, Stream } from "effect"
import type { AcpDiscoveredModel } from "./acp-client.js"
import {
  ACP_PROVIDER_ID,
  sanitizeForAcpModel,
  sanitizeForNonAcpModel,
} from "./history-sanitizer.js"
import { AcpRpc } from "./rpc.js"
import { SessionBridgeManager } from "./session-bridge.js"

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
      input: ["text", "image"],
      output: ["text"],
    },
    variants: m.variants.map((v) => ({ id: v.id })),
    time: { released: 0 },
    cost: [],
    status: "active",
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
      const bridge = new SessionBridgeManager(ctx, ctx.location.directory, undefined, {
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

      // Thin ACP: zero outer-harness prompt injection. Snapshot the live tool
      // catalog for the Code Mode MCP relay (default), then always clear outer
      // system instructions. `input.tools` is preserved in Code Mode so
      // `mcp_oc_*` round-trips are permitted, cleared (`{}`) in Pure ACP
      // opt-out (schemas are never injected either way).
      yield* ctx.session.hook("context", (input) =>
        Effect.sync(() => {
          if (input.model.providerID === ACP_PROVIDER_ID) {
            sanitizeForAcpModel(input.messages as any[])
            bridge.updateContextSnapshot(input.sessionID, {
              systemText: "",
              agent: input.agent,
              tools: input.tools,
            })
            input.system = []
            // Only clear OpenCode's request tool allowlist in Pure ACP mode;
            // when + Code Mode is enabled, OpenCode needs `input.tools` intact
            // so `mcp_oc_*` tool-call round-trips (e.g. `execute`) are permitted
            // (our `doStream` ignores `options.tools` and never injects schemas).
            // Pure ACP still keeps `question` so agy's ask_question can be answered.
            if (!bridge.getState(input.sessionID).codeModeEnabled) {
              const question = input.tools.question
              input.tools = question ? { question } : {}
            }
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
        setCodeMode: (input) => {
          const { sessionID, codeModeEnabled } = input as {
            sessionID: string
            codeModeEnabled: boolean
          }
          return Effect.promise(() => bridge.setCodeMode(sessionID, codeModeEnabled))
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
      })
    }).pipe(Effect.orDie),
})
