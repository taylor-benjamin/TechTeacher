import { useTranslation } from 'react-i18next'
import tabsMeta from '../content/tabs.json'
import glossaryData from '../content/glossary.json'
import pathsData from '../content/paths.json'
import esTabs from '../content/es/tabs.json'
import esGlossary from '../content/es/glossary.json'
import esPaths from '../content/es/paths.json'

// Every JSON file under content/modules/<tab>/ is picked up automatically.
const files = import.meta.glob('../content/modules/*/*.json', { eager: true, import: 'default' })
// Spanish overlays hold only the readable strings; code and ids come from the English files.
const esFiles = import.meta.glob('../content/es/modules/*/*.json', { eager: true, import: 'default' })

// Overlay translated strings onto the English data. Arrays merge by position, so anything
// left untranslated falls back to English.
function merge(base, over) {
  if (over == null) return base
  if (Array.isArray(base)) return base.map((b, i) => merge(b, over[i]))
  if (base && typeof base === 'object') {
    const out = { ...base }
    for (const k of Object.keys(over)) out[k] = merge(base[k], over[k])
    return out
  }
  return typeof over === typeof base ? over : base
}

const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

function build(lang) {
  const es = lang === 'es'
  const tabs = tabsMeta.map((t) => ({ ...merge(t, es ? esTabs[t.id] : null), modules: [] }))
  const tabById = Object.fromEntries(tabs.map((t) => [t.id, t]))

  for (const [path, raw] of Object.entries(files).sort((a, b) => a[1].order - b[1].order)) {
    const over = es ? esFiles[path.replace('/content/modules/', '/content/es/modules/')] : null
    const mod = { ...raw, title: over?.title ?? raw.title, summary: over?.summary ?? raw.summary }
    const tab = tabById[mod.tab]
    if (!tab) continue
    const lessons = mod.lessons.map((l) => ({
      ...merge(l, over?.lessons?.[l.id]),
      key: `${tab.id}/${mod.id}/${l.id}`,
      tabId: tab.id,
      moduleId: mod.id,
      moduleTitle: mod.title,
    }))
    tab.modules.push({ ...mod, lessons })
  }

  const allLessons = tabs.flatMap((t) => t.modules.flatMap((m) => m.lessons))
  const lessonByKey = Object.fromEntries(allLessons.map((l) => [l.key, l]))

  // Accents are ignored when searching, so "configuracion" finds "configuración".
  const fold = (s) => s.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '')
  for (const l of allLessons) {
    l.haystack = fold(
      [
        l.title,
        l.moduleTitle,
        tabById[l.tabId].title,
        l.level,
        l.concept.text,
        l.concept.analogy,
        ...l.steps.map((s) => `${s.title} ${s.text}`),
        ...l.takeaways,
      ].join(' '),
    )
  }
  const score = (l, words) => words.filter((w) => fold(l.title).includes(w)).length
  function searchLessons(query, limit = 12) {
    const words = fold(query).split(/\s+/).filter(Boolean)
    if (!words.length) return []
    return allLessons
      .filter((l) => words.every((w) => l.haystack.includes(w)))
      .sort((a, b) => score(b, words) - score(a, words))
      .slice(0, limit)
  }

  const glossary = glossaryData
    .map((g) => (es && esGlossary[g.term] ? { ...g, ...esGlossary[g.term] } : g))
    .sort((a, b) => a.term.localeCompare(b.term, lang))
  const lookup = new Map()
  for (const g of glossary) for (const name of [g.term, ...(g.aliases ?? [])]) lookup.set(name.toLowerCase(), g)
  const names = [...lookup.keys()].sort((a, b) => b.length - a.length).map(esc)
  // Letter-aware word boundaries, so accented words such as "contraseña" match whole.
  const glossaryRegex = new RegExp(`(?<![\\p{L}\\p{N}_])(${names.join('|')})(?![\\p{L}\\p{N}_])`, 'giu')
  const glossaryLookup = (word) => lookup.get(word.toLowerCase())

  const paths = pathsData.map((p) => merge(p, es ? esPaths[p.id] : null))

  return { tabs, tabById, allLessons, lessonByKey, searchLessons, glossary, glossaryRegex, glossaryLookup, paths }
}

const content = { en: build('en'), es: build('es') }

// The content for the current interface language.
export function useContent() {
  const { i18n } = useTranslation()
  return content[i18n.resolvedLanguage] ?? content.en
}
