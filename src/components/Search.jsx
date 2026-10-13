import { useEffect, useRef, useState } from 'react'
import { searchLessons, tabById } from '../lib/content'
import { LEVELS, href, input } from '../lib/ui'

export default function Search() {
  const [q, setQ] = useState('')
  const [open, setOpen] = useState(false)
  const box = useRef(null)
  const field = useRef(null)
  const results = searchLessons(q)

  useEffect(() => {
    const onKey = (e) => {
      const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName) || e.target.isContentEditable
      if ((e.key === '/' && !typing) || (e.key === 'k' && (e.ctrlKey || e.metaKey))) {
        e.preventDefault()
        field.current?.focus()
      }
    }
    const onDown = (e) => !box.current?.contains(e.target) && setOpen(false)
    const onHash = () => setOpen(false)
    addEventListener('keydown', onKey)
    addEventListener('pointerdown', onDown)
    addEventListener('hashchange', onHash)
    return () => {
      removeEventListener('keydown', onKey)
      removeEventListener('pointerdown', onDown)
      removeEventListener('hashchange', onHash)
    }
  }, [])

  return (
    <div ref={box} className="relative" role="search" onKeyDown={(e) => e.key === 'Escape' && setOpen(false)}>
      <label htmlFor="global-search" className="sr-only">Search all lessons</label>
      <input
        id="global-search"
        ref={field}
        type="search"
        autoComplete="off"
        placeholder="Search lessons"
        title="Press / or Ctrl+K to search"
        aria-keyshortcuts="/ Control+K"
        className={`${input} w-36 min-[400px]:w-44 sm:w-56`}
        value={q}
        onChange={(e) => { setQ(e.target.value); setOpen(true) }}
        onFocus={() => setOpen(true)}
      />
      {open && q.trim() && (
        <div className="absolute right-0 top-full z-50 mt-1 max-h-[70vh] w-[min(24rem,calc(100vw-2rem))] overflow-y-auto rounded-lg border border-line bg-panel p-1 shadow-xl">
          <p className="px-2 py-1 text-xs text-muted" aria-live="polite">
            {results.length ? `${results.length} result${results.length > 1 ? 's' : ''}` : 'No lessons match.'}
          </p>
          <ul>
            {results.map((l) => (
              <li key={l.key} data-tab={l.tabId}>
                <a href={href(l.key)} className="block rounded-md border-l-4 border-accent px-2 py-1.5 hover:bg-accent-soft">
                  <span className="block text-sm font-semibold">{l.title}</span>
                  <span className="block text-xs text-muted">
                    {tabById[l.tabId].title} · {l.moduleTitle} · {LEVELS[l.level].label}
                  </span>
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
