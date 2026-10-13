import tabsMeta from '../content/tabs.json'
import glossaryData from '../content/glossary.json'
import pathsData from '../content/paths.json'

// Every JSON file under content/modules/<tab>/ is picked up automatically.
const files = import.meta.glob('../content/modules/*/*.json', { eager: true, import: 'default' })

export const tabs = tabsMeta.map((t) => ({ ...t, modules: [] }))
export const tabById = Object.fromEntries(tabs.map((t) => [t.id, t]))

for (const mod of Object.values(files).sort((a, b) => a.order - b.order)) {
  const tab = tabById[mod.tab]
  if (!tab) continue
  const lessons = mod.lessons.map((l) => ({
    ...l,
    key: `${tab.id}/${mod.id}/${l.id}`,
    tabId: tab.id,
    moduleId: mod.id,
    moduleTitle: mod.title,
  }))
  tab.modules.push({ ...mod, lessons })
}

export const allLessons = tabs.flatMap((t) => t.modules.flatMap((m) => m.lessons))
export const lessonByKey = Object.fromEntries(allLessons.map((l) => [l.key, l]))

for (const l of allLessons) {
  l.haystack = [
    l.title,
    l.moduleTitle,
    tabById[l.tabId].title,
    l.level,
    l.concept.text,
    l.concept.analogy,
    ...l.steps.map((s) => `${s.title} ${s.text}`),
    ...l.takeaways,
  ]
    .join(' ')
    .toLowerCase()
}

export function searchLessons(query, limit = 12) {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean)
  if (!words.length) return []
  return allLessons
    .filter((l) => words.every((w) => l.haystack.includes(w)))
    .sort((a, b) => score(b, words) - score(a, words))
    .slice(0, limit)
}
const score = (l, words) => words.filter((w) => l.title.toLowerCase().includes(w)).length

export const glossary = [...glossaryData].sort((a, b) => a.term.localeCompare(b.term))
export const paths = pathsData

const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const lookup = new Map()
for (const g of glossary) for (const name of [g.term, ...(g.aliases ?? [])]) lookup.set(name.toLowerCase(), g)
const names = [...lookup.keys()].sort((a, b) => b.length - a.length).map(esc)
export const glossaryRegex = new RegExp(`\\b(${names.join('|')})\\b`, 'gi')
export const glossaryLookup = (word) => lookup.get(word.toLowerCase())
