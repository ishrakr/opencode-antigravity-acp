import { describe, expect, test } from "bun:test"
import { antigravityModelOf, groupMatchesModel, shortGroupName, toGroupViews, toneFor } from "../src/view.ts"
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
