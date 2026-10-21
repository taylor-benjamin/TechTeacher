import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { btn, btnPrimary, field, input } from '../lib/ui'

const PRESETS = [
  { id: 'getPost', method: 'GET', url: 'https://jsonplaceholder.typicode.com/posts/1' },
  { id: 'todos', method: 'GET', url: 'https://jsonplaceholder.typicode.com/todos?userId=1' },
  { id: 'create', method: 'POST', url: 'https://jsonplaceholder.typicode.com/posts', body: '{\n  "title": "Hello API",\n  "body": "My first POST request",\n  "userId": 1\n}' },
  { id: 'update', method: 'PUT', url: 'https://jsonplaceholder.typicode.com/posts/1', body: '{\n  "id": 1,\n  "title": "Updated title",\n  "body": "Replaced",\n  "userId": 1\n}' },
  { id: 'delete', method: 'DELETE', url: 'https://jsonplaceholder.typicode.com/posts/1' },
  { id: 'notFound', method: 'GET', url: 'https://jsonplaceholder.typicode.com/posts/99999' },
  { id: 'github', method: 'GET', url: 'https://api.github.com/users/octocat' },
]

export default function ApiTester() {
  const { t } = useTranslation()
  const [method, setMethod] = useState('GET')
  const [url, setUrl] = useState(PRESETS[0].url)
  const [body, setBody] = useState('')
  const [res, setRes] = useState(null)
  const [busy, setBusy] = useState(false)
  const hasBody = !['GET', 'DELETE'].includes(method)

  async function send(e) {
    e.preventDefault()
    setBusy(true)
    setRes(null)
    const started = performance.now()
    try {
      const r = await fetch(url, {
        method,
        headers: hasBody ? { 'Content-Type': 'application/json' } : undefined,
        body: hasBody && body ? body : undefined,
      })
      const text = await r.text()
      let pretty = text
      try { pretty = JSON.stringify(JSON.parse(text), null, 2) } catch {}
      setRes({ status: r.status, statusText: r.statusText, ms: Math.round(performance.now() - started), type: r.headers.get('content-type'), body: pretty })
    } catch (err) {
      setRes({ error: t('api.failed', { message: err.message }) })
    }
    setBusy(false)
  }

  return (
    <form onSubmit={send} className="space-y-3">
      <div className="flex flex-wrap gap-1.5" role="group" aria-label={t('api.examples')}>
        {PRESETS.map((p) => (
          <button key={p.id} type="button" className={btn} onClick={() => { setMethod(p.method); setUrl(p.url); setBody(p.body ?? '') }}>
            {t(`api.presets.${p.id}`)}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        <label className="sr-only" htmlFor="api-method">{t('api.method')}</label>
        <select id="api-method" className={`${input} font-mono font-semibold`} value={method} onChange={(e) => setMethod(e.target.value)}>
          {['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].map((m) => <option key={m}>{m}</option>)}
        </select>
        <label className="sr-only" htmlFor="api-url">{t('api.url')}</label>
        <input id="api-url" type="url" required className={`${input} min-w-0 flex-1 font-mono`} value={url} onChange={(e) => setUrl(e.target.value)} />
        <button className={btnPrimary} disabled={busy}>{busy ? t('api.sending') : t('api.send')}</button>
      </div>
      {hasBody && (
        <div>
          <label htmlFor="api-body" className="text-sm font-medium">{t('api.body')}</label>
          <textarea id="api-body" rows={5} className={`${field} mt-1 block w-full font-mono`} value={body} onChange={(e) => setBody(e.target.value)} spellCheck={false} />
        </div>
      )}
      <div aria-live="polite">
        {res?.error && <p className="rounded-md border border-bad p-3 text-sm text-bad">{res.error}</p>}
        {res && !res.error && (
          <div className="rounded-lg border border-line">
            <p className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-line bg-surface px-3 py-2 text-sm">
              <strong className={res.status < 400 ? 'text-ok' : 'text-bad'}>{res.status} {res.statusText}</strong>
              <span>{t(`api.meaning.${Math.floor(res.status / 100)}`, { defaultValue: '' })}</span>
              <span className="text-muted">{res.ms} ms</span>
              <span className="text-muted">{res.type}</span>
            </p>
            <pre className="max-h-80 overflow-auto p-3 font-mono text-sm" tabIndex={0} aria-label={t('api.response')}>{res.body || t('api.empty')}</pre>
          </div>
        )}
      </div>
    </form>
  )
}
