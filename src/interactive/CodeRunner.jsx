import { useEffect, useRef, useState } from 'react'
import CodeMirror from '@uiw/react-codemirror'
import { javascript } from '@codemirror/lang-javascript'
import { python } from '@codemirror/lang-python'
import { html } from '@codemirror/lang-html'
import { sql } from '@codemirror/lang-sql'
import { java } from '@codemirror/lang-java'
import { StreamLanguage } from '@codemirror/language'
import { csharp } from '@codemirror/legacy-modes/mode/clike'
import { shell } from '@codemirror/legacy-modes/mode/shell'
import i18n from '../i18n'
import { useTranslation } from 'react-i18next'
import { btn, btnPrimary } from '../lib/ui'
import { runBash } from './bashSim'

const PYODIDE = 'https://cdn.jsdelivr.net/pyodide/v0.26.4/full/'
const SQLJS = 'https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.10.3/'
// Optional: point this at a self-hosted Piston server to really run Java and C#.
const PISTON = import.meta.env.VITE_PISTON_URL

const LANGS = {
  javascript: { label: 'JavaScript', ext: () => javascript() },
  node: { label: 'Node.js', ext: () => javascript() },
  python: { label: 'Python', ext: () => python() },
  sql: { label: 'SQL', ext: () => sql() },
  html: { label: 'HTML + CSS', ext: () => html() },
  bash: { label: 'Bash', ext: () => StreamLanguage.define(shell) },
  java: { label: 'Java', ext: () => java(), remote: 'java' },
  csharp: { label: 'C#', ext: () => StreamLanguage.define(csharp), remote: 'csharp' },
}

const scripts = {}
const loadScript = (src) =>
  (scripts[src] ??= new Promise((resolve, reject) => {
    const s = document.createElement('script')
    s.src = src
    s.onload = resolve
    s.onerror = () => {
      delete scripts[src]
      reject(new Error(i18n.t('code.download')))
    }
    document.head.appendChild(s)
  }))

let worker
function runJs(code, push) {
  worker?.terminate()
  return new Promise((resolve) => {
    // Served from its own file so it gets its own, narrower security policy (see worker/headers.js).
    const w = (worker = new Worker('/js-runner.js'))
    // Kill runaway loops. Timers scheduled by the code may keep logging until then.
    const timer = setTimeout(() => {
      w.terminate()
      push({ kind: 'err', text: i18n.t('code.timeout') })
      resolve()
    }, 8000)
    w.onmessage = ({ data }) => {
      if (data.kind !== 'done') return push(data)
      clearTimeout(timer)
      setTimeout(() => w.terminate(), 4000)
      resolve()
    }
    w.postMessage(code)
  })
}

let pyodide
async function runPython(code, push) {
  if (!pyodide) {
    push({ kind: 'note', text: i18n.t('code.loadingPython') })
    await loadScript(PYODIDE + 'pyodide.js')
    pyodide = await window.loadPyodide({ indexURL: PYODIDE })
  }
  pyodide.setStdout({ batched: (text) => push({ kind: 'out', text }) })
  pyodide.setStderr({ batched: (text) => push({ kind: 'err', text }) })
  try {
    await pyodide.runPythonAsync(code)
  } catch (e) {
    // Show the last lines of the traceback: the part a learner needs.
    push({ kind: 'err', text: String(e.message).trim().split('\n').slice(-4).join('\n') })
  }
}

let SQL
async function runSql(code, push, seed) {
  if (!SQL) {
    push({ kind: 'note', text: i18n.t('code.loadingSql') })
    await loadScript(SQLJS + 'sql-wasm.js')
    SQL = await window.initSqlJs({ locateFile: (f) => SQLJS + f })
  }
  const db = new SQL.Database()
  try {
    if (seed) db.run(seed)
    const results = db.exec(code)
    if (!results.length) push({ kind: 'note', text: i18n.t('code.noRows') })
    results.forEach((r) => push({ kind: 'table', ...r }))
  } catch (e) {
    push({ kind: 'err', text: String(e.message) })
  } finally {
    db.close()
  }
}

async function runRemote(lang, code, push, expected) {
  if (!PISTON) {
    push({ kind: 'note', text: i18n.t('code.expectedNote') })
    return push({ kind: 'out', text: expected ?? i18n.t('code.noExpected') })
  }
  const res = await fetch(PISTON.replace(/\/$/, '') + '/api/v2/execute', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ language: lang, version: '*', files: [{ content: code }] }),
  })
  const { run, compile, message } = await res.json()
  if (message) return push({ kind: 'err', text: message })
  if (compile?.stderr) push({ kind: 'err', text: compile.stderr })
  if (run?.stdout) push({ kind: 'out', text: run.stdout })
  if (run?.stderr) push({ kind: 'err', text: run.stderr })
}

// The learner's HTML runs in /html-preview.html, a sandboxed page with its own relaxed security policy,
// so their inline scripts work without loosening the policy for the rest of the site.
function HtmlPreview({ code, title }) {
  const frame = useRef(null)
  const [ready, setReady] = useState(false)
  useEffect(() => {
    const onMessage = (e) => e.source === frame.current?.contentWindow && e.data === 'preview-ready' && setReady(true)
    addEventListener('message', onMessage)
    return () => removeEventListener('message', onMessage)
  }, [])
  useEffect(() => {
    // The sandboxed page has an opaque origin, so '*' is the only target that reaches it.
    if (ready) frame.current?.contentWindow?.postMessage(code, '*')
  }, [ready, code])
  return <iframe ref={frame} title={title} sandbox="allow-scripts" src="/html-preview.html" className="h-72 w-full border-t border-line bg-white" />
}

export default function CodeRunner({ language = 'javascript', starter = '', expected, seed, theme }) {
  const { t } = useTranslation()
  const lang = LANGS[language] ?? LANGS.javascript
  const [code, setCode] = useState(starter)
  const [output, setOutput] = useState([])
  const [running, setRunning] = useState(false)
  const alive = useRef(true)
  useEffect(() => () => { alive.current = false; worker?.terminate() }, [])

  const isHtml = language === 'html'
  const offline = lang.remote && !PISTON

  async function run() {
    setOutput([])
    setRunning(true)
    const push = (item) => alive.current && setOutput((o) => [...o, item])
    try {
      if (lang.remote) await runRemote(lang.remote, code, push, expected)
      else if (language === 'python') await runPython(code, push)
      else if (language === 'sql') await runSql(code, push, seed)
      else if (language === 'bash') runBash(code).forEach(push)
      else await runJs(code, push)
    } catch (e) {
      push({ kind: 'err', text: String(e.message ?? e) })
    }
    if (alive.current) setRunning(false)
  }

  return (
    <div className="overflow-hidden rounded-lg border border-edge">
      <div className="flex flex-wrap items-center gap-2 border-b border-line bg-surface px-3 py-2">
        <span className="rounded bg-accent px-2 py-0.5 text-xs font-semibold text-on-accent">{lang.label}</span>
        <span className="flex-1 text-xs text-muted">{t('code.escape')}</span>
        <button type="button" className={btn} onClick={() => { setCode(starter); setOutput([]) }}>{t('code.reset')}</button>
        {!isHtml && (
          <button type="button" className={btnPrimary} onClick={run} disabled={running}>
            {running ? t('code.running') : offline ? t('code.showExpected') : t('code.run')}
          </button>
        )}
      </div>
      <CodeMirror
        value={code}
        onChange={setCode}
        extensions={[lang.ext()]}
        theme={theme === 'dark' ? 'dark' : 'light'}
        minHeight="120px"
        maxHeight="420px"
        aria-label={t('code.editor', { lang: lang.label })}
        basicSetup={{ foldGutter: false }}
      />
      <p className="border-t border-line bg-surface px-3 py-1.5 text-xs text-muted">
        {offline
          ? t('code.offline', { lang: lang.label, sdk: language === 'java' ? 'JDK' : '.NET SDK' })
          : t(`code.where.${language in LANGS ? language : 'javascript'}`)}
      </p>
      {isHtml ? (
        <HtmlPreview code={code} title={t('code.preview')} />
      ) : (
        <div className="max-h-80 min-h-16 overflow-auto border-t border-line bg-panel p-3 font-mono text-sm" role="log" aria-label={t('code.output')} aria-live="polite">
          {!output.length && <span className="text-muted">{running ? '' : t('code.placeholder')}</span>}
          {output.map((o, i) =>
            o.kind === 'table' ? (
              <table key={i} className="mb-3 border-collapse text-left">
                <thead>
                  <tr>{o.columns.map((c) => <th key={c} scope="col" className="border border-line bg-accent-soft px-2 py-1">{c}</th>)}</tr>
                </thead>
                <tbody>
                  {o.values.map((row, r) => (
                    <tr key={r}>{row.map((v, c) => <td key={c} className="border border-line px-2 py-1">{v === null ? 'NULL' : String(v)}</td>)}</tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <pre key={i} className={`whitespace-pre-wrap ${o.kind === 'err' ? 'text-bad' : o.kind === 'note' ? 'text-muted italic' : ''}`}>{o.text}</pre>
            ),
          )}
        </div>
      )}
    </div>
  )
}
