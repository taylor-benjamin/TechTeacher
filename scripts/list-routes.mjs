// Prints every route in the app, one per line (used by scripts/smoke.ps1).
import { readFileSync, readdirSync } from 'node:fs'

const root = new URL('../src/content/', import.meta.url)
const routes = ['', 'paths', 'glossary']
for (const tab of JSON.parse(readFileSync(new URL('tabs.json', root), 'utf8'))) {
  routes.push(tab.id)
  for (const file of readdirSync(new URL(`modules/${tab.id}/`, root)).sort()) {
    const mod = JSON.parse(readFileSync(new URL(`modules/${tab.id}/${file}`, root), 'utf8'))
    for (const l of mod.lessons) routes.push(`${tab.id}/${mod.id}/${l.id}`)
  }
}
console.log(routes.join('\n'))
