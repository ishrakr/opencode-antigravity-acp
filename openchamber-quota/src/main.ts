// Local service for the Antigravity section in Work Status. OpenChamber starts
// it; the section reads the quota from GET /usage through the host proxy.
import http from "node:http"
import type { QuotaProviderUsageData } from "@openchamber/sdk"
import { runAgyQuota } from "./quota.ts"

const port = Number(process.env.OPENCHAMBER_SERVICE_PORT)
const serviceToken = process.env.OPENCHAMBER_SERVICE_TOKEN ?? ""
if (!port || !serviceToken) {
  console.error("OPENCHAMBER_SERVICE_PORT and OPENCHAMBER_SERVICE_TOKEN are required")
  process.exit(1)
}

/**
 * Each read starts agy (about 2 s and 240 MB). Refreshes from several screens
 * share one run, and a good reading is reused for a minute.
 */
const CACHE_MS = 60_000
let inFlight: ReturnType<typeof runAgyQuota> | undefined
let cached: { at: number; data: Awaited<ReturnType<typeof runAgyQuota>> } | undefined
const readQuota = () => {
  if (cached && Date.now() - cached.at < CACHE_MS) return Promise.resolve(cached.data)
  inFlight ??= runAgyQuota()
    .then((data) => {
      cached = data.ok ? { at: Date.now(), data } : undefined
      return data
    })
    .finally(() => {
      inFlight = undefined
    })
  return inFlight
}

const send = (res: http.ServerResponse, status: number, body: QuotaProviderUsageData | { ok: true } | { error: string }): void => {
  res.writeHead(status, { "Content-Type": "application/json" })
  res.end(JSON.stringify(body))
}

const server = http.createServer((req, res) => {
  if (req.headers.authorization !== `Bearer ${serviceToken}`) {
    send(res, 401, { error: "unauthorized" })
    return
  }
  const url = new URL(req.url ?? "/", "http://127.0.0.1")
  if (url.pathname === "/health") {
    send(res, 200, { ok: true })
    return
  }
  if (url.pathname === "/usage" && req.method === "GET") {
    readQuota()
      .then((data) => send(res, 200, data))
      .catch(() => send(res, 500, { error: "could not read the quota" }))
    return
  }
  send(res, 404, { error: "not-found" })
})

server.listen(port, "127.0.0.1")
