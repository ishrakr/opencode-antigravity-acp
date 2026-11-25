import { Rpc } from "@opencode/plugin/rpc"

export type AcpMode = "auto" | "accept-edits" | "default" | "plan"

export interface AcpSessionState {
  readonly sessionID: string
  readonly mode: AcpMode
  /** The selected sign-in method's label, such as "Google account". */
  readonly authMethod: string
  readonly starting: boolean
  readonly acpSessionId: string | null
  readonly connected: boolean
  readonly busy: boolean
  readonly modelCount: number
  readonly lastError: string | null
  readonly cooldownUntil: number | null
  /** The account's name; "Main" for your normal agy login. */
  readonly account: string
}

// providerID picks the account; the main account when omitted.
const sessionIdSchema = {
  type: "object",
  properties: {
    sessionID: { type: "string" },
    providerID: { type: "string" },
  },
  required: ["sessionID"],
  additionalProperties: false,
} as const

const stateSchema = {
  type: "object",
  properties: {
    sessionID: { type: "string" },
    mode: { type: "string", enum: ["auto", "accept-edits", "default", "plan"] },
    authMethod: { type: "string" },
    starting: { type: "boolean" },
    acpSessionId: { anyOf: [{ type: "string" }, { type: "null" }] },
    connected: { type: "boolean" },
    busy: { type: "boolean" },
    modelCount: { type: "number" },
    lastError: { anyOf: [{ type: "string" }, { type: "null" }] },
    cooldownUntil: { anyOf: [{ type: "number" }, { type: "null" }] },
    account: { type: "string" },
  },
  required: [
    "sessionID",
    "mode",
    "authMethod",
    "starting",
    "acpSessionId",
    "connected",
    "busy",
    "modelCount",
    "lastError",
    "cooldownUntil",
    "account",
  ],
  additionalProperties: false,
} as const

export const AcpRpc = Rpc.define({
  id: "antigravity-acp",
  methods: {
    getState: {
      input: sessionIdSchema,
      output: stateSchema,
    },
    setMode: {
      input: {
        type: "object",
        properties: {
          sessionID: { type: "string" },
          providerID: { type: "string" },
          mode: { type: "string", enum: ["auto", "accept-edits", "default", "plan"] },
        },
        required: ["sessionID", "mode"],
        additionalProperties: false,
      },
      output: stateSchema,
    },
    resetSession: {
      input: sessionIdSchema,
      output: stateSchema,
    },
    warmSession: {
      input: {
        type: "object",
        properties: {
          sessionID: { type: "string" },
          providerID: { type: "string" },
        },
        additionalProperties: false,
      },
      output: stateSchema,
    },
    reloadModels: {
      input: {
        type: "object",
        properties: {
          providerID: { type: "string" },
        },
        additionalProperties: false,
      },
      output: {
        type: "object",
        properties: {
          modelCount: { type: "number" },
        },
        required: ["modelCount"],
        additionalProperties: false,
      },
    },
  },
  events: {},
})
