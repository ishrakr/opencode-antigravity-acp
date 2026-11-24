import { describe, expect, test } from "bun:test"
import { antigravityModelOf, groupMatchesModel, quotaSummary, shortGroupName, toGroupViews, toneFor } from "../src/view.ts"
import { toUsageData } from "../src/quota.ts"

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

describe("which sessions show the quota", () => {
  test("only models from the Antigravity provider", () => {
    expect(antigravityModelOf("antigravity-acp/gemini-4-neon")).toBe("gemini-4-neon")
    expect(antigravityModelOf("antigravity-acp/claude-opus-5-5")).toBe("claude-opus-5-5")
    expect(antigravityModelOf("fs-cortex/claude-opus-latest")).toBeNull()
    expect(antigravityModelOf("google/gemini-3-pro")).toBeNull()
    expect(antigravityModelOf(undefined)).toBeNull()
    expect(antigravityModelOf("antigravity-acp")).toBeNull()
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

  test("the session's group comes first, with remaining percent, 5-hour before weekly", () => {
    const views = toGroupViews(usage, "claude-opus-5-5")
    expect(views.map((v) => [v.name, v.current])).toEqual([
      ["Claude & GPT", true],
      ["Gemini", false],
    ])
    expect(views[0].windows.map((w) => [w.label, w.remaining, w.tone])).toEqual([
      ["5-hour", 100, "success"],
      ["Weekly", 42, "warning"],
    ])
    expect(toGroupViews(usage, "gemini-4-neon")[0].name).toBe("Gemini")
  })

  test("tones", () => {
    expect(toneFor(null)).toBe("muted")
    expect(toneFor(10)).toBe("error")
    expect(toneFor(49)).toBe("warning")
    expect(toneFor(50)).toBe("success")
  })
})

describe("/agy-quota summary", () => {
  const now = Date.parse("2026-11-23T20:00:00Z")

  test("lists every group with what is left and when it refills", () => {
    const text = quotaSummary(usage, now, null, "en-US")
    const lines = text.split("\n")
    expect(lines[0]).toBe("Antigravity quota")
    expect(lines[1]).toStartWith("Gemini: 5-hour 94% left, refills ")
    expect(lines[1]).toContain("Weekly 97% left, refills ")
    expect(lines[2]).toStartWith("Claude & GPT: 5-hour 100% left")
    expect(lines[2]).toContain("Weekly 42% left")
    expect(text).not.toContain("this session")
    expect(text.length).toBeLessThanOrEqual(500)
  })

  test("puts the session's group first and marks it", () => {
    const lines = quotaSummary(usage, now, "claude-opus-5-5", "en-US").split("\n")
    expect(lines[1]).toStartWith("Claude & GPT (this session): ")
    expect(lines[2]).toStartWith("Gemini: ")
  })

  test("omits refill times that have passed", () => {
    const later = Date.parse("2026-12-01T00:00:00Z")
    expect(quotaSummary(usage, later, null, "en-US")).not.toContain("refills")
  })

  test("shows agy's error", () => {
    expect(quotaSummary({ ok: false, configured: true, error: "agy was not found", usage: null }, now)).toBe("agy was not found")
  })
})
