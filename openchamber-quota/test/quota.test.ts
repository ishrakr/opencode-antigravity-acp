import { describe, expect, test } from "bun:test"
import { chmodSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
import os from "node:os"
import path from "node:path"
import { quotaProviderSchemasV1 } from "@openchamber/sdk/schemas"
import { readAllQuotas, runAgyQuota, toUsageData, type AgyQuotaOutput } from "../src/quota.ts"

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

describe("every account", () => {
  test("reads each signed-in account from its own folder and skips signed-out ones", async () => {
    const dir = mkdtempSync(path.join(process.env.TMPDIR || os.tmpdir(), "agy-quota-accounts-"))
    try {
      const state = path.join(dir, "state")
      const env = { ...process.env, ANTIGRAVITY_ACP_STATE_DIR: state }
      const { writeAccounts, prepareAccountHome, accountHome, readAccounts } = await import("../../src/accounts.ts")
      writeAccounts(
        [
          { id: "work", name: "Work", createdAt: 1 },
          { id: "spare", name: "Spare", createdAt: 2 },
        ],
        env,
      )
      prepareAccountHome("work", env)
      prepareAccountHome("spare", env)
      writeFileSync(path.join(accountHome("work", env), "antigravity-acp", "antigravity-oauth-token"), "x")
      const log = path.join(dir, "calls.log")
      const fake = path.join(dir, "agy")
      // Logs each run's account flags and environment, and answers the recorded quota.
      writeFileSync(
        fake,
        `#!/bin/sh\necho "$* | home=\${GEMINI_HOME:-none} file=\${AGY_ACP_FORCE_FILE_STORAGE:-none}" >> ${log}\ncat <<'EOF'\n${JSON.stringify(recorded)}\nEOF\n`,
      )
      chmodSync(fake, 0o755)
      const result = await readAllQuotas(fake, dir, env)
      expect(result.accounts.map((a) => [a.id, a.name, a.data.ok])).toEqual([
        ["main", "Main", true],
        ["work", "Work", true],
        ["spare", "Spare", false],
      ])
      expect(result.accounts[2].data.error).toContain('agy-accounts login "Spare"')
      const calls = (await Bun.file(log).text()).trim().split("\n").sort()
      expect(calls).toHaveLength(2)
      const workHome = accountHome("work", env)
      expect(calls).toContain(`-p /quota --output-format json | home=none file=none`)
      expect(calls).toContain(
        `-p /quota --output-format json --gemini_dir ${workHome} --app_data_dir antigravity-acp | home=${workHome} file=1`,
      )

      // With the main account turned off, only the extra accounts are read.
      writeAccounts(readAccounts(env), env, false)
      const without = await readAllQuotas(fake, dir, env)
      expect(without.accounts.map((a) => a.id)).toEqual(["work", "spare"])
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })
})
