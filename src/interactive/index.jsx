import { Suspense, lazy, useState } from 'react'
import { btn, btnPrimary } from '../lib/ui'
import ApiTester from './ApiTester'
import NeuralNet from './NeuralNet'
import Tokenizer from './Tokenizer'
import SubnetCalc from './SubnetCalc'
import Topology from './Topology'
import { Cipher, Hasher } from './Crypto'
import PacketViewer from './PacketViewer'
import Contrast from './Contrast'

// The editor bundle is large, so it only loads on lessons that use it.
const CodeRunner = lazy(() => import('./CodeRunner'))

function Quiz({ questions }) {
  const [picked, setPicked] = useState({})
  const [checked, setChecked] = useState({})
  const score = questions.filter((q, i) => checked[i] && picked[i] === q.answer).length
  const allChecked = questions.every((_, i) => checked[i])
  return (
    <div className="space-y-5">
      {questions.map((q, i) => {
        const right = picked[i] === q.answer
        return (
          <fieldset key={i}>
            <legend className="font-medium">{i + 1}. {q.q}</legend>
            <div className="mt-2 space-y-1.5">
              {q.options.map((o, j) => (
                <label key={j} className="flex cursor-pointer items-start gap-2 rounded-md border border-line bg-surface px-3 py-2 text-sm has-[:checked]:border-accent has-[:checked]:bg-accent-soft">
                  <input
                    type="radio"
                    name={`q${i}`}
                    className="mt-1 accent-[var(--accent)]"
                    checked={picked[i] === j}
                    disabled={checked[i]}
                    onChange={() => setPicked({ ...picked, [i]: j })}
                  />
                  <span>{o}</span>
                </label>
              ))}
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-3" aria-live="polite">
              {!checked[i] && (
                <button type="button" className={btnPrimary} disabled={picked[i] == null} onClick={() => setChecked({ ...checked, [i]: true })}>
                  Check answer
                </button>
              )}
              {checked[i] && (
                <p className="text-sm">
                  <strong className={right ? 'text-ok' : 'text-bad'}>{right ? '✓ Correct.' : `✗ Not quite. Answer: ${q.options[q.answer]}.`}</strong>{' '}
                  {q.explain}
                </p>
              )}
            </div>
          </fieldset>
        )
      })}
      {allChecked && (
        <p className="flex flex-wrap items-center gap-3 font-semibold" role="status">
          Score: {score} / {questions.length}
          <button type="button" className={btn} onClick={() => { setPicked({}); setChecked({}) }}>Try again</button>
        </p>
      )}
    </div>
  )
}

function shuffled(items) {
  const a = items.map((text, id) => ({ text, id }))
  if (a.length < 2) return a
  do {
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[a[i], a[j]] = [a[j], a[i]]
    }
  } while (a.every((x, i) => x.id === i))
  return a
}

// Drag-and-drop ordering, with up/down buttons as the keyboard and touch alternative.
function Order({ prompt, items }) {
  const [list, setList] = useState(() => shuffled(items))
  const [drag, setDrag] = useState(null)
  const [checked, setChecked] = useState(false)
  const move = (from, to) => {
    if (to < 0 || to >= list.length || from === to) return
    const n = [...list]
    n.splice(to, 0, n.splice(from, 1)[0])
    setList(n)
    setChecked(false)
  }
  const correct = list.every((x, i) => x.id === i)
  return (
    <div>
      <p className="font-medium">{prompt}</p>
      <p className="text-sm text-muted">Drag the items, or use the arrow buttons.</p>
      <ol className="mt-3 space-y-1.5">
        {list.map((x, i) => (
          <li
            key={x.id}
            draggable
            onDragStart={() => setDrag(i)}
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => { move(drag, i); setDrag(null) }}
            className={`flex cursor-grab items-center gap-2 rounded-md border-2 bg-surface px-3 py-2 text-sm ${
              checked ? (x.id === i ? 'border-ok' : 'border-bad') : 'border-line'
            }`}
          >
            <span aria-hidden="true" className="text-muted">⠿</span>
            <span className="flex-1">{x.text}</span>
            {checked && <span className={x.id === i ? 'text-ok' : 'text-bad'}>{x.id === i ? '✓ right spot' : '✗ move me'}</span>}
            <button type="button" className={btn} disabled={i === 0} onClick={() => move(i, i - 1)} aria-label={`Move "${x.text}" up`}>↑</button>
            <button type="button" className={btn} disabled={i === list.length - 1} onClick={() => move(i, i + 1)} aria-label={`Move "${x.text}" down`}>↓</button>
          </li>
        ))}
      </ol>
      <div className="mt-3 flex items-center gap-3" aria-live="polite">
        <button type="button" className={btnPrimary} onClick={() => setChecked(true)}>Check order</button>
        {checked && <strong className={correct ? 'text-ok' : 'text-bad'}>{correct ? '✓ Perfect order!' : 'Some items are out of place.'}</strong>}
      </div>
    </div>
  )
}

const TYPES = {
  quiz: Quiz,
  order: Order,
  code: CodeRunner,
  'api-tester': ApiTester,
  'neural-net': NeuralNet,
  tokenizer: Tokenizer,
  subnet: SubnetCalc,
  topology: Topology,
  hash: Hasher,
  cipher: Cipher,
  packets: PacketViewer,
  contrast: Contrast,
}

export default function Interactive({ spec, theme }) {
  const Type = TYPES[spec.type]
  if (!Type) return <p className="text-bad">Unknown interactive type: {spec.type}</p>
  return (
    <Suspense fallback={<p className="text-muted">Loading…</p>}>
      <Type {...spec} theme={theme} />
    </Suspense>
  )
}
