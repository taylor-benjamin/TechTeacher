import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useContent } from '../lib/content'
import { btnPrimary, card, href, input } from '../lib/ui'

export function ProgressBar({ value, max, label, className = '' }) {
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={value}
      className={`h-1 rounded-full bg-line ${className}`}
    >
      <div className="glow h-full rounded-full bg-accent-ink" style={{ width: `${max ? (value / max) * 100 : 0}%` }} />
    </div>
  )
}

function Paths({ done }) {
  const { t } = useTranslation()
  const { lessonByKey, paths, tabById } = useContent()
  return (
    <section aria-labelledby="paths-h">
      <h2 id="paths-h" className="text-2xl font-normal tracking-tight">{t('home.pathsTitle')}</h2>
      <p className="mt-1 text-muted">{t('home.pathsIntro')}</p>
      <ul className="mt-4 grid gap-4 lg:grid-cols-2">
        {paths.map((p) => {
          const lessons = p.lessons.map((k) => lessonByKey[k]).filter(Boolean)
          const count = lessons.filter((l) => done[l.key]).length
          const next = lessons.find((l) => !done[l.key]) ?? lessons[0]
          return (
            <li key={p.id} data-tab={p.tab} className={`${card} border-t-4 border-t-accent p-4`}>
              <h3 className="flex items-center gap-2.5 text-lg font-medium"><span aria-hidden="true" className="glow h-2.5 w-2.5 rounded-full bg-accent" />{p.title}</h3>
              <p className="mt-1 text-sm text-muted">{p.description}</p>
              <ProgressBar value={count} max={lessons.length} label={t('home.pathProgress', { title: p.title })} className="mt-3" />
              <div className="mt-3 flex items-center justify-between text-sm">
                <span className="text-muted">{t('home.lessonsOf', { count, total: lessons.length })}</span>
                {next && <a className={btnPrimary} href={href(next.key)}>{count ? t('overview.continue') : t('home.startPath')}</a>}
              </div>
              <details className="mt-3">
                <summary className="cursor-pointer text-sm font-medium">{t('home.seeSteps')}</summary>
                <ol className="mt-2 space-y-1 text-sm">
                  {lessons.map((l, i) => (
                    <li key={l.key} className="flex gap-2">
                      <span className={done[l.key] ? 'text-ok' : 'text-muted'}>{done[l.key] ? '✓' : `${i + 1}.`}</span>
                      <a className="underline" href={href(l.key)}>{l.title}</a>
                      <span className="text-muted">· {tabById[l.tabId].title} · {t(`levels.${l.level}`)}</span>
                    </li>
                  ))}
                </ol>
              </details>
            </li>
          )
        })}
      </ul>
    </section>
  )
}

export default function Home({ done, pathsOnly }) {
  const { t } = useTranslation()
  const { allLessons, tabs } = useContent()
  if (pathsOnly) return <><h1 className="sr-only">{t('app.learningPaths')}</h1><Paths done={done} /></>
  const total = allLessons.filter((l) => done[l.key]).length
  return (
    <div className="space-y-10">
      <section>
        <h1 className="text-4xl font-light tracking-tight sm:text-5xl">{t('home.hero')}</h1>
        <p className="mt-3 max-w-2xl text-lg text-muted">{t('home.heroIntro')}</p>
        <div className={`${card} mt-5 max-w-xl p-4`}>
          <div className="flex justify-between text-sm font-medium">
            <span>{t('home.yourProgress')}</span>
            <span>{t('home.lessonsOf', { count: total, total: allLessons.length })}</span>
          </div>
          <ProgressBar value={total} max={allLessons.length} label={t('home.overallProgress')} className="mt-2" />
        </div>
      </section>

      <section aria-labelledby="subjects-h">
        <h2 id="subjects-h" className="text-2xl font-normal tracking-tight">{t('app.subjects')}</h2>
        <ul className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {tabs.map((tb) => {
            const lessons = tb.modules.flatMap((m) => m.lessons)
            const count = lessons.filter((l) => done[l.key]).length
            return (
              <li key={tb.id} data-tab={tb.id}>
                <a href={href(tb.id)} className={`${card} block h-full border-t-4 border-t-accent p-4 hover:bg-accent-soft`}>
                  <h3 className="flex items-center gap-2.5 text-lg font-medium text-accent-ink"><span aria-hidden="true" className="glow h-2.5 w-2.5 rounded-full bg-accent" />{tb.title}</h3>
                  <p className="mt-1 text-sm text-muted">{tb.summary}</p>
                  <p className="mt-3 text-sm">{t('home.subjectStats', { modules: tb.modules.length, lessons: lessons.length })}</p>
                  <ProgressBar value={count} max={lessons.length} label={t('sidebar.progress', { title: tb.title })} className="mt-2" />
                </a>
              </li>
            )
          })}
        </ul>
      </section>

      <Paths done={done} />
    </div>
  )
}

export function Glossary() {
  const { t } = useTranslation()
  const { glossary } = useContent()
  const [q, setQ] = useState('')
  const shown = glossary.filter((g) => (g.term + ' ' + g.def).toLowerCase().includes(q.toLowerCase()))
  return (
    <>
      <h1 className="text-4xl font-light tracking-tight">{t('glossary.title')}</h1>
      <p className="mt-2 text-muted">{t('glossary.intro')}</p>
      <label className="mt-4 block text-sm font-medium" htmlFor="gloss-q">{t('glossary.filter')}</label>
      <input id="gloss-q" className={`${input} mt-1 w-full max-w-sm`} value={q} onChange={(e) => setQ(e.target.value)} />
      <p className="mt-2 text-sm text-muted" aria-live="polite">{t('glossary.count', { count: shown.length })}</p>
      <dl className="mt-3 grid gap-3 md:grid-cols-2">
        {shown.map((g) => (
          <div key={g.term} className={`${card} p-3`}>
            <dt className="font-semibold">{g.term}</dt>
            <dd className="mt-1 text-sm text-muted">{g.def}</dd>
          </div>
        ))}
      </dl>
    </>
  )
}
