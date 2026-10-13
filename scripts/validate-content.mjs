// Checks every lesson JSON file against the lesson format. Run: npm run validate
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const root = new URL('../src/content/', import.meta.url)
const read = (p) => JSON.parse(readFileSync(new URL(p, root), 'utf8'))

const VISUALS = { flow: ['nodes'], layers: ['layers'], sequence: ['actors', 'messages'], compare: ['columns', 'rows'], cards: ['items'] }
const INTERACTIVES = ['quiz', 'order', 'code', 'api-tester', 'neural-net', 'tokenizer', 'subnet', 'topology', 'hash', 'cipher', 'packets', 'contrast']
const LEVELS = ['beginner', 'intermediate', 'advanced']

const errors = []
const keys = new Set()
const tabs = read('tabs.json').map((t) => t.id)
let count = 0

for (const tab of readdirSync(new URL('modules/', root))) {
  for (const file of readdirSync(new URL(`modules/${tab}/`, root))) {
    const where = join(tab, file)
    let mod
    try {
      mod = read(`modules/${tab}/${file}`)
    } catch (e) {
      errors.push(`${where}: invalid JSON: ${e.message}`)
      continue
    }
    const err = (lesson, msg) => errors.push(`${where} > ${lesson}: ${msg}`)
    if (mod.tab !== tab || !tabs.includes(mod.tab)) err('(module)', `"tab" must match its folder and exist in tabs.json`)
    for (const f of ['id', 'title', 'summary', 'order']) if (mod[f] == null) err('(module)', `missing "${f}"`)
    for (const l of mod.lessons ?? []) {
      count++
      const key = `${mod.tab}/${mod.id}/${l.id}`
      if (keys.has(key)) err(l.id, 'duplicate lesson id')
      keys.add(key)
      if (!l.title || !l.minutes) err(l.id, 'missing title or minutes')
      if (!LEVELS.includes(l.level)) err(l.id, `level must be one of ${LEVELS.join(', ')}`)
      if (!l.concept?.text || !l.concept?.analogy) err(l.id, 'concept needs text and analogy')
      const need = VISUALS[l.visual?.type]
      if (!need) err(l.id, `unknown visual type "${l.visual?.type}"`)
      else for (const f of need) if (!Array.isArray(l.visual[f])) err(l.id, `visual.${f} must be an array`)
      if (l.visual?.type === 'compare' && l.visual.rows.some((r) => r.length !== l.visual.columns.length + 1))
        err(l.id, 'each compare row needs a label plus one cell per column')
      if (!Array.isArray(l.steps) || l.steps.length < 2 || l.steps.some((s) => !s.title || !s.text)) err(l.id, 'needs 2+ steps, each with title and text')
      if (!INTERACTIVES.includes(l.interactive?.type)) err(l.id, `unknown interactive type "${l.interactive?.type}"`)
      if (l.interactive?.type === 'quiz')
        for (const q of l.interactive.questions ?? [{}]) if (!q.q || !(q.answer >= 0 && q.answer < q.options?.length)) err(l.id, `bad quiz question "${q.q}"`)
      if (!l.challenge?.prompt || !l.challenge?.hint || !l.challenge?.solution) err(l.id, 'challenge needs prompt, hint and solution')
      if (!Array.isArray(l.takeaways) || l.takeaways.length < 2) err(l.id, 'needs 2+ takeaways')
    }
  }
}

for (const p of read('paths.json'))
  for (const k of p.lessons) if (!keys.has(k)) errors.push(`paths.json > ${p.id}: unknown lesson "${k}"`)

if (errors.length) {
  console.error(errors.join('\n'))
  console.error(`\n${errors.length} problem(s) found.`)
  process.exit(1)
}
console.log(`OK: ${count} lessons valid.`)
