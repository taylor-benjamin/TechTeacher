import { useState } from 'react'

const lum = (hexColor) => {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hexColor.slice(i, i + 2), 16) / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}
const ratio = (a, b) => {
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}

// WCAG contrast checker: pick two colours, see the ratio and which levels pass.
export default function Contrast() {
  const [fg, setFg] = useState('#8a8a8a')
  const [bg, setBg] = useState('#ffffff')
  const r = ratio(fg, bg)
  const checks = [
    ['AA normal text', 4.5],
    ['AA large text / UI parts', 3],
    ['AAA normal text', 7],
  ]
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div className="space-y-3">
        {[['Text colour', fg, setFg], ['Background colour', bg, setBg]].map(([label, value, set]) => (
          <label key={label} className="flex items-center gap-3 text-sm font-medium">
            <input type="color" value={value} onChange={(e) => set(e.target.value)} className="h-10 w-14 cursor-pointer rounded border border-edge" />
            {label} <code className="code-inline">{value}</code>
          </label>
        ))}
        <p className="text-2xl font-bold" aria-live="polite">{r.toFixed(2)} : 1</p>
        <ul className="space-y-1 text-sm">
          {checks.map(([name, min]) => (
            <li key={name} className={r >= min ? 'text-ok' : 'text-bad'}>
              <strong>{r >= min ? '✓ Pass' : '✗ Fail'}</strong> · {name} (needs {min}:1)
            </li>
          ))}
        </ul>
      </div>
      <div className="rounded-lg border border-line p-5" style={{ color: fg, background: bg }}>
        <p className="text-2xl font-bold">Large heading sample</p>
        <p className="mt-2">Body text sample. Can you read this comfortably on a phone, outdoors, in bright sun? If you have to squint, so will your visitors.</p>
        <p className="mt-2 text-sm">Small print is the first thing to become unreadable.</p>
      </div>
    </div>
  )
}
