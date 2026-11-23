import type { AcpElicitationRequestParams, AcpPermissionRequestParams } from "./acp-client.js"

/**
 * Bridges Antigravity questions (`ask_question`) to OpenCode's native
 * `question` tool. Answers follow OpenCode's semantics: a single choice is
 * either one option or typed text, and a multiple choice is the selected
 * options plus optional typed text.
 */

/** Input shape of one entry in OpenCode's `question` tool. */
export interface OpenCodeQuestion {
  readonly question: string
  readonly header: string
  readonly options: ReadonlyArray<{ readonly label: string; readonly description: string }>
  readonly multiple?: boolean
}

export interface BridgedQuestions {
  readonly questions: readonly OpenCodeQuestion[]
  /**
   * Maps answers (labels or typed text, per question) back to elicitation
   * content. Returns `undefined` when nothing was answered, so the caller can
   * cancel instead of sending agy a schema-violating empty payload.
   */
  readonly respond: (answers: ReadonlyArray<readonly string[] | undefined>) => AcpElicitationContent | undefined
}

export type AcpElicitationContent = Record<string, string | string[]>

interface Choice {
  readonly label: string
  readonly value: string
}

interface QuestionPlan {
  readonly question: string
  /** `qN`: the selected option ID(s). Absent for free-form questions. */
  readonly choiceKey?: string
  /** `qN_other`: typed text. */
  readonly textKey?: string
  readonly choices: readonly Choice[]
  readonly multiple: boolean
}

/** agy names questions `qN` (choices) and `qN_other` (typed text). */
const QUESTION_KEY = /^q(\d+)(_other)?$/

function asRecord(value: unknown): Record<string, any> | undefined {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, any>) : undefined
}

function nonEmpty(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined
}

function readChoices(schema: Record<string, any> | undefined): Choice[] | undefined {
  const variants = Array.isArray(schema?.oneOf) ? schema.oneOf : Array.isArray(schema?.anyOf) ? schema.anyOf : undefined
  if (!variants || variants.length === 0) return undefined
  // Labels are the answer identity in OpenCode, so they must be unique.
  const seen = new Set<string>()
  const choices: Choice[] = []
  for (const variant of variants) {
    const value = asRecord(variant)?.const
    if (typeof value !== "string") return undefined
    const label = nonEmpty(variant.title) ?? value
    let unique = label
    for (let n = 2; seen.has(unique); n++) unique = `${label} (${n})`
    seen.add(unique)
    choices.push({ label: unique, value })
  }
  return choices
}

function planQuestion(n: number, choice?: Record<string, any>, other?: Record<string, any>): QuestionPlan | undefined {
  const textKey = other?.type === "string" ? `q${n}_other` : undefined
  if (!choice) {
    return textKey ? { question: nonEmpty(other!.title) ?? textKey, textKey, choices: [], multiple: false } : undefined
  }
  const multiple = choice.type === "array"
  if (!multiple && choice.type !== "string") return undefined
  const choices = readChoices(multiple ? asRecord(choice.items) : choice)
  if (!choices) return undefined
  return { question: nonEmpty(choice.title) ?? `q${n}`, choiceKey: `q${n}`, textKey, choices, multiple }
}

/**
 * Converts the form `agy acp` sends for `ask_question` into OpenCode
 * questions. Returns `undefined` for any other form.
 */
export function elicitationToQuestions(params: AcpElicitationRequestParams): BridgedQuestions | undefined {
  if (params.mode !== undefined && params.mode !== "form") return undefined
  const properties = asRecord(asRecord(params.requestedSchema)?.properties)
  if (!properties) return undefined

  const fields = new Map<number, { choice?: Record<string, any>; other?: Record<string, any> }>()
  for (const [key, value] of Object.entries(properties)) {
    const match = QUESTION_KEY.exec(key)
    const field = asRecord(value)
    // Ignore unrelated metadata fields instead of declining the whole form.
    if (!match || !field) continue
    const entry = fields.get(Number(match[1])) ?? {}
    entry[match[2] ? "other" : "choice"] = field
    fields.set(Number(match[1]), entry)
  }
  // agy serializes `q10` before `q2`; restore numeric order.
  const plans: QuestionPlan[] = []
  for (const [n, { choice, other }] of [...fields].sort(([a], [b]) => a - b)) {
    const plan = planQuestion(n, choice, other)
    if (!plan) return undefined
    plans.push(plan)
  }
  if (plans.length === 0) return undefined

  return {
    questions: plans.map((plan, index) => ({
      header: plans.length > 1 ? `Question ${index + 1}` : "Question",
      question: plan.question,
      options: plan.choices.map((c) => ({ label: c.label, description: "" })),
      ...(plan.multiple ? { multiple: true } : {}),
    })),
    respond: (answers) => {
      const content: AcpElicitationContent = {}
      let answered = false
      plans.forEach((plan, index) => {
        const values: string[] = []
        const typed: string[] = []
        for (const entry of answers[index] ?? []) {
          const choice = plan.choices.find((c) => c.label === entry)
          if (choice) values.push(choice.value)
          else if (entry.trim()) typed.push(entry)
        }
        if (plan.choiceKey && values.length > 0) {
          content[plan.choiceKey] = plan.multiple ? values : values[0]
          answered = true
        }
        if (plan.textKey && typed.length > 0) {
          content[plan.textKey] = typed.join(", ")
          answered = true
        }
      })
      // Nothing answered (dismissed or empty form): cancel, don't accept {}.
      return answered ? content : undefined
    },
  }
}

/**
 * agy sends some native questions through `session/request_permission`
 * with a tool call ID starting `interaction_`; their options are answers.
 */
export function isAcpUserInputRequest(params: AcpPermissionRequestParams): boolean {
  return String(params.toolCall?.toolCallId ?? "").startsWith("interaction_")
}

export interface BridgedChoiceQuestion {
  readonly question: OpenCodeQuestion
  /** The optionId for the chosen label, or `undefined` when unanswered. */
  readonly respond: (answer: readonly string[] | undefined) => string | undefined
}

/** Converts a native choice question into one single-choice OpenCode question. */
export function permissionToQuestion(params: AcpPermissionRequestParams): BridgedChoiceQuestion | undefined {
  const options = params.options ?? []
  if (options.length === 0) return undefined
  const seen = new Set<string>()
  const choices: Choice[] = []
  for (const option of options) {
    const id = option.optionId?.trim()
    if (!id || choices.some((c) => c.value === option.optionId)) return undefined
    const label = nonEmpty(option.name) ?? id
    let unique = label
    for (let n = 2; seen.has(unique); n++) unique = `${label} (${n})`
    seen.add(unique)
    choices.push({ label: unique, value: option.optionId })
  }
  return {
    question: {
      header: "Question",
      question: nonEmpty(params.toolCall?.title) ?? "Choose an option.",
      options: choices.map((c) => ({ label: c.label, description: "" })),
    },
    respond: (answer) => {
      for (const entry of answer ?? []) {
        const choice = choices.find((c) => c.label === entry)
        if (choice) return choice.value
      }
      return undefined
    },
  }
}

const ANSWER_PREFIX = "User has answered your questions: "
const ANSWER_SUFFIX = ". You can now continue with the user's answers in mind."
const UNANSWERED = "Unanswered"

function dequote(value: string): string {
  return value.replace(/\\"/g, '"').replace(/^"/, "").replace(/"$/, "")
}

/**
 * Matches the `"<question>"="` head of one answer. Falls back to matching the
 * dequoted label when the question text itself contains quotes.
 */
function matchHead(body: string, position: number, question: string): number | undefined {
  const strict = `"${question}"="`
  if (body.startsWith(strict, position)) return position + strict.length
  const marker = body.indexOf('="', position)
  if (marker < 0) return undefined
  if (dequote(body.slice(position, marker + 1)) !== question) return undefined
  return marker + 2
}

/** Finds the `", "<next question>"="` separator, tolerating quotes in titles. */
function findSeparator(body: string, from: number, nextQuestion: string): number | undefined {
  const exact = body.indexOf(`", "${nextQuestion}"="`, from)
  if (exact >= 0) return exact
  let at = body.indexOf('", "', from)
  while (at >= 0) {
    const marker = body.indexOf('="', at + 3)
    if (marker < 0) return undefined
    if (dequote(body.slice(at + 3, marker + 1)) === nextQuestion) return at
    at = body.indexOf('", "', at + 1)
  }
  return undefined
}

/**
 * Parses the model-facing text of OpenCode's `question` tool:
 * `User has answered your questions: "Q1"="a, b", "Q2"="c". You can now ...`.
 * Uses the known questions and option labels to split the joined answers.
 * Returns `undefined` per question when that question's answers cannot be read.
 */
export function parseQuestionToolAnswers(
  text: string,
  questions: readonly OpenCodeQuestion[],
): Array<string[] | undefined> | undefined {
  if (!text.startsWith(ANSWER_PREFIX) || !text.endsWith(ANSWER_SUFFIX)) return undefined
  const body = text.slice(ANSWER_PREFIX.length, text.length - ANSWER_SUFFIX.length)
  const answers: Array<string[] | undefined> = []
  let position = 0
  for (let i = 0; i < questions.length; i++) {
    const head = matchHead(body, position, questions[i].question)
    if (head === undefined) return undefined
    position = head
    let raw: string
    if (i + 1 < questions.length) {
      const end = findSeparator(body, position, questions[i + 1].question)
      if (end === undefined) return undefined
      raw = body.slice(position, end)
      position = end + 3
    } else {
      if (!body.endsWith('"') || body.length - 1 < position) return undefined
      raw = body.slice(position, body.length - 1)
    }
    answers.push(splitAnswer(raw, questions[i]))
  }
  return answers
}

function splitAnswer(raw: string, question: OpenCodeQuestion): string[] {
  const labels = new Set(question.options.map((o) => o.label))
  if (labels.has(raw)) return [raw]
  if (raw === UNANSWERED || !raw) return []
  if (!question.multiple) return [raw]

  // OpenCode joins multiple answers with ", ". Rebuild known labels greedily
  // (labels may contain ", " themselves) and keep the rest as typed text.
  const tokens = raw.split(", ")
  const result: string[] = []
  let typed: string[] = []
  for (let i = 0; i < tokens.length; ) {
    let matched = 0
    for (let j = tokens.length; j > i; j--) {
      if (labels.has(tokens.slice(i, j).join(", "))) {
        matched = j - i
        break
      }
    }
    if (matched === 0) {
      typed.push(tokens[i++])
      continue
    }
    if (typed.length > 0) result.push(typed.join(", "))
    typed = []
    result.push(tokens.slice(i, i + matched).join(", "))
    i += matched
  }
  if (typed.length > 0) result.push(typed.join(", "))
  return result
}
