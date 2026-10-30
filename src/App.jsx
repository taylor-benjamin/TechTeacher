import { Component, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useContent } from './lib/content'
import { useHashRoute, useStored } from './lib/store'
import { LEVELS, btn, btnPrimary, card, href } from './lib/ui'
import Lesson from './components/Lesson'
import Home, { Glossary, ProgressBar } from './components/Home'
import Search from './components/Search'
import Account, { Activity, ResetPassword } from './components/Account'
import Privacy from './components/Privacy'
import SignupNudge from './components/SignupNudge'
import { logActivity, setLessonDone, syncProgress, useAccount } from './lib/account'
import logoLight from './assets/brand/techteacher-logo-light.svg'
import logoDark from './assets/brand/techteacher-logo-dark.svg'

function ErrorMessage({ error }) {
  const { t } = useTranslation()
  return (
    <div role="alert" className={`${card} p-5`}>
      <h2 className="font-semibold text-bad">{t('app.error')}</h2>
      <pre className="mt-2 whitespace-pre-wrap text-sm">{String(error)}</pre>
    </div>
  )
}

class ErrorBoundary extends Component {
  state = { error: null }
  static getDerivedStateFromError(error) {
    return { error }
  }
  render() {
    if (!this.state.error) return this.props.children
    return <ErrorMessage error={this.state.error} />
  }
}

// EN/ES switch. Its name stays "Español" in both languages so Spanish speakers can find it.
function LanguageSwitch() {
  const { t, i18n } = useTranslation()
  const es = i18n.resolvedLanguage === 'es'
  return (
    <button
      type="button"
      role="switch"
      aria-checked={es}
      aria-label="Español"
      lang="es"
      title={t('app.toggleLanguage')}
      onClick={() => i18n.changeLanguage(es ? 'en' : 'es')}
      className="relative grid h-8 w-[3.75rem] shrink-0 grid-cols-2 items-center rounded-full border border-line bg-panel p-0.5 text-xs font-semibold hover:border-accent"
    >
      <span
        aria-hidden="true"
        className={`absolute inset-y-0.5 left-0.5 w-[calc(50%-2px)] rounded-full bg-accent transition-transform ${es ? 'translate-x-full' : ''}`}
      />
      <span aria-hidden="true" className={`relative text-center ${es ? 'text-muted' : 'text-on-accent'}`}>EN</span>
      <span aria-hidden="true" className={`relative text-center ${es ? 'text-on-accent' : 'text-muted'}`}>ES</span>
    </button>
  )
}

function LevelFilter({ level, setLevel }) {
  const { t } = useTranslation()
  return (
    <fieldset>
      <legend className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted">{t('levels.label')}</legend>
      <div className="flex flex-wrap gap-1">
        {['all', ...Object.keys(LEVELS)].map((l) => (
          <button
            key={l}
            type="button"
            aria-pressed={level === l}
            onClick={() => setLevel(l)}
            className={`rounded-full border px-2.5 py-1 text-xs font-medium ${
              level === l ? 'border-accent bg-accent text-on-accent' : 'border-edge bg-panel hover:bg-accent-soft'
            }`}
          >
            {t(`levels.${l}`)}
          </button>
        ))}
      </div>
    </fieldset>
  )
}

function Sidebar({ tab, current, level, setLevel, done }) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(() => new Set([current?.moduleId ?? tab.modules[0]?.id]))
  useEffect(() => {
    if (current) setOpen((o) => new Set(o).add(current.moduleId))
  }, [current])
  const toggle = (id) =>
    setOpen((o) => {
      const n = new Set(o)
      n.has(id) ? n.delete(id) : n.add(id)
      return n
    })
  return (
    <nav aria-label={t('sidebar.modules', { tab: tab.title })} className="space-y-4">
      <LevelFilter level={level} setLevel={setLevel} />
      <ul className="space-y-2">
        {tab.modules.map((m) => {
          const shown = m.lessons.filter((l) => level === 'all' || l.level === level)
          const count = m.lessons.filter((l) => done[l.key]).length
          const isOpen = open.has(m.id)
          return (
            <li key={m.id} className={`${card} overflow-hidden`}>
              <button
                type="button"
                aria-expanded={isOpen}
                onClick={() => toggle(m.id)}
                className="w-full px-3 py-2.5 text-left hover:bg-accent-soft"
              >
                <span className="flex items-center justify-between gap-2">
                  <span className="font-semibold">{m.title}</span>
                  <span className="text-xs text-muted">{count}/{m.lessons.length} <span aria-hidden="true">{isOpen ? '▾' : '▸'}</span></span>
                </span>
                <ProgressBar value={count} max={m.lessons.length} label={t('sidebar.progress', { title: m.title })} className="mt-1.5" />
              </button>
              {isOpen && (
                <ol className="border-t border-line py-1">
                  {shown.length === 0 && <li className="px-3 py-2 text-sm text-muted">{t('sidebar.empty')}</li>}
                  {shown.map((l) => {
                    const active = current?.key === l.key
                    return (
                      <li key={l.id}>
                        <a
                          href={href(l.key)}
                          aria-current={active ? 'page' : undefined}
                          className={`flex items-start gap-2 border-l-4 px-3 py-1.5 text-sm hover:bg-accent-soft ${
                            active ? 'border-accent bg-accent-soft font-semibold' : 'border-transparent'
                          }`}
                        >
                          <span className={done[l.key] ? 'text-ok' : 'text-muted'} aria-hidden="true">{done[l.key] ? '✓' : '○'}</span>
                          <span className="flex-1">
                            {l.title}
                            {done[l.key] && <span className="sr-only"> {t('sidebar.completed')}</span>}
                          </span>
                          <span className="text-[10px] leading-5 text-muted" title={t(`levels.${l.level}`)}>
                            <span aria-hidden="true">{LEVELS[l.level].dots}</span>
                            <span className="sr-only">{t(`levels.${l.level}`)}</span>
                          </span>
                        </a>
                      </li>
                    )
                  })}
                </ol>
              )}
            </li>
          )
        })}
      </ul>
    </nav>
  )
}

function TabOverview({ tab, done }) {
  const { t } = useTranslation()
  return (
    <>
      <h1 className="text-4xl font-light tracking-tight">{tab.title}</h1>
      <p className="mt-2 max-w-2xl text-muted">{tab.summary}</p>
      <ul className="mt-6 grid gap-4 md:grid-cols-2">
        {tab.modules.map((m) => {
          const count = m.lessons.filter((l) => done[l.key]).length
          const next = m.lessons.find((l) => !done[l.key]) ?? m.lessons[0]
          return (
            <li key={m.id} className={`${card} flex flex-col p-4`}>
              <h2 className="text-lg font-semibold">{m.title}</h2>
              <p className="mt-1 flex-1 text-sm text-muted">{m.summary}</p>
              <ProgressBar value={count} max={m.lessons.length} label={t('sidebar.progress', { title: m.title })} className="mt-3" />
              <div className="mt-3 flex items-center justify-between text-sm">
                <span className="text-muted">{t('overview.done', { count, total: m.lessons.length })}</span>
                <a href={href(next.key)} className={btnPrimary}>{count ? t('overview.continue') : t('overview.start')}</a>
              </div>
            </li>
          )
        })}
      </ul>
    </>
  )
}

export default function App() {
  const { t, i18n } = useTranslation()
  const { allLessons, tabById, tabs } = useContent()
  const [tabId, moduleId, lessonId] = useHashRoute()
  const [theme, setTheme] = useStored('tt.theme', () =>
    document.documentElement.classList.contains('dark') ? 'dark' : 'light',
  )
  const [level, setLevel] = useStored('tt.level', 'all')
  const [done, setDone] = useStored('tt.progress', {})
  const [menuOpen, setMenuOpen] = useState(false)
  const mainRef = useRef(null)
  const account = useAccount()
  const signedIn = account.status === 'signedIn'

  const tab = tabById[tabId]
  const module = tab?.modules.find((m) => m.id === moduleId)
  const lesson = module?.lessons.find((l) => l.id === lessonId) ?? module?.lessons[0]
  const routeKey = [tabId, moduleId, lessonId].join('/')

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark')
  }, [theme])

  useEffect(() => {
    document.title = (lesson?.title ?? tab?.title ?? t('app.learnTechnology')) + ' · TechTeacher'
  }, [routeKey, i18n.resolvedLanguage]) // eslint-disable-line react-hooks/exhaustive-deps

  const first = useRef(true)
  useEffect(() => {
    setMenuOpen(false)
    if (first.current) return void (first.current = false)
    window.scrollTo(0, 0)
    mainRef.current?.focus({ preventScroll: true })
  }, [routeKey])

  // On sign-in, lessons finished while signed out are merged into the account and the
  // account's progress replaces the browser copy. On sign-out the browser copy is cleared,
  // so the next person on a shared computer starts fresh.
  const wasSignedIn = useRef(false)
  useEffect(() => {
    if (signedIn) {
      syncProgress(Object.keys(done).filter((k) => done[k]))
        .then(({ progress }) => setDone(Object.fromEntries(Object.keys(progress).map((k) => [k, true]))))
        .catch(() => {})
    } else if (wasSignedIn.current) {
      setDone({})
    }
    wasSignedIn.current = signedIn
  }, [signedIn]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (signedIn && lesson) logActivity('lesson_open', lesson.key).catch(() => {})
  }, [signedIn, lesson?.key]) // eslint-disable-line react-hooks/exhaustive-deps

  // After a signed-out learner completes a lesson, invite them (once, until dismissed) to save progress.
  const [nudge, setNudge] = useState(false)
  const [nudgeDismissed, setNudgeDismissed] = useStored('tt.signupNudge', false)
  const dismissNudge = () => (setNudge(false), setNudgeDismissed(true))

  const toggleDone = (key) => {
    setDone((d) => ({ ...d, [key]: !d[key] }))
    if (signedIn) setLessonDone(key, !done[key]).catch(() => {})
    // Also while the session check is still loading; the nudge hides itself if it turns out signed in.
    else if (!done[key] && account.status !== 'unavailable' && !nudgeDismissed) setNudge(true)
  }
  const idx = lesson ? allLessons.indexOf(lesson) : -1
  const inTab = (l) => (l?.tabId === tab?.id ? l : null)

  return (
    <div data-tab={tab?.id ?? 'home'} className="app-bg min-h-screen text-ink">
      <button
        type="button"
        onClick={() => mainRef.current?.focus()}
        className="sr-only focus:not-sr-only focus:fixed focus:left-2 focus:top-2 focus:z-50 focus:rounded-md focus:bg-ink focus:px-3 focus:py-2 focus:text-surface"
      >
        {t('app.skip')}
      </button>

      <header className="glass sticky top-0 z-40 border-b border-line">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-3 gap-y-2 px-4 py-2.5">
          {/* Each logo is drawn for its theme: dark wordmark on light, light wordmark on dark. */}
          <a href="#/" className="flex shrink-0 items-center">
            <img src={logoLight} alt="TechTeacher" width="157" height="32" className="h-8 w-auto dark:hidden" />
            <img src={logoDark} alt="TechTeacher" width="157" height="32" className="hidden h-8 w-auto dark:block" />
          </a>
          <nav aria-label={t('app.subjects')} className="order-last w-full overflow-x-auto [scrollbar-width:thin]">
            <ul className="flex gap-1.5 p-0.5">
              {tabs.map((tb) => (
                <li key={tb.id} data-tab={tb.id}>
                  <a
                    href={href(tb.id)}
                    aria-current={tab?.id === tb.id ? 'page' : undefined}
                    className={`flex items-center gap-2 whitespace-nowrap rounded-full border px-3.5 py-1.5 text-sm font-medium ${
                      tab?.id === tb.id ? 'border-ink bg-ink text-surface' : 'border-line hover:border-accent hover:bg-accent-soft'
                    }`}
                  >
                    <span aria-hidden="true" className="h-2 w-2 rounded-full bg-accent" />
                    {tb.title}
                  </a>
                </li>
              ))}
              {/* On phones the header buttons are hidden, so these links live in the tab row. */}
              {[['paths', t('app.paths')], ['glossary', t('app.glossary')]].map(([id, label]) => (
                <li key={id} className="sm:hidden">
                  <a href={href(id)} aria-current={tabId === id ? 'page' : undefined} className={`block whitespace-nowrap rounded-full border px-3.5 py-1.5 text-sm font-medium ${tabId === id ? 'border-ink bg-ink text-surface' : 'border-line hover:bg-accent-soft'}`}>
                    {label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <Search />
            <a href="#/paths" className={`${btn} max-sm:hidden`}>{t('app.paths')}</a>
            <a href="#/glossary" className={`${btn} max-sm:hidden`}>{t('app.glossary')}</a>
            {(signedIn || account.status === 'signedOut') && (
              <a href="#/account" aria-current={tabId === 'account' ? 'page' : undefined} className={`${btn} whitespace-nowrap`}>
                {signedIn ? t('account.short') : t('account.signInShort')}
              </a>
            )}
            <LanguageSwitch />
            <button
              type="button"
              className={btn}
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              aria-label={theme === 'dark' ? t('app.themeToLight') : t('app.themeToDark')}
            >
              <span aria-hidden="true">{theme === 'dark' ? '☀' : '☾'}</span>
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-4 py-6 lg:flex lg:gap-6">
        {tab && (
          <aside className="mb-4 lg:mb-0 lg:w-72 lg:shrink-0">
            <button
              type="button"
              className={`${btn} mb-3 w-full lg:hidden`}
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen(!menuOpen)}
            >
              {menuOpen ? t('app.hideMenu') : t('app.showMenu')}
            </button>
            <div className={`${menuOpen ? '' : 'hidden'} lg:sticky lg:top-20 lg:block lg:max-h-[calc(100vh-6rem)] lg:overflow-y-auto lg:pr-1`}>
              <Sidebar key={tab.id} tab={tab} current={module ? lesson : null} level={level} setLevel={setLevel} done={done} />
            </div>
          </aside>
        )}
        <main ref={mainRef} tabIndex={-1} className="min-w-0 flex-1 outline-none">
          <ErrorBoundary key={routeKey}>
            {tab && module && lesson ? (
              <Lesson
                // Remount on a language switch so widgets holding text in state pick up the new language.
                key={`${lesson.key}:${i18n.resolvedLanguage}`}
                lesson={lesson}
                tab={tab}
                theme={theme}
                done={!!done[lesson.key]}
                toggleDone={() => toggleDone(lesson.key)}
                prev={inTab(allLessons[idx - 1])}
                next={inTab(allLessons[idx + 1])}
              />
            ) : tab ? (
              <TabOverview tab={tab} done={done} />
            ) : tabId === 'glossary' ? (
              <Glossary />
            ) : tabId === 'account' ? (
              <Account account={account} done={done} startMode={moduleId === 'create' ? 'signUp' : undefined} />
            ) : tabId === 'activity' ? (
              <Activity account={account} />
            ) : tabId === 'reset' ? (
              <ResetPassword />
            ) : tabId === 'privacy' ? (
              <Privacy />
            ) : (
              <Home done={done} pathsOnly={tabId === 'paths'} />
            )}
          </ErrorBoundary>
        </main>
      </div>

      {nudge && !signedIn && account.status !== 'unavailable' && (
        <SignupNudge count={Object.values(done).filter(Boolean).length} onCreate={() => setNudge(false)} onDismiss={dismissNudge} />
      )}

      <footer className="border-t border-line px-4 py-6 text-center text-sm text-muted">
        TechTeacher · {signedIn ? t('app.footerSavedAccount') : t('app.footerSaved')} ·{' '}
        <a className="underline" href="#/paths">{t('app.learningPaths')}</a> · <a className="underline" href="#/glossary">{t('app.glossary')}</a> ·{' '}
        <a className="underline" href="#/privacy">{t('privacy.link')}</a>
      </footer>
    </div>
  )
}
