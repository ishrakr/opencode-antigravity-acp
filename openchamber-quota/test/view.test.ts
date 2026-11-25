import { describe, expect, test } from "bun:test"
import {
  antigravityTargetOf,
  groupMatchesModel,
  readAccountsQuota,
  shortGroupName,
  toAccountViews,
  toGroupViews,
  toneFor,
} from "../src/view.ts"
import { failure, toUsageData, type AccountsQuota } from "../src/quota.ts"

const usage = toUsageData({
  status: "SUCCESS",
  command: {
    data: {
      groups: [
        {
          name: "Gemini Models",
          buckets: [
            { id: "gemini-weekly", window: "weekly", remaining_fraction: 0.97, reset_time: "2026-11-30T20:03:03Z" },
            { id: "gemini-5h", window: "5h", remaining_fraction: 0.94, reset_time: "2026-11-24T01:03:03Z" },
          ],
        },
        {
          name: "Claude and GPT models",
          buckets: [
            { id: "3p-weekly", window: "weekly", remaining_fraction: 0.42, reset_time: "2026-11-28T19:05:11Z" },
            { id: "3p-5h", window: "5h", remaining_fraction: 1, reset_time: "2026-11-24T02:13:05Z" },
          ],
        },
      ],
    },
  },
})

const main = (data = usage): AccountsQuota => ({ accounts: [{ id: "main", name: "Main", data }] })

describe("which sessions are Antigravity's", () => {
  test("the main provider and each account's provider", () => {
    expect(antigravityTargetOf("antigravity-acp/gemini-4-neon")).toEqual({ account: "main", modelId: "gemini-4-neon" })
    expect(antigravityTargetOf("antigravity-acp-work/claude-opus-5-5")).toEqual({ account: "work", modelId: "claude-opus-5-5" })
    expect(antigravityTargetOf("fs-cortex/claude-opus-latest")).toBeNull()
    expect(antigravityTargetOf("google/gemini-3-pro")).toBeNull()
    expect(antigravityTargetOf(undefined)).toBeNull()
    expect(antigravityTargetOf("antigravity-acp")).toBeNull()
    expect(antigravityTargetOf("antigravity-acp-/gemini")).toBeNull()
  })
})

describe("group views", () => {
  test("Gemini models use the Gemini group, everything else the other one", () => {
    expect(groupMatchesModel("Gemini Models", "gemini-3.8-flash")).toBe(true)
    expect(groupMatchesModel("Claude and GPT models", "gemini-3.8-flash")).toBe(false)
    expect(groupMatchesModel("Claude and GPT models", "gpt-oss-120b-medium")).toBe(true)
    expect(groupMatchesModel("Claude and GPT models", "claude-sonnet-5-5")).toBe(true)
  })

  test("short names", () => {
    expect(shortGroupName("Gemini Models")).toBe("Gemini")
    expect(shortGroupName("Claude and GPT models")).toBe("Claude & GPT")
  })

  test("groups keep agy's order with the session's marked, 5-hour before weekly", () => {
    const views = toGroupViews(usage, "claude-opus-5-5")
    expect(views.map((v) => [v.name, v.current])).toEqual([
      ["Gemini", false],
      ["Claude & GPT", true],
    ])
    expect(views[1].windows.map((w) => [w.label, w.remaining, w.tone])).toEqual([
      ["5-hour", 100, "success"],
      ["Weekly", 42, "warning"],
    ])
    expect(toGroupViews(usage, "gemini-4-neon").map((g) => g.name)).toEqual(["Gemini", "Claude & GPT"])
    // Outside Antigravity sessions every group shows, none marked.
    const plain = toGroupViews(usage)
    expect(plain.map((g) => g.name)).toEqual(["Gemini", "Claude & GPT"])
    expect(plain.some((g) => g.current)).toBe(false)
  })

  test("tones", () => {
    expect(toneFor(null)).toBe("muted")
    expect(toneFor(10)).toBe("error")
    expect(toneFor(49)).toBe("warning")
    expect(toneFor(50)).toBe("success")
  })
})

describe("refill times", () => {
  test("a window agy has not started has no refill time", () => {
    const unused = toUsageData({
      status: "SUCCESS",
      command: { data: { groups: [{ name: "Claude and GPT models", buckets: [{ id: "3p-5h", window: "5h", remaining_fraction: 1, reset_time: "1970-01-01T00:00:00Z" }] }] } },
    })
    expect(unused.usage?.models?.["Claude and GPT models"]?.windows["5h"]?.resetAt).toBeNull()
    const zero = { ok: true, configured: true, usage: { windows: {}, models: { "Claude and GPT models": { windows: { "5h": { usedPercent: 0, windowSeconds: 18000, resetAt: 0 } } } } } } as const
    expect(toGroupViews(zero as any)[0].windows[0].resetAt).toBeNull()
  })
})

describe("several accounts", () => {
  const now = Date.parse("2026-11-23T20:00:00Z")
  const quota: AccountsQuota = {
    accounts: [
      { id: "main", name: "Main", data: usage },
      { id: "work", name: "Work", data: usage },
      { id: "spare", name: "Spare", data: failure('Not signed in. Run: agy-accounts login "Spare"') },
    ],
  }

  test("every account shows in the order added, the session's account and group marked", () => {
    const views = toAccountViews(quota, { account: "work", modelId: "gemini-4-neon" })
    expect(views.map((v) => [v.name, v.current])).toEqual([
      ["Main", false],
      ["Work", true],
      ["Spare", false],
    ])
    expect(views[1].groups[0]).toMatchObject({ name: "Gemini", current: true })
    // The same model on another account is not this session's quota.
    expect(views[0].groups.some((g) => g.current)).toBe(false)
    expect(views[2].error).toContain("agy-accounts login")
  })

  test("outside Antigravity sessions nothing is marked, in the order added", () => {
    const views = toAccountViews(quota)
    expect(views.map((v) => v.name)).toEqual(["Main", "Work", "Spare"])
    expect(views.some((v) => v.current)).toBe(false)
  })

  test("an older service's single-account answer still reads", () => {
    expect(readAccountsQuota(usage)).toEqual(main())
    expect(readAccountsQuota(quota)).toEqual(quota)
  })
})
