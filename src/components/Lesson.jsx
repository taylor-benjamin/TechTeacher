import { LEVELS, btn, btnPrimary, card, href } from '../lib/ui'
import RichText from './RichText'
import Visual from './Visual'
import Interactive from '../interactive'

function Section({ n, title, children }) {
  return (
    <section aria-labelledby={`sec-${n}`} className={`${card} p-4 sm:p-6`}>
      <h2 id={`sec-${n}`} className="mb-4 flex items-center gap-3 text-xl font-normal tracking-tight">
        <span aria-hidden="true" className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-accent bg-accent-soft text-sm font-medium text-accent-ink">{n}</span>
        {title}
      </h2>
      {children}
    </section>
  )
}

const Code = ({ children }) => (
  <pre className="mt-2 overflow-x-auto rounded-lg border border-line bg-surface p-3 font-mono text-sm leading-relaxed">
    <code>{children}</code>
  </pre>
)

export default function Lesson({ lesson, tab, theme, done, toggleDone, prev, next }) {
  const { concept, visual, steps, interactive, challenge, takeaways } = lesson
  const lvl = LEVELS[lesson.level]
  return (
    <article className="space-y-5">
      <header>
        <p className="text-sm text-muted">
          <a className="underline" href={href(tab.id)}>{tab.title}</a> / {lesson.moduleTitle}
        </p>
        <h1 className="mt-1 text-4xl font-light tracking-tight">{lesson.title}</h1>
        <p className="mt-2 flex flex-wrap items-center gap-2 text-sm">
          <span className="rounded-full border border-accent px-2.5 py-0.5 font-medium text-accent-ink">
            <span aria-hidden="true">{lvl.dots} </span>{lvl.label}
          </span>
          <span className="text-muted">about {lesson.minutes} min</span>
          {done && <span className="font-medium text-ok">✓ Completed</span>}
        </p>
      </header>

      <Section n={1} title="The concept">
        <RichText text={concept.text} />
        <div className="mt-4 rounded-lg border-l-4 border-accent bg-accent-soft p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-accent-ink">Analogy</p>
          <RichText text={concept.analogy} glossary={false} className="mt-1" />
        </div>
      </Section>

      <Section n={2} title="See it">
        <Visual spec={visual} />
      </Section>

      <Section n={3} title="Step by step">
        <ol className="space-y-4">
          {steps.map((s, i) => (
            <li key={i} className="flex gap-3">
              <span aria-hidden="true" className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full border-2 border-accent text-xs font-bold text-accent-ink">{i + 1}</span>
              <div className="min-w-0 flex-1">
                <h3 className="font-semibold">{s.title}</h3>
                <RichText text={s.text} className="text-muted" />
                {s.code && <Code>{s.code}</Code>}
              </div>
            </li>
          ))}
        </ol>
      </Section>

      <Section n={4} title="Try it">
        <Interactive spec={interactive} theme={theme} />
      </Section>

      <Section n={5} title="Challenge">
        <RichText text={challenge.prompt} />
        {challenge.language && (
          <div className="mt-3">
            <Interactive spec={{ type: 'code', language: challenge.language, starter: challenge.starter ?? '', seed: challenge.seed }} theme={theme} />
          </div>
        )}
        <details className="mt-3 rounded-lg border border-line bg-surface p-3">
          <summary className="cursor-pointer font-medium">Need a hint?</summary>
          <RichText text={challenge.hint} className="mt-2 text-muted" />
        </details>
        <details className="mt-2 rounded-lg border border-line bg-surface p-3">
          <summary className="cursor-pointer font-medium">Reveal solution</summary>
          {challenge.language || challenge.code ? <Code>{challenge.solution}</Code> : <RichText text={challenge.solution} className="mt-2" />}
        </details>
      </Section>

      <Section n={6} title="Key takeaways">
        <ul className="space-y-2">
          {takeaways.map((t, i) => (
            <li key={i} className="flex gap-2">
              <span aria-hidden="true" className="font-bold text-accent-ink">✓</span>
              <RichText text={t} glossary={false} />
            </li>
          ))}
        </ul>
      </Section>

      <div className="flex flex-wrap items-center justify-between gap-3">
        {prev ? <a className={btn} href={href(prev.key)}>← {prev.title}</a> : <span />}
        <button type="button" className={done ? btn : btnPrimary} aria-pressed={done} onClick={toggleDone}>
          {done ? '✓ Completed (undo)' : 'Mark lesson complete'}
        </button>
        {next ? <a className={btn} href={href(next.key)}>{next.title} →</a> : <span />}
      </div>
    </article>
  )
}
