// Spanish content overlays live in src/content/es/ and hold only the human-readable strings.
// Code, ids and numbers always come from the English files.
//   node scripts/i18n-content.mjs extract <dir>   write English skeletons to translate
//   node scripts/i18n-content.mjs check           report missing or misplaced translations
import { mkdirSync, readFileSync, readdirSync, writeFileSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const content = join(dirname(fileURLToPath(import.meta.url)), '../src/content')
const read = (p) => JSON.parse(readFileSync(join(content, p), 'utf8'))
const pick = (o, keys) => Object.fromEntries(keys.filter((k) => o[k] != null).map((k) => [k, o[k]]))

function visual(v) {
  const out = pick(v, ['caption'])
  if (v.nodes) out.nodes = v.nodes.map((n) => (typeof n === 'string' ? n : pick(n, ['label', 'detail'])))
  if (v.layers) out.layers = v.layers.map((l) => pick(l, ['name', 'detail']))
  if (v.actors) out.actors = v.actors
  if (v.messages) out.messages = v.messages.map((m) => pick(m, ['label']))
  if (v.columns) out.columns = v.columns
  if (v.rows) out.rows = v.rows
  if (v.items) out.items = v.items.map((i) => pick(i, ['title', 'text']))
  return out
}

function interactive(i) {
  if (i.type === 'quiz') return { questions: i.questions.map((q) => pick(q, ['q', 'options', 'explain'])) }
  if (i.type === 'order') return pick(i, ['prompt', 'items'])
  if (i.type === 'packets') return { packets: i.packets.map((p) => pick(p, ['note'])) }
  return undefined
}

export function skeleton(mod) {
  const lessons = {}
  for (const l of mod.lessons) {
    const c = l.challenge
    lessons[l.id] = {
      title: l.title,
      concept: pick(l.concept, ['text', 'analogy']),
      visual: visual(l.visual),
      steps: l.steps.map((s) => pick(s, ['title', 'text'])),
      interactive: interactive(l.interactive),
      challenge: pick(c, c.language || c.code ? ['prompt', 'hint'] : ['prompt', 'hint', 'solution']),
      takeaways: l.takeaways,
    }
    if (!lessons[l.id].interactive) delete lessons[l.id].interactive
  }
  return { title: mod.title, summary: mod.summary, lessons }
}

const modules = () =>
  readdirSync(join(content, 'modules')).flatMap((tab) =>
    readdirSync(join(content, 'modules', tab)).map((file) => `modules/${tab}/${file}`),
  )

function extract(dir) {
  const write = (p, data) => {
    mkdirSync(dirname(join(dir, p)), { recursive: true })
    writeFileSync(join(dir, p), JSON.stringify(data, null, 2) + '\n')
  }
  for (const p of modules()) write(p, skeleton(read(p)))
  write('tabs.json', Object.fromEntries(read('tabs.json').map((t) => [t.id, pick(t, ['title', 'summary'])])))
  write('paths.json', Object.fromEntries(read('paths.json').map((p) => [p.id, pick(p, ['title', 'description'])])))
  write('glossary.json', Object.fromEntries(read('glossary.json').map((g) => [g.term, pick(g, ['term', 'aliases', 'def'])])))
  console.log(`Wrote skeletons to ${dir}`)
}

// Every string in the skeleton should have a translation at the same place, and nothing else.
function compare(base, es, where, problems) {
  if (typeof base === 'string') {
    if (typeof es !== 'string' || !es.trim()) problems.push(`${where}: missing`)
    return
  }
  if (es == null) return problems.push(`${where}: missing`)
  if (Array.isArray(base)) {
    if (!Array.isArray(es) || es.length !== base.length) return problems.push(`${where}: expected ${base.length} items`)
    return base.forEach((b, i) => compare(b, es[i], `${where}[${i}]`, problems))
  }
  for (const k of Object.keys(es)) if (!(k in base)) problems.push(`${where}.${k}: not translatable here`)
  for (const k of Object.keys(base)) compare(base[k], es[k], `${where}.${k}`, problems)
}

export function check() {
  const problems = []
  const pairs = [
    ...modules().map((p) => [p, skeleton(read(p))]),
    ['tabs.json', Object.fromEntries(read('tabs.json').map((t) => [t.id, pick(t, ['title', 'summary'])]))],
    ['paths.json', Object.fromEntries(read('paths.json').map((p) => [p.id, pick(p, ['title', 'description'])]))],
    ['glossary.json', Object.fromEntries(read('glossary.json').map((g) => [g.term, { term: g.term, def: g.def }]))],
  ]
  for (const [p, base] of pairs) {
    if (!existsSync(join(content, 'es', p))) {
      problems.push(`es/${p}: file missing`)
      continue
    }
    const es = read(join('es', p))
    // Spanish glossary aliases are free-form (plurals differ), so only term and def are compared.
    if (p === 'glossary.json') for (const g of Object.values(es)) delete g.aliases
    compare(base, es, `es/${p}`, problems)
  }
  return problems
}

const [cmd, arg] = process.argv.slice(2)
if (cmd === 'extract') extract(arg ?? 'i18n-skeleton')
else if (cmd === 'check') {
  const problems = check()
  if (problems.length) {
    console.error(problems.join('\n') + `\n\n${problems.length} translation problem(s).`)
    process.exit(1)
  }
  console.log('OK: Spanish content complete.')
}
