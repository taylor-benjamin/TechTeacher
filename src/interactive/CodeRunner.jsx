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
import { btn, btnPrimary } from '../lib/ui'
import { runBash } from './bashSim'

const PYODIDE = 'https://cdn.jsdelivr.net/pyodide/v0.26.4/full/'
const SQLJS = 'https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.10.3/'
// Optional: point this at a self-hosted Piston server to really run Java and C#.
const PISTON = import.meta.env.VITE_PISTON_URL

const LANGS = {
  javascript: { label: 'JavaScript', ext: () => javascript(), where: 'Runs in your browser in a sandboxed worker.' },
  node: { label: 'Node.js', ext: () => javascript(), where: 'Runs in your browser’s JavaScript engine, so Node-only modules such as fs and http are not available here.' },
  python: { label: 'Python', ext: () => python(), where: 'Runs in your browser with Pyodide (the first run downloads about 10 MB).' },
  sql: { label: 'SQL', ext: () => sql(), where: 'Runs in your browser on an in-memory SQLite database that resets on every run.' },
  html: { label: 'HTML + CSS', ext: () => html(), where: 'The preview updates as you type.' },
  bash: { label: 'Bash', ext: () => StreamLanguage.define(shell), where: 'Runs in a simulated shell with a small practice file system. It supports common commands, pipes, redirects, variables, for and if.' },
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
      reject(new Error('Could not download the runtime. Check your internet connection and try again.'))
    }
    document.head.appendChild(s)
  }))

const WORKER = `
const fmt = (v) => { if (typeof v === 'string') return v; try { return JSON.stringify(v, null, 2) ?? String(v) } catch { return String(v) } };
const send = (kind, args) => postMessage({ kind, text: args.map(fmt).join(' ') });
console.log = console.info = console.debug = (...a) => send('out', a);
console.warn = console.error = (...a) => send('err', a);
console.table = (v) => send('out', [v]);
onmessage = async (e) => {
  try { await new (Object.getPrototypeOf(async function () {}).constructor)(e.data)() }
  catch (err) { send('err', [String(err)]) }
  postMessage({ kind: 'done' })
};`

let worker
function runJs(code, push) {
  worker?.terminate()
  return new Promise((resolve) => {
    const w = (worker = new Worker(URL.createObjectURL(new Blob([WORKER], { type: 'text/javascript' }))))
    // Kill runaway loops. Timers scheduled by the code may keep logging until then.
    const timer = setTimeout(() => {
      w.terminate()
      push({ kind: 'err', text: 'Stopped after 8 seconds (infinite loop?).' })
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
    push({ kind: 'note', text: 'Loading Python…' })
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
    push({ kind: 'note', text: 'Loading SQLite…' })
    await loadScript(SQLJS + 'sql-wasm.js')
    SQL = await window.initSqlJs({ locateFile: (f) => SQLJS + f })
  }
  const db = new SQL.Database()
  try {
    if (seed) db.run(seed)
    const results = db.exec(code)
    if (!results.length) push({ kind: 'note', text: 'Statement ran. No rows to show.' })
    results.forEach((r) => push({ kind: 'table', ...r }))
  } catch (e) {
    push({ kind: 'err', text: String(e.message) })
  } finally {
    db.close()
  }
}

async function runRemote(lang, code, push, expected) {
  if (!PISTON) {
    push({ kind: 'note', text: 'Expected output of the original program (your edits are not compiled):' })
    return push({ kind: 'out', text: expected ?? '(no expected output was provided for this snippet)' })
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

export default function CodeRunner({ language = 'javascript', starter = '', expected, seed, theme }) {
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
        <span className="flex-1 text-xs text-muted">Press Esc then Tab to leave the editor.</span>
        <button type="button" className={btn} onClick={() => { setCode(starter); setOutput([]) }}>Reset</button>
        {!isHtml && (
          <button type="button" className={btnPrimary} onClick={run} disabled={running}>
            {running ? 'Running…' : offline ? 'Show expected output' : '▶ Run'}
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
        aria-label={`${lang.label} code editor`}
        basicSetup={{ foldGutter: false }}
      />
      <p className="border-t border-line bg-surface px-3 py-1.5 text-xs text-muted">
        {offline
          ? `Browsers cannot compile ${lang.label}, so this editor is for reading and practice. To run your own edits, install the ${language === 'java' ? 'JDK' : '.NET SDK'} locally or paste the code into an online compiler.`
          : lang.where}
      </p>
      {isHtml ? (
        <iframe title="Live preview" sandbox="allow-scripts" srcDoc={code} className="h-72 w-full border-t border-line bg-white" />
      ) : (
        <div className="max-h-80 min-h-16 overflow-auto border-t border-line bg-panel p-3 font-mono text-sm" role="log" aria-label="Program output" aria-live="polite">
          {!output.length && <span className="text-muted">{running ? '' : 'Output appears here.'}</span>}
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
