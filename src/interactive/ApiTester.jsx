import { useState } from 'react'
import { btn, btnPrimary, field, input } from '../lib/ui'

const PRESETS = [
  { label: 'Get one post', method: 'GET', url: 'https://jsonplaceholder.typicode.com/posts/1' },
  { label: 'List a user’s todos', method: 'GET', url: 'https://jsonplaceholder.typicode.com/todos?userId=1' },
  { label: 'Create a post', method: 'POST', url: 'https://jsonplaceholder.typicode.com/posts', body: '{\n  "title": "Hello API",\n  "body": "My first POST request",\n  "userId": 1\n}' },
  { label: 'Update a post', method: 'PUT', url: 'https://jsonplaceholder.typicode.com/posts/1', body: '{\n  "id": 1,\n  "title": "Updated title",\n  "body": "Replaced",\n  "userId": 1\n}' },
  { label: 'Delete a post', method: 'DELETE', url: 'https://jsonplaceholder.typicode.com/posts/1' },
  { label: 'Trigger a 404', method: 'GET', url: 'https://jsonplaceholder.typicode.com/posts/99999' },
  { label: 'GitHub user', method: 'GET', url: 'https://api.github.com/users/octocat' },
]

const MEANING = { 2: 'Success', 3: 'Redirect', 4: 'Client error: the request was wrong', 5: 'Server error: the server failed' }

export default function ApiTester() {
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
      setRes({ error: `${err.message}. The request never got a response: the URL may be wrong, you may be offline, or the API does not allow browser calls (CORS).` })
    }
    setBusy(false)
  }

  return (
    <form onSubmit={send} className="space-y-3">
      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Example requests">
        {PRESETS.map((p) => (
          <button key={p.label} type="button" className={btn} onClick={() => { setMethod(p.method); setUrl(p.url); setBody(p.body ?? '') }}>
            {p.label}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        <label className="sr-only" htmlFor="api-method">HTTP method</label>
        <select id="api-method" className={`${input} font-mono font-semibold`} value={method} onChange={(e) => setMethod(e.target.value)}>
          {['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].map((m) => <option key={m}>{m}</option>)}
        </select>
        <label className="sr-only" htmlFor="api-url">Request URL</label>
        <input id="api-url" type="url" required className={`${input} min-w-0 flex-1 font-mono`} value={url} onChange={(e) => setUrl(e.target.value)} />
        <button className={btnPrimary} disabled={busy}>{busy ? 'Sending…' : 'Send'}</button>
      </div>
      {hasBody && (
        <div>
          <label htmlFor="api-body" className="text-sm font-medium">Request body (JSON)</label>
          <textarea id="api-body" rows={5} className={`${field} mt-1 block w-full font-mono`} value={body} onChange={(e) => setBody(e.target.value)} spellCheck={false} />
        </div>
      )}
      <div aria-live="polite">
        {res?.error && <p className="rounded-md border border-bad p-3 text-sm text-bad">{res.error}</p>}
        {res && !res.error && (
          <div className="rounded-lg border border-line">
            <p className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-line bg-surface px-3 py-2 text-sm">
              <strong className={res.status < 400 ? 'text-ok' : 'text-bad'}>{res.status} {res.statusText}</strong>
              <span>{MEANING[Math.floor(res.status / 100)]}</span>
              <span className="text-muted">{res.ms} ms</span>
              <span className="text-muted">{res.type}</span>
            </p>
            <pre className="max-h-80 overflow-auto p-3 font-mono text-sm" tabIndex={0} aria-label="Response body">{res.body || '(empty body)'}</pre>
          </div>
        )}
      </div>
    </form>
  )
}
