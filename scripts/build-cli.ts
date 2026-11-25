// Builds the committed `bin/agy-accounts.js`: plain Node, no install step.
import { chmod, writeFile } from "node:fs/promises"
import { resolve } from "node:path"

const result = await Bun.build({ entrypoints: [resolve("src/cli.ts")], target: "node", format: "esm" })
const artifact = result.outputs[0]
if (!result.success || !artifact) {
  console.error(result.logs.map((log) => log.message).join("\n") || "Build failed")
  process.exit(1)
}
const out = resolve("bin/agy-accounts.js")
await writeFile(out, `#!/usr/bin/env node\n${await artifact.text()}`)
await chmod(out, 0o755)
console.log(`bin/agy-accounts.js  ${(artifact.size / 1024).toFixed(1)} KB`)
