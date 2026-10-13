import { useRef, useState } from 'react'
import { useStored } from '../lib/store'
import { btn, btnPrimary } from '../lib/ui'

const DEVICES = {
  internet: { label: 'Internet', icon: '🌐' },
  firewall: { label: 'Firewall', icon: '🧱' },
  router: { label: 'Router', icon: '📡' },
  switch: { label: 'Switch', icon: '🔀' },
  ap: { label: 'Wi-Fi AP', icon: '📶' },
  server: { label: 'Server', icon: '🗄️' },
  nas: { label: 'NAS', icon: '💾' },
  pc: { label: 'PC', icon: '💻' },
}

const SAMPLE = {
  nodes: [
    { id: 1, type: 'internet', x: 20, y: 150, label: 'Internet (ISP)' },
    { id: 2, type: 'firewall', x: 150, y: 150, label: 'pfSense' },
    { id: 3, type: 'switch', x: 290, y: 150, label: 'Managed switch' },
    { id: 4, type: 'server', x: 440, y: 40, label: 'Proxmox host' },
    { id: 5, type: 'nas', x: 440, y: 150, label: 'NAS' },
    { id: 6, type: 'ap', x: 440, y: 260, label: 'Wi-Fi AP' },
    { id: 7, type: 'pc', x: 290, y: 280, label: 'Admin PC' },
  ],
  links: [[1, 2], [2, 3], [3, 4], [3, 5], [3, 6], [3, 7]],
}

const W = 78 // node box size, used to centre link lines
const CANVAS = { w: 620, h: 360 }

export default function Topology() {
  const [topo, setTopo] = useStored('tt.topology', { nodes: [], links: [] })
  const [selected, setSelected] = useState(null)
  const [connecting, setConnecting] = useState(false)
  const [status, setStatus] = useState('Drag devices onto the canvas, or click a device to add it.')
  const canvas = useRef(null)
  const drag = useRef(null)
  const { nodes, links } = topo

  const clamp = (x, y) => ({ x: Math.max(0, Math.min(CANVAS.w - W, x)), y: Math.max(0, Math.min(CANVAS.h - W, y)) })
  const add = (type, x, y) => {
    const id = Math.max(0, ...nodes.map((n) => n.id)) + 1
    const pos = x == null ? { x: 30 + ((id * 90) % 520), y: 30 + ((id * 60) % 260) } : clamp(x, y)
    setTopo({ nodes: [...nodes, { id, type, label: DEVICES[type].label, ...pos }], links })
    setSelected(id)
    setStatus(`Added ${DEVICES[type].label}.`)
  }
  const moveNode = (id, x, y) => setTopo((t) => ({ ...t, nodes: t.nodes.map((n) => (n.id === id ? { ...n, ...clamp(x, y) } : n)) }))
  const remove = (id) => {
    setTopo({ nodes: nodes.filter((n) => n.id !== id), links: links.filter((l) => !l.includes(id)) })
    setSelected(null)
    setStatus('Device removed.')
  }
  const name = (id) => nodes.find((n) => n.id === id)?.label

  function pick(id) {
    if (connecting && selected && selected !== id) {
      const exists = links.some((l) => l.includes(selected) && l.includes(id))
      if (!exists) setTopo({ nodes, links: [...links, [selected, id]] })
      setStatus(exists ? 'Those devices are already connected.' : `Connected ${name(selected)} to ${name(id)}.`)
      setConnecting(false)
    } else if (connecting) setStatus(`Now pick the device to connect ${name(id)} to.`)
    setSelected(id)
  }

  const onPointerDown = (e, n) => {
    e.currentTarget.setPointerCapture(e.pointerId)
    drag.current = { id: n.id, dx: e.clientX - n.x, dy: e.clientY - n.y }
  }
  const onPointerMove = (e) => drag.current && moveNode(drag.current.id, e.clientX - drag.current.dx, e.clientY - drag.current.dy)
  const onKey = (e, n) => {
    const d = { ArrowLeft: [-10, 0], ArrowRight: [10, 0], ArrowUp: [0, -10], ArrowDown: [0, 10] }[e.key]
    if (d) {
      e.preventDefault()
      moveNode(n.id, n.x + d[0], n.y + d[1])
    } else if (e.key === 'Delete' || e.key === 'Backspace') remove(n.id)
  }
  const onDrop = (e) => {
    e.preventDefault()
    const type = e.dataTransfer.getData('text/plain')
    if (!DEVICES[type]) return
    const r = canvas.current.getBoundingClientRect()
    add(type, e.clientX - r.left - W / 2, e.clientY - r.top - W / 2)
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Devices to add">
        {Object.entries(DEVICES).map(([type, d]) => (
          <button key={type} type="button" draggable className={`${btn} cursor-grab`}
            onDragStart={(e) => e.dataTransfer.setData('text/plain', type)} onClick={() => add(type)}>
            <span aria-hidden="true">{d.icon}</span> {d.label}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        <button type="button" className={connecting ? btnPrimary : btn} aria-pressed={connecting} disabled={nodes.length < 2}
          onClick={() => { setConnecting(!connecting); setStatus(connecting ? 'Connect cancelled.' : selected ? `Pick the device to connect ${name(selected)} to.` : 'Pick the first device.') }}>
          🔗 {connecting ? 'Connecting… (cancel)' : 'Connect devices'}
        </button>
        <button type="button" className={btn} disabled={!selected} onClick={() => remove(selected)}>Delete selected</button>
        <button type="button" className={btn} onClick={() => { setTopo(SAMPLE); setSelected(null); setStatus('Loaded the sample home lab.') }}>Load sample home lab</button>
        <button type="button" className={btn} onClick={() => { setTopo({ nodes: [], links: [] }); setSelected(null); setStatus('Canvas cleared.') }}>Clear</button>
      </div>
      <p className="text-sm text-muted" role="status">{status}</p>

      <div className="overflow-auto rounded-lg border-2 border-dashed border-edge bg-surface">
        <div ref={canvas} className="relative" style={{ width: CANVAS.w, height: CANVAS.h }}
          onDragOver={(e) => e.preventDefault()} onDrop={onDrop}>
          <svg className="pointer-events-none absolute inset-0" width={CANVAS.w} height={CANVAS.h} aria-hidden="true">
            {links.map(([a, b]) => {
              const A = nodes.find((n) => n.id === a)
              const B = nodes.find((n) => n.id === b)
              return A && B && <line key={`${a}-${b}`} x1={A.x + W / 2} y1={A.y + W / 2} x2={B.x + W / 2} y2={B.y + W / 2} stroke="var(--accent-ink)" strokeWidth="3" />
            })}
          </svg>
          {nodes.map((n) => (
            <button key={n.id} type="button" aria-pressed={selected === n.id}
              aria-label={`${n.label}. Arrow keys move, Delete removes.`}
              style={{ left: n.x, top: n.y, width: W, height: W, touchAction: 'none' }}
              className={`absolute flex cursor-grab flex-col items-center justify-center rounded-lg border-2 bg-panel p-1 text-center text-[11px] font-medium leading-tight ${
                selected === n.id ? 'border-accent ring-2 ring-accent' : 'border-edge'
              }`}
              onPointerDown={(e) => onPointerDown(e, n)} onPointerMove={onPointerMove} onPointerUp={() => (drag.current = null)}
              onClick={() => pick(n.id)} onKeyDown={(e) => onKey(e, n)}>
              <span aria-hidden="true" className="text-2xl">{DEVICES[n.type].icon}</span>
              {n.label}
            </button>
          ))}
          {!nodes.length && <p className="absolute inset-0 grid place-items-center text-muted">Empty canvas: add a device to begin.</p>}
        </div>
      </div>

      <div className="text-sm">
        <h3 className="font-semibold">Connections ({links.length})</h3>
        <ul className="mt-1 space-y-1">
          {links.map(([a, b], i) => (
            <li key={i} className="flex items-center gap-2">
              {name(a)} ↔ {name(b)}
              <button type="button" className="underline" onClick={() => setTopo({ nodes, links: links.filter((_, j) => j !== i) })} aria-label={`Remove link between ${name(a)} and ${name(b)}`}>remove</button>
            </li>
          ))}
          {!links.length && <li className="text-muted">None yet. Press “Connect devices”, then pick two devices.</li>}
        </ul>
      </div>
    </div>
  )
}
