import { useRef, useState } from 'react'
import { btn, btnPrimary, input } from '../lib/ui'

const DATA = [[0, 0], [0, 1], [1, 0], [1, 1]]
const TARGETS = { XOR: [0, 1, 1, 0], AND: [0, 0, 0, 1], OR: [0, 1, 1, 1] }
const H = 4
const sigmoid = (z) => 1 / (1 + Math.exp(-z))
const rand = () => Math.random() * 2 - 1

const init = () => ({
  w1: Array.from({ length: H }, () => [rand(), rand()]), // input -> hidden
  b1: Array.from({ length: H }, rand),
  w2: Array.from({ length: H }, rand), // hidden -> output
  b2: rand(),
})

function forward(net, x) {
  const h = net.w1.map((w, j) => Math.tanh(w[0] * x[0] + w[1] * x[1] + net.b1[j]))
  const y = sigmoid(h.reduce((s, v, j) => s + v * net.w2[j], net.b2))
  return { h, y }
}

// One step of gradient descent over all four examples.
function trainStep(net, targets, lr) {
  const g = { w1: net.w1.map(() => [0, 0]), b1: Array(H).fill(0), w2: Array(H).fill(0), b2: 0 }
  DATA.forEach((x, n) => {
    const { h, y } = forward(net, x)
    const dOut = y - targets[n]
    g.b2 += dOut
    h.forEach((hv, j) => {
      g.w2[j] += dOut * hv
      const dH = dOut * net.w2[j] * (1 - hv * hv)
      g.b1[j] += dH
      g.w1[j][0] += dH * x[0]
      g.w1[j][1] += dH * x[1]
    })
  })
  net.b2 -= lr * g.b2
  for (let j = 0; j < H; j++) {
    net.w2[j] -= lr * g.w2[j]
    net.b1[j] -= lr * g.b1[j]
    net.w1[j][0] -= lr * g.w1[j][0]
    net.w1[j][1] -= lr * g.w1[j][1]
  }
}

const loss = (net, t) => DATA.reduce((s, x, n) => s + (forward(net, x).y - t[n]) ** 2, 0) / 4

export default function NeuralNet() {
  const net = useRef(null)
  net.current ??= init()
  const [task, setTask] = useState('XOR')
  const [lr, setLr] = useState(0.5)
  const [epochs, setEpochs] = useState(0)
  const [probe, setProbe] = useState(1)
  const targets = TARGETS[task]

  const train = (n) => {
    for (let i = 0; i < n; i++) trainStep(net.current, targets, lr)
    setEpochs((e) => e + n)
  }
  const reset = () => {
    net.current = init()
    setEpochs(0)
  }

  const { h, y } = forward(net.current, DATA[probe])
  const inY = [98, 174]
  const hidY = [52, 108, 164, 220]
  const outY = 136
  // Thickness = strength. Solid = positive, dashed = negative (so colour is not the only cue).
  const edge = (w, x1, y1, x2, y2, key) => (
    <line key={key} x1={x1} y1={y1} x2={x2} y2={y2} stroke={w >= 0 ? 'var(--accent-ink)' : 'var(--bad)'}
      strokeWidth={Math.min(7, 0.6 + Math.abs(w) * 1.4)} strokeDasharray={w >= 0 ? undefined : '6 4'} opacity="0.8" />
  )
  const node = (x, yy, value, label) => (
    <g key={label}>
      <circle cx={x} cy={yy} r="21" fill="var(--panel)" stroke="var(--ink)" strokeWidth="2" />
      <circle cx={x} cy={yy} r="21" fill="var(--accent)" opacity={Math.min(1, Math.abs(value)) * 0.35} />
      <text x={x} y={yy + 4} textAnchor="middle" fontSize="12" fontWeight="700" fill="var(--ink)">{value.toFixed(2)}</text>
      <title>{label}</title>
    </g>
  )

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <label className="text-sm font-medium">
          Task to learn
          <select className={`${input} mt-1 block`} value={task} onChange={(e) => { setTask(e.target.value); reset() }}>
            {Object.keys(TARGETS).map((t) => <option key={t}>{t}</option>)}
          </select>
        </label>
        <label className="text-sm font-medium">
          Learning rate: {lr}
          <input type="range" min="0.05" max="2" step="0.05" value={lr} onChange={(e) => setLr(+e.target.value)} className="mt-2 block w-36 accent-[var(--accent)]" />
        </label>
        <button type="button" className={btn} onClick={() => train(1)}>Train 1 step</button>
        <button type="button" className={btnPrimary} onClick={() => train(100)}>Train 100 steps</button>
        <button type="button" className={btn} onClick={reset}>Reset weights</button>
      </div>

      <div className="grid gap-4 md:grid-cols-[1fr_auto]">
        <svg viewBox="0 0 420 250" className="w-full max-w-xl" role="img"
          aria-label={`Network with 2 inputs, ${H} hidden neurons and 1 output. Current output ${y.toFixed(2)}.`}>
          {net.current.w1.flatMap((w, j) => [edge(w[0], 60, inY[0], 210, hidY[j], `a${j}`), edge(w[1], 60, inY[1], 210, hidY[j], `b${j}`)])}
          {net.current.w2.map((w, j) => edge(w, 210, hidY[j], 360, outY, `c${j}`))}
          {node(60, inY[0], DATA[probe][0], 'Input x1')}
          {node(60, inY[1], DATA[probe][1], 'Input x2')}
          {h.map((v, j) => node(210, hidY[j], v, `Hidden neuron ${j + 1}`))}
          {node(360, outY, y, 'Output')}
          <text x="60" y="16" textAnchor="middle" fontSize="12" fill="var(--muted)">inputs</text>
          <text x="210" y="16" textAnchor="middle" fontSize="12" fill="var(--muted)">hidden layer</text>
          <text x="360" y="16" textAnchor="middle" fontSize="12" fill="var(--muted)">output</text>
        </svg>

        <div className="text-sm">
          <p aria-live="polite">
            <strong>Steps trained:</strong> {epochs}<br />
            <strong>Loss (error):</strong> {loss(net.current, targets).toFixed(4)}
          </p>
          <table className="mt-2 border-collapse text-center">
            <caption className="mb-1 text-left text-muted">Pick a row to send it through the network</caption>
            <thead>
              <tr>{['x1', 'x2', 'want', 'got', ''].map((c) => <th key={c} scope="col" className="border border-line px-2 py-1">{c}</th>)}</tr>
            </thead>
            <tbody>
              {DATA.map((x, n) => {
                const got = forward(net.current, x).y
                const ok = Math.round(got) === targets[n]
                return (
                  <tr key={n} className={n === probe ? 'bg-accent-soft' : ''}>
                    <td className="border border-line px-2 py-1">{x[0]}</td>
                    <td className="border border-line px-2 py-1">{x[1]}</td>
                    <td className="border border-line px-2 py-1">{targets[n]}</td>
                    <td className={`border border-line px-2 py-1 font-mono ${ok ? 'text-ok' : 'text-bad'}`}>{got.toFixed(2)} {ok ? '✓' : '✗'}</td>
                    <td className="border border-line px-1 py-1">
                      <button type="button" className={btn} aria-pressed={n === probe} onClick={() => setProbe(n)}>Show</button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
      <p className="text-sm text-muted">
        Line thickness is weight strength; solid lines are positive weights and dashed lines are negative. Numbers inside circles are each neuron’s activation for the selected row.
      </p>
    </div>
  )
}
