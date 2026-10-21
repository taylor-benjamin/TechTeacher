// Checks every colour pairing the theme uses against WCAG 2.2 AA, in both modes and every tab.
// Text needs 4.5:1. Borders, focus rings, icons and other UI parts need 3:1 (SC 1.4.11).
// Run: npm run check:contrast
import { readFileSync } from 'node:fs'

const css = readFileSync(new URL('../src/index.css', import.meta.url), 'utf8')

// Read the custom properties from a CSS block such as `:root { ... }` or `.dark [data-tab="ai"] { ... }`.
function vars(selector) {
  const esc = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const block = css.match(new RegExp(`(^|\\n)${esc}\\s*\\{([^}]*)\\}`))?.[2]
  if (!block) throw new Error(`No CSS block for ${selector}`)
  return Object.fromEntries([...block.matchAll(/--([\w-]+):\s*(#[0-9a-f]{6})/gi)].map((m) => [m[1], m[2].toLowerCase()]))
}

const rgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16))
const toHex = (c) => '#' + c.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')
// color-mix(in srgb, a p%, b)
const mix = (a, b, p) => toHex(rgb(a).map((v, i) => v * p + rgb(b)[i] * (1 - p)))
const lum = (hex) => {
  const [r, g, b] = rgb(hex).map((v) => {
    const c = v / 255
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}
const ratio = (a, b) => {
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}

// --glow is the accent share of the page backdrop's top glow, set per mode.
const glowOf = (block) => parseFloat(css.match(new RegExp(`(^|\\n)${block}\\s*\\{[^}]*--glow:\\s*([\\d.]+)%`))[2]) / 100
const glowShare = { light: glowOf(':root'), dark: glowOf('\\.dark') }
const TABS = ['home', 'software', 'ai', 'networking', 'webdesign', 'security']
const TEXT = 4.5
const UI = 3
const failures = []
let checked = 0

for (const mode of ['light', 'dark']) {
  const base = mode === 'light' ? vars(':root') : { ...vars(':root'), ...vars('.dark') }
  for (const tab of TABS) {
    const v = { ...base, ...vars(`${mode === 'dark' ? '.dark ' : ''}[data-tab="${tab}"]`) }
    // The page backdrop has an accent glow at the top, and the header is 82% panel over it.
    const glow = mix(v.accent, v.surface, glowShare[mode])
    const header = mix(v.panel, glow, 0.82)
    const pairs = [
      // [what, foreground, background, minimum]
      ...['surface', 'panel', 'glow', 'header', 'accent-soft'].flatMap((bg) => {
        const b = { glow, header }[bg] ?? v[bg]
        return [
          [`ink on ${bg}`, v.ink, b, TEXT],
          [`muted on ${bg}`, v.muted, b, TEXT],
          [`accent-ink on ${bg}`, v['accent-ink'], b, TEXT],
          [`ok on ${bg}`, v.ok, b, TEXT],
          [`bad on ${bg}`, v.bad, b, TEXT],
        ]
      }),
      ['on-accent on accent (buttons)', v['on-accent'], v.accent, TEXT],
      ['surface on ink (active tab, tooltips)', v.surface, v.ink, TEXT],
      ['edge border on panel (inputs)', v.edge, v.panel, UI],
      ['edge border on surface', v.edge, v.surface, UI],
      ['accent border on panel (selected)', v.accent, v.panel, UI],
      ['accent on surface (dots, bars)', v.accent, v.surface, UI],
      ['focus ring (accent-ink) on surface', v['accent-ink'], v.surface, UI],
      ['focus ring (accent-ink) on panel', v['accent-ink'], v.panel, UI],
      ['progress fill on track (line)', v['accent-ink'], v.line, UI],
      ['ok border on surface', v.ok, v.surface, UI],
      ['bad border on surface', v.bad, v.surface, UI],
    ]
    for (const [what, fg, bg, min] of pairs) {
      checked++
      const r = ratio(fg, bg)
      if (r < min) failures.push(`${mode.padEnd(5)} ${tab.padEnd(10)} ${what.padEnd(38)} ${fg} on ${bg}: ${r.toFixed(2)}:1 (needs ${min}:1)`)
    }
  }
}

if (failures.length) {
  console.error(failures.join('\n') + `\n\n${failures.length} of ${checked} pairings fail WCAG AA.`)
  process.exit(1)
}
console.log(`OK: all ${checked} colour pairings meet WCAG 2.2 AA.`)
