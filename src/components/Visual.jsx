import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { btn } from '../lib/ui'

// Steps through a diagram. Starts paused when the user prefers reduced motion,
// and always offers pause/step controls (WCAG 2.2.2).
function useStepper(count) {
  const [active, setActive] = useState(0)
  const [playing, setPlaying] = useState(
    () => !window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  )
  useEffect(() => {
    if (!playing || count < 2) return
    const t = setInterval(() => setActive((a) => (a + 1) % count), 1800)
    return () => clearInterval(t)
  }, [playing, count])
  const step = (d) => {
    setPlaying(false)
    setActive((a) => (a + d + count) % count)
  }
  return { active, playing, setPlaying, step }
}

function Controls({ s, count }) {
  const { t } = useTranslation()
  return (
    <div className="mt-3 flex items-center gap-2 text-sm">
      <button type="button" className={btn} onClick={() => s.step(-1)} aria-label={t('visual.prev')}>◀</button>
      <button type="button" className={btn} onClick={() => s.setPlaying(!s.playing)}>
        {s.playing ? t('visual.pause') : t('visual.play')}
      </button>
      <button type="button" className={btn} onClick={() => s.step(1)} aria-label={t('visual.next')}>▶</button>
      <span className="text-muted">{t('visual.step', { n: s.active + 1, total: count })}</span>
    </div>
  )
}

const norm = (n) => (typeof n === 'string' ? { label: n } : n)

function Flow({ nodes }) {
  const items = nodes.map(norm)
  const s = useStepper(items.length)
  return (
    <>
      <ol className="flex flex-wrap items-stretch gap-y-3">
        {items.map((n, i) => (
          <li key={i} className="flex items-center">
            <div
              className={`max-w-44 rounded-lg border-2 px-3 py-2 text-sm wrap-anywhere transition-colors ${
                i === s.active ? 'border-accent bg-accent text-on-accent' : 'border-line bg-surface'
              }`}
              aria-current={i === s.active ? 'step' : undefined}
            >
              <div className="font-semibold">{n.label}</div>
              {n.detail && <div className="mt-0.5 text-xs">{n.detail}</div>}
            </div>
            {i < items.length - 1 && <span aria-hidden="true" className="px-2 text-lg text-muted">→</span>}
          </li>
        ))}
      </ol>
      <Controls s={s} count={items.length} />
    </>
  )
}

function Layers({ layers }) {
  const s = useStepper(layers.length)
  return (
    <>
      <ol className="space-y-1.5">
        {layers.map((l, i) => (
          <li
            key={i}
            className={`flex flex-wrap items-baseline gap-x-3 rounded-lg border-2 px-3 py-2 text-sm transition-colors ${
              i === s.active ? 'border-accent bg-accent-soft' : 'border-line bg-surface'
            }`}
          >
            <span className="w-40 shrink-0 font-semibold">{l.name}</span>
            <span className="flex-1 text-muted">{l.detail}</span>
            {l.tag && <span className="rounded bg-panel px-1.5 py-0.5 font-mono text-xs">{l.tag}</span>}
          </li>
        ))}
      </ol>
      <Controls s={s} count={layers.length} />
    </>
  )
}

function Sequence({ actors, messages }) {
  const { t } = useTranslation()
  const s = useStepper(messages.length)
  const W = Math.max(560, actors.length * 140) // wider canvas when there are many actors
  const col = (i) => 70 + (i * (W - 140)) / Math.max(1, actors.length - 1)
  const H = 60 + messages.length * 46
  return (
    <>
      <div className="overflow-x-auto">
        <svg viewBox={`0 0 ${W} ${H}`} className="min-w-[520px]" role="img" aria-label={t('visual.sequence', { actors: actors.join(', ') })}>
          <defs>
            <marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
              <path d="M0 0L10 5L0 10z" fill="var(--ink)" />
            </marker>
          </defs>
          {actors.map((a, i) => (
            <g key={i}>
              <line x1={col(i)} y1="34" x2={col(i)} y2={H - 6} stroke="var(--line)" strokeDasharray="4 4" />
              <rect x={col(i) - 60} y="4" width="120" height="28" rx="6" fill="var(--accent)" />
              <text x={col(i)} y="23" textAnchor="middle" fontSize="13" fontWeight="600" fill="var(--on-accent)">{a}</text>
            </g>
          ))}
          {messages.map((m, i) => {
            const y = 74 + i * 46
            const on = i === s.active
            return (
              // Inactive steps use the muted colour, not transparency, so the text keeps AA contrast.
              <g key={i}>
                <text x={(col(m.from) + col(m.to)) / 2} y={y - 8} textAnchor="middle" fontSize="12.5" fontWeight={on ? 700 : 400} fill={on ? 'var(--ink)' : 'var(--muted)'}>
                  {i + 1}. {m.label}
                </text>
                <line
                  x1={col(m.from)} y1={y} x2={col(m.to)} y2={y}
                  stroke={on ? 'var(--accent-ink)' : 'var(--muted)'} strokeWidth={on ? 3 : 1.5} markerEnd="url(#arrow)"
                />
              </g>
            )
          })}
        </svg>
      </div>
      <Controls s={s} count={messages.length} />
    </>
  )
}

function Compare({ columns, rows }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[420px] border-collapse text-left text-sm">
        <thead>
          <tr>
            <td className="border-b-2 border-line p-2" />
            {columns.map((c) => (
              <th key={c} scope="col" className="border-b-2 border-accent p-2 font-semibold text-accent-ink">{c}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-b border-line align-top">
              <th scope="row" className="p-2 font-semibold">{r[0]}</th>
              {r.slice(1).map((cell, j) => <td key={j} className="p-2 text-muted">{cell}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function Cards({ items }) {
  return (
    <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((it, i) => (
        <li key={i} className="rounded-lg border border-line border-l-4 border-l-accent bg-surface p-3 text-sm">
          <div className="font-semibold">{it.title}</div>
          <div className="mt-1 text-muted">{it.text}</div>
        </li>
      ))}
    </ul>
  )
}

const TYPES = { flow: Flow, layers: Layers, sequence: Sequence, compare: Compare, cards: Cards }

export default function Visual({ spec }) {
  const { t } = useTranslation()
  const Type = TYPES[spec.type]
  if (!Type) return <p className="text-bad">{t('visual.unknown', { type: spec.type })}</p>
  return (
    <figure>
      <Type {...spec} />
      {spec.caption && <figcaption className="mt-3 text-sm text-muted">{spec.caption}</figcaption>}
    </figure>
  )
}
