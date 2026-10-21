import { useState } from 'react'
import { useTranslation } from 'react-i18next'

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
  const { t } = useTranslation()
  const [fg, setFg] = useState('#8a8a8a')
  const [bg, setBg] = useState('#ffffff')
  const r = ratio(fg, bg)
  const checks = [
    [t('contrast.aa'), 4.5],
    [t('contrast.aaLarge'), 3],
    [t('contrast.aaa'), 7],
  ]
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div className="space-y-3">
        {[[t('contrast.text'), fg, setFg], [t('contrast.background'), bg, setBg]].map(([label, value, set]) => (
          <label key={label} className="flex items-center gap-3 text-sm font-medium">
            <input type="color" value={value} onChange={(e) => set(e.target.value)} className="h-10 w-14 cursor-pointer rounded border border-edge" />
            {label} <code className="code-inline">{value}</code>
          </label>
        ))}
        <p className="text-2xl font-bold" aria-live="polite">{r.toFixed(2)} : 1</p>
        <ul className="space-y-1 text-sm">
          {checks.map(([name, min]) => (
            <li key={name} className={r >= min ? 'text-ok' : 'text-bad'}>
              <strong>{r >= min ? t('contrast.pass') : t('contrast.fail')}</strong> · {name} ({t('contrast.needs', { min })})
            </li>
          ))}
        </ul>
      </div>
      <div className="rounded-lg border border-line p-5" style={{ color: fg, background: bg }}>
        <p className="text-2xl font-bold">{t('contrast.heading')}</p>
        <p className="mt-2">{t('contrast.body')}</p>
        <p className="mt-2 text-sm">{t('contrast.small')}</p>
      </div>
    </div>
  )
}
