import http from "node:http"
import crypto from "node:crypto"
import { stripUnsafeInternalLines } from "./history-sanitizer.js"

export interface McpToolDescriptor {
  readonly name: string
  readonly description: string
  readonly inputSchema: Record<string, any>
}

export interface McpCallToolResult {
  readonly content: ReadonlyArray<{ readonly type: "text"; readonly text: string }>
  readonly isError?: boolean
}

export interface McpRelayHandlers {
  readonly getTools: (sessionID: string) => McpToolDescriptor[]
  readonly callTool: (
    sessionID: string,
    toolName: string,
    args: unknown,
    signal: AbortSignal,
  ) => Promise<McpCallToolResult>
}

export function normalizeMcpInputSchema(schema: any): Record<string, any> {
  if (!schema || typeof schema !== "object") {
    return { type: "object", properties: {} }
  }
  const copy = { ...schema }
  if (!copy.type && copy.properties) {
    copy.type = "object"
  }
  if (copy.type === "object" && !copy.properties) {
    copy.properties = {}
  }
  delete copy.$schema
  return copy
}

export class McpRelayServer {
  readonly token: string
  private server?: http.Server
  private port = 0
  private started = false
  private generation = 0
  private startPromise?: Promise<void>

  constructor(private readonly handlers: McpRelayHandlers) {
    this.token = crypto.randomBytes(24).toString("hex")
  }

  async start(): Promise<void> {
    if (this.started && this.port > 0) return
    if (this.startPromise) return this.startPromise

    const gen = ++this.generation
    const server = http.createServer((req, res) => {
      void this.handleHttp(req, res)
    })
    this.server = server

    this.startPromise = new Promise<void>((resolve, reject) => {
      let settled = false
      const cleanup = () => {
        server.off("error", onError)
        server.off("close", onClose)
      }
      const onError = (err: Error) => {
        if (settled) return
        settled = true
        cleanup()
        this.startPromise = undefined
        if (this.server === server) {
          this.server = undefined
        }
        try {
          ;(server as any).closeAllConnections?.()
          server.close()
        } catch {}
        reject(err)
      }
      const onClose = () => {
        if (settled) return
        settled = true
        cleanup()
        this.startPromise = undefined
        if (this.server === server) {
          this.server = undefined
        }
        reject(new Error("McpRelayServer stopped during startup"))
      }
      server.once("error", onError)
      server.once("close", onClose)
      server.listen(0, "127.0.0.1", () => {
        if (settled) return
        settled = true
        cleanup()
        this.startPromise = undefined

        if (this.generation !== gen) {
          if (this.server === server) {
            this.server = undefined
          }
          try {
            ;(server as any).closeAllConnections?.()
            server.close()
          } catch {}
          reject(new Error("McpRelayServer stopped during startup"))
          return
        }

        const addr = server.address()
        if (!addr || typeof addr === "string") {
          if (this.server === server) {
            this.server = undefined
          }
          try {
            ;(server as any).closeAllConnections?.()
            server.close()
          } catch {}
          reject(new Error("McpRelayServer failed to bind an ephemeral TCP port"))
          return
        }

        this.port = addr.port
        this.started = true
        resolve()
      })
    })
    return this.startPromise
  }

  urlForSession(sessionID: string): string {
    if (!this.started || !this.port) {
      throw new Error("McpRelayServer has not started")
    }
    return `http://127.0.0.1:${this.port}/mcp/${encodeURIComponent(sessionID)}`
  }

  authHeaders(): ReadonlyArray<{ readonly name: string; readonly value: string }> {
    return [{ name: "Authorization", value: `Bearer ${this.token}` }]
  }

  async stop(): Promise<void> {
    this.generation++
    const server = this.server
    this.started = false
    this.port = 0
    this.startPromise = undefined
    this.server = undefined
    if (!server) return

    try {
      ;(server as any).closeIdleConnections?.()
      ;(server as any).closeAllConnections?.()
    } catch {}

    await new Promise<void>((resolve) => {
      let done = false
      const finish = () => {
        if (done) return
        done = true
        clearTimeout(timer)
        resolve()
      }
      const timer = setTimeout(finish, 1_500)
      timer.unref?.()
      try {
        server.close(() => finish())
      } catch {
        finish()
      }
    })
  }

  private async handleHttp(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
    try {
      const auth = req.headers["authorization"]
      if (auth !== `Bearer ${this.token}`) {
        res.writeHead(401, { "Content-Type": "application/json" })
        res.end(JSON.stringify({ error: "Unauthorized" }))
        return
      }

      const rawUrl = req.url ?? "/"
      const pathname = new URL(rawUrl, "http://127.0.0.1").pathname
      const match = /^\/mcp\/([^/]+)$/.exec(pathname)
      if (!match) {
        res.writeHead(404, { "Content-Type": "application/json" })
        res.end(JSON.stringify({ error: "Not found" }))
        return
      }
      const sessionID = decodeURIComponent(match[1])

      if (req.method === "DELETE" || req.method === "GET") {
        // Session teardown / unsupported SSE GET -> 200/405 clean response
        res.writeHead(req.method === "DELETE" ? 200 : 405, { "Content-Type": "application/json" })
        res.end("{}")
        return
      }

      if (req.method !== "POST") {
        res.writeHead(405, { "Content-Type": "application/json" })
        res.end(JSON.stringify({ error: "Method not allowed" }))
        return
      }

      const chunks: Buffer[] = []
      for await (const chunk of req) {
        chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk)
      }
      const rawBody = Buffer.concat(chunks).toString("utf8")
      let msg: any
      try {
        msg = JSON.parse(rawBody)
      } catch {
        res.writeHead(400, { "Content-Type": "application/json" })
        res.end(JSON.stringify({ jsonrpc: "2.0", id: null, error: { code: -32700, message: "Parse error" } }))
        return
      }

      const id = msg.id
      const method = String(msg.method ?? "")
      const params = msg.params ?? {}

      // Notification
      if (id === undefined || id === null) {
        res.writeHead(202)
        res.end()
        return
      }

      let result: any
      if (method === "server/discover" || method === "ping") {
        result = {}
      } else if (method === "initialize") {
        result = {
          protocolVersion: params.protocolVersion ?? "2025-03-26",
          capabilities: { tools: { listChanged: true } },
          serverInfo: {
            name: "opencode-relay",
            title: "OpenCode Code Mode & Tool Relay",
            version: "0.3.0",
          },
          instructions:
            "OpenCode Code Mode & workspace tool relay. Use `execute` to run JavaScript in OpenCode Code Mode (`tools.<namespace>.<tool>(...)` and `search(...)` for hidden MCP/workspace namespaces), and `subagent` to launch OpenCode subagents (agents: `explore`, `general`, `build`, `plan`; optional `model` as `<provider>/<modelID>`).",
        }
      } else if (method === "tools/list") {
        const tools = this.handlers.getTools(sessionID).map((t) => ({
          name: t.name,
          description: stripUnsafeInternalLines(t.description || "") || `Tool: ${t.name}`,
          inputSchema: normalizeMcpInputSchema(t.inputSchema),
        }))
        result = { tools }
      } else if (method === "tools/call") {
        const ac = new AbortController()
        const onClose = () => {
          if (!res.writableFinished) ac.abort()
        }
        res.on("close", onClose)
        try {
          result = await this.handlers.callTool(
            sessionID,
            String(params.name ?? ""),
            params.arguments ?? {},
            ac.signal,
          )
        } finally {
          res.off("close", onClose)
        }
      } else {
        this.sendJsonRpc(res, {
          jsonrpc: "2.0",
          id,
          error: { code: -32601, message: `Method not found: ${method}` },
        })
        return
      }

      if (!res.writableEnded) {
        this.sendJsonRpc(res, { jsonrpc: "2.0", id, result })
      }
    } catch (err) {
      if (!res.headersSent) {
        res.writeHead(500, { "Content-Type": "application/json" })
      }
      if (!res.writableEnded) {
        res.end(
          JSON.stringify({
            jsonrpc: "2.0",
            id: null,
            error: {
              code: -32603,
              message: err instanceof Error ? err.message : String(err),
            },
          }),
        )
      }
    }
  }

  private sendJsonRpc(res: http.ServerResponse, payload: unknown): void {
    const body = Buffer.from(JSON.stringify(payload), "utf8")
    res.writeHead(200, {
      "Content-Type": "application/json",
      "Content-Length": String(body.byteLength),
    })
    res.end(body)
  }
}
