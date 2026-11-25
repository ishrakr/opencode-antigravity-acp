// `/agy-quota` in the chat box. OpenChamber loads this hidden page for the
// command; it reads the quota from the service and shows it in a toast, with no
// model turn and nothing attached to the message.
import { connectHost, HostRequestError } from "@openchamber/sdk"
import type { AccountsQuota } from "./quota.ts"
import { antigravityTargetOf, quotaSummary, readAccountsQuota, type SessionTarget } from "./view.ts"

const host = connectHost()
let locale: string | undefined
let target: SessionTarget | null = null

host.onReady((context) => {
  locale = context.locale
})
host.onSession((session) => {
  target = antigravityTargetOf(session?.model)
})

function failureText(error: unknown): string {
  if (error instanceof HostRequestError) {
    if (error.code === "NO_SERVICE" || error.code === "NOT_GRANTED") return "Allow the local service for Antigravity quota in Settings → Extensions."
    if (error.code === "DISABLED") return "Antigravity quota is paused in Settings → Extensions."
  }
  return "Could not reach the Antigravity quota service."
}

host.onResolve(async () => {
  let data: AccountsQuota
  try {
    const result = await host.serviceRequest({ method: "GET", path: "/usage" })
    if (result.status !== 200) throw new Error(`status ${result.status}`)
    data = readAccountsQuota(JSON.parse(result.body))
  } catch (error) {
    // Thrown messages reach the user.
    throw new Error(failureText(error))
  }
  const message = quotaSummary(data, Date.now(), target, locale)
  const anyOk = data.accounts.some((account) => account.data?.ok)
  await host.toast({ kind: anyOk ? "info" : "error", message, copy: true, persistent: true })
  return null
})
