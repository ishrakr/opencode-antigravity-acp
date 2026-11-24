import { describe, expect, test } from "bun:test"
import { chmodSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
import os from "node:os"
import path from "node:path"
import { quotaProviderSchemasV1 } from "@openchamber/sdk/schemas"
import { runAgyQuota, toUsageData, type AgyQuotaOutput } from "../src/quota.ts"

// Recorded from `agy -p "/quota" --output-format json` (agy 1.5.14).
const recorded: AgyQuotaOutput = {
  status: "SUCCESS",
  command: {
    name: "usage",
    data: {
      groups: [
        {
          name: "Gemini Models",
          buckets: [
            { id: "gemini-weekly", name: "Weekly Limit Remaining", window: "weekly", remaining_fraction: 0.9791073203086853, reset_time: "2026-11-30T20:03:03Z" },
            { id: "gemini-5h", name: "Five Hour Limit Remaining", window: "5h", remaining_fraction: 0.9364293217658997, reset_time: "2026-11-24T01:03:03Z" },
          ],
        },
        {
          name: "Claude and GPT models",
          buckets: [
            { id: "3p-weekly", name: "Weekly Limit Remaining", window: "weekly", remaining_fraction: 0.42430639266967773, reset_time: "2026-11-28T19:05:11Z" },
            { id: "3p-5h", name: "Five Hour Limit Remaining", window: "5h", remaining_fraction: 1, reset_time: "2026-11-24T02:13:05Z" },
          ],
        },
      ],
    },
  },
}

describe("agy /quota to OpenChamber usage", () => {
  test("one entry per model group with 5h and weekly windows", () => {
    const data = toUsageData(recorded)
    expect(data.ok).toBe(true)
    expect(Object.keys(data.usage!.models!)).toEqual(["Gemini Models", "Claude and GPT models"])
    expect(data.usage!.models!["Claude and GPT models"].windows).toEqual({
      weekly: { usedPercent: 57.6, windowSeconds: 604800, resetAt: Date.parse("2026-11-28T19:05:11Z") },
      "5h": { usedPercent: 0, windowSeconds: 18000, resetAt: Date.parse("2026-11-24T02:13:05Z") },
    })
    expect(data.usage!.models!["Gemini Models"].windows["5h"].usedPercent).toBe(6.4)
  })

  test("headline windows take each window's most used group", () => {
    const { windows } = toUsageData(recorded).usage!
    expect(windows.weekly.usedPercent).toBe(57.6)
    expect(windows["5h"].usedPercent).toBe(6.4)
  })

  test("the answer passes OpenChamber's own schema", () => {
    const parsed = quotaProviderSchemasV1.data["usage.read"].safeParse(toUsageData(recorded))
    expect(parsed.success).toBe(true)
  })

  test("no groups is an error the card shows, not an empty card", () => {
    const data = toUsageData({ status: "SUCCESS", response: "Sign in required", command: { data: { groups: [] } } })
    expect(data).toMatchObject({ ok: false, configured: true, usage: null })
    expect(data.error).toContain("Sign in required")
  })

  test("runs agy and reports a missing binary or bad output", async () => {
    const dir = mkdtempSync(path.join(process.env.TMPDIR || os.tmpdir(), "agy-quota-"))
    try {
      const fake = path.join(dir, "agy")
      writeFileSync(fake, `#!/bin/sh\n[ "$1 $2" = "-p /quota" ] || exit 9\ncat <<'EOF'\n${JSON.stringify(recorded)}\nEOF\n`)
      chmodSync(fake, 0o755)
      expect((await runAgyQuota(fake, dir)).ok).toBe(true)

      writeFileSync(fake, "#!/bin/sh\necho 'boom' >&2\nexit 1\n")
      const bad = await runAgyQuota(fake, dir)
      expect(bad).toMatchObject({ ok: false, configured: true })
      expect(bad.error).toContain("boom")

      const missing = await runAgyQuota(path.join(dir, "nope"), dir)
      expect(missing.error).toContain("agy was not found")
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })
})
