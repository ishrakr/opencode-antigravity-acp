// `agy-accounts`: add and sign in extra Antigravity accounts for the OpenCode
// plugin. Each account gets its own private folder and its own Google sign-in;
// OpenCode shows it as its own provider, such as "Antigravity (Work)".
import { spawn } from "node:child_process"
import fs from "node:fs"
import readline from "node:readline/promises"
import { resolveAgyBinary } from "./acp-client.js"
import {
  ACCOUNT_APP_DATA_DIR,
  accountAgyEnv,
  accountHome,
  accountProviderID,
  findAccount,
  hasSavedLogin,
  newAccountId,
  prepareAccountHome,
  readAccounts,
  registryPath,
  savedLoginFiles,
  validateAccountName,
  writeAccounts,
  type AntigravityAccount,
} from "./accounts.js"

const USAGE = `Usage: agy-accounts <command>

  list                   Accounts, their OpenCode provider and whether they are signed in
  add <name>             Add an account, such as "Work", and sign it in
  login <name>           Sign the account in again (or into another Google account)
  logout <name>          Delete the account's saved Google login
  rename <name> <new>    Change the name OpenCode shows
  remove <name> [--yes]  Remove the account and delete its folder

Your normal agy login stays the "Antigravity (ACP)" provider. Each account here
adds a provider such as "Antigravity (Work)" with the same models; pick its
models to use that account in a session. Nothing switches accounts on its own.
Restart OpenCode after adding, renaming or removing an account.`

class CliError extends Error {}

function need(accounts: readonly AntigravityAccount[], query: string | undefined): AntigravityAccount {
  if (!query) throw new CliError("Name the account.")
  const account = findAccount(accounts, query)
  if (!account) {
    const names = accounts.map((a) => `"${a.name}"`).join(", ")
    throw new CliError(`No account "${query}". ${names ? `Accounts: ${names}.` : "Add one with: agy-accounts add <name>"}`)
  }
  return account
}

/** agy's own sign-in: it prints a Google link and reads back the code you paste. */
function runLogin(account: AntigravityAccount): Promise<boolean> {
  const home = prepareAccountHome(account.id)
  const binary = resolveAgyBinary()
  console.log(`Signing in "${account.name}". Open the link agy prints, sign in with the Google account for "${account.name}", then paste the code here.\n`)
  return new Promise((resolve) => {
    const child = spawn(
      binary,
      ["acp", "--gemini_dir", home, "--app_data_dir", ACCOUNT_APP_DATA_DIR, "--login"],
      { cwd: home, env: accountAgyEnv(home), stdio: "inherit" },
    )
    child.on("error", (err) => {
      console.error(`Could not start agy (${binary}): ${err.message}. Install the Antigravity CLI or set AGY_BIN.`)
      resolve(false)
    })
    child.on("exit", (code) => resolve(code === 0 && hasSavedLogin(home)))
  })
}

async function confirm(question: string): Promise<string> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
  try {
    return (await rl.question(question)).trim()
  } finally {
    rl.close()
  }
}

async function main(argv: readonly string[]): Promise<number> {
  const [command, ...rest] = argv
  const flags = new Set(rest.filter((a) => a.startsWith("--")))
  const args = rest.filter((a) => !a.startsWith("--"))
  const accounts = readAccounts()

  switch (command) {
    case "list":
    case "ls":
    case undefined: {
      if (command === undefined) console.log(`${USAGE}\n`)
      const rows = [
        ["Main", "antigravity-acp", "your normal agy login (~/.gemini)"],
        ...accounts.map((a) => [
          a.name,
          accountProviderID(a.id),
          hasSavedLogin(accountHome(a.id)) ? "signed in" : "not signed in",
        ]),
      ]
      const widths = [0, 1].map((i) => Math.max(...rows.map((r) => r[i].length)))
      for (const r of rows) console.log(`${r[0].padEnd(widths[0])}  ${r[1].padEnd(widths[1])}  ${r[2]}`)
      if (accounts.length === 0) console.log("\nNo extra accounts yet. Add one with: agy-accounts add <name>")
      return 0
    }
    case "add": {
      const name = validateAccountName(args.join(" "))
      if (findAccount(accounts, name)) throw new CliError(`An account named "${name}" already exists.`)
      const account: AntigravityAccount = {
        id: newAccountId(name, accounts.map((a) => a.id)),
        name,
        createdAt: Date.now(),
      }
      prepareAccountHome(account.id)
      writeAccounts([...accounts, account])
      console.log(`Added "${name}" as the OpenCode provider "Antigravity (${name})" (${accountProviderID(account.id)}).`)
      const ok = await runLogin(account)
      console.log(
        ok
          ? `\n"${name}" is signed in. Restart OpenCode, then pick a model under "Antigravity (${name})".`
          : `\n"${name}" is not signed in yet. Run: agy-accounts login "${name}"`,
      )
      return ok ? 0 : 1
    }
    case "login": {
      const account = need(accounts, args.join(" "))
      const ok = await runLogin(account)
      console.log(ok ? `\n"${account.name}" is signed in.` : `\n"${account.name}" is not signed in.`)
      return ok ? 0 : 1
    }
    case "logout": {
      const account = need(accounts, args.join(" "))
      const files = savedLoginFiles(accountHome(account.id))
      for (const file of files) fs.rmSync(file, { force: true })
      console.log(files.length > 0 ? `Signed out "${account.name}".` : `"${account.name}" had no saved login.`)
      console.log("Sessions already running on it stop working once OpenCode restarts.")
      return 0
    }
    case "rename": {
      if (args.length !== 2) throw new CliError('Usage: agy-accounts rename <name> <new name> (quote names with spaces)')
      const account = need(accounts, args[0])
      const name = validateAccountName(args[1])
      const clash = findAccount(accounts, name)
      if (clash && clash.id !== account.id) throw new CliError(`An account named "${name}" already exists.`)
      writeAccounts(accounts.map((a) => (a.id === account.id ? { ...a, name } : a)))
      console.log(`Renamed "${account.name}" to "${name}". Its provider stays ${accountProviderID(account.id)}; restart OpenCode to see the new name.`)
      return 0
    }
    case "remove":
    case "rm": {
      const account = need(accounts, args.join(" "))
      if (!flags.has("--yes")) {
        if (!process.stdin.isTTY) throw new CliError("Add --yes to remove an account without a prompt.")
        const answer = await confirm(
          `Remove "${account.name}"? This deletes its folder: its Google login and Antigravity's conversations for it.\nType the account name to confirm: `,
        )
        if (answer.toLowerCase() !== account.name.toLowerCase()) {
          console.log("Nothing removed.")
          return 1
        }
      }
      writeAccounts(accounts.filter((a) => a.id !== account.id))
      fs.rmSync(accountHome(account.id), { recursive: true, force: true })
      console.log(`Removed "${account.name}". Restart OpenCode; sessions that used it stay readable but can't continue.`)
      return 0
    }
    case "help":
    case "--help":
    case "-h":
      console.log(USAGE)
      return 0
    default:
      throw new CliError(`Unknown command "${command}".\n\n${USAGE}`)
  }
}

main(process.argv.slice(2)).then(
  (code) => process.exit(code),
  (err) => {
    console.error(err instanceof Error ? err.message : String(err))
    if (!(err instanceof CliError)) console.error(`Accounts file: ${registryPath()}`)
    process.exit(1)
  },
)
