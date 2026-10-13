// Runs every Bash snippet in the lesson content through the simulated shell
// and prints the output, so you can check lessons still work after editing either.
import { readFileSync } from 'node:fs'
import { runBash } from '../src/interactive/bashSim.js'

const mod = JSON.parse(readFileSync(new URL('../src/content/modules/software/09-bash.json', import.meta.url), 'utf8'))
let errors = 0
for (const l of mod.lessons) {
  const snippets = [l.interactive.starter, l.challenge.language === 'bash' ? l.challenge.solution : null].filter(Boolean)
  for (const code of snippets) {
    console.log(`\n=== ${l.id} ===`)
    for (const o of runBash(code)) {
      if (o.kind === 'err') errors++
      console.log(o.kind === 'err' ? `[ERR] ${o.text}` : o.text)
    }
  }
}
console.log(`\n${errors} error line(s).`)
process.exit(errors ? 1 : 0)
