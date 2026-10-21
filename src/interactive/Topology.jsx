import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useStored } from '../lib/store'
import { btn, btnPrimary } from '../lib/ui'

// Names come from t('topology.devices.<type>').
const DEVICES = {
  internet: { icon: '🌐' },
  firewall: { icon: '🧱' },
  router: { icon: '📡' },
  switch: { icon: '🔀' },
  ap: { icon: '📶' },
  server: { icon: '🗄️' },
  nas: { icon: '💾' },
  pc: { icon: '💻' },
}

const SAMPLE = {
  nodes: [
    { id: 1, type: 'internet', x: 20, y: 150, sample: 'isp' },
    { id: 2, type: 'firewall', x: 150, y: 150, label: 'pfSense' },
    { id: 3, type: 'switch', x: 290, y: 150, sample: 'switch' },
    { id: 4, type: 'server', x: 440, y: 40, sample: 'proxmox' },
    { id: 5, type: 'nas', x: 440, y: 150 },
    { id: 6, type: 'ap', x: 440, y: 260 },
    { id: 7, type: 'pc', x: 290, y: 280, sample: 'admin' },
  ],
  links: [[1, 2], [2, 3], [3, 4], [3, 5], [3, 6], [3, 7]],
}

const W = 78 // node box size, used to centre link lines
const CANVAS = { w: 620, h: 360 }

export default function Topology() {
  const { t } = useTranslation()
  const [topo, setTopo] = useStored('tt.topology', { nodes: [], links: [] })
  const [selected, setSelected] = useState(null)
  const [connecting, setConnecting] = useState(false)
  const [status, setStatus] = useState(() => t('topology.start'))
  const canvas = useRef(null)
  const drag = useRef(null)
  const { nodes, links } = topo
  // Older saves stored an English label; new nodes store only their type, so they follow the language.
  const labelOf = (n) => n.label ?? t(n.sample ? `topology.sample.${n.sample}` : `topology.devices.${n.type}`)

  const clamp = (x, y) => ({ x: Math.max(0, Math.min(CANVAS.w - W, x)), y: Math.max(0, Math.min(CANVAS.h - W, y)) })
  const add = (type, x, y) => {
    const id = Math.max(0, ...nodes.map((n) => n.id)) + 1
    const pos = x == null ? { x: 30 + ((id * 90) % 520), y: 30 + ((id * 60) % 260) } : clamp(x, y)
    setTopo({ nodes: [...nodes, { id, type, ...pos }], links })
    setSelected(id)
    setStatus(t('topology.added', { name: t(`topology.devices.${type}`) }))
  }
  const moveNode = (id, x, y) => setTopo((t) => ({ ...t, nodes: t.nodes.map((n) => (n.id === id ? { ...n, ...clamp(x, y) } : n)) }))
  const remove = (id) => {
    setTopo({ nodes: nodes.filter((n) => n.id !== id), links: links.filter((l) => !l.includes(id)) })
    setSelected(null)
    setStatus(t('topology.removed'))
  }
  const name = (id) => {
    const n = nodes.find((x) => x.id === id)
    return n && labelOf(n)
  }

  function pick(id) {
    if (connecting && selected && selected !== id) {
      const exists = links.some((l) => l.includes(selected) && l.includes(id))
      if (!exists) setTopo({ nodes, links: [...links, [selected, id]] })
      setStatus(exists ? t('topology.already') : t('topology.connected', { a: name(selected), b: name(id) }))
      setConnecting(false)
    } else if (connecting) setStatus(t('topology.pickTarget', { name: name(id) }))
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
      <div className="flex flex-wrap gap-1.5" role="group" aria-label={t('topology.add')}>
        {Object.entries(DEVICES).map(([type, d]) => (
          <button key={type} type="button" draggable className={`${btn} cursor-grab`}
            onDragStart={(e) => e.dataTransfer.setData('text/plain', type)} onClick={() => add(type)}>
            <span aria-hidden="true">{d.icon}</span> {t(`topology.devices.${type}`)}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        <button type="button" className={connecting ? btnPrimary : btn} aria-pressed={connecting} disabled={nodes.length < 2}
          onClick={() => { setConnecting(!connecting); setStatus(connecting ? t('topology.cancelled') : selected ? t('topology.pickFor', { name: name(selected) }) : t('topology.pickFirst')) }}>
          🔗 {connecting ? t('topology.connecting') : t('topology.connect')}
        </button>
        <button type="button" className={btn} disabled={!selected} onClick={() => remove(selected)}>{t('topology.delete')}</button>
        <button type="button" className={btn} onClick={() => { setTopo(SAMPLE); setSelected(null); setStatus(t('topology.loaded')) }}>{t('topology.loadSample')}</button>
        <button type="button" className={btn} onClick={() => { setTopo({ nodes: [], links: [] }); setSelected(null); setStatus(t('topology.cleared')) }}>{t('topology.clear')}</button>
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
              aria-label={t('topology.nodeAria', { name: labelOf(n) })}
              style={{ left: n.x, top: n.y, width: W, height: W, touchAction: 'none' }}
              className={`absolute flex cursor-grab flex-col items-center justify-center rounded-lg border-2 bg-panel p-1 text-center text-[11px] font-medium leading-tight ${
                selected === n.id ? 'border-accent ring-2 ring-accent' : 'border-edge'
              }`}
              onPointerDown={(e) => onPointerDown(e, n)} onPointerMove={onPointerMove} onPointerUp={() => (drag.current = null)}
              onClick={() => pick(n.id)} onKeyDown={(e) => onKey(e, n)}>
              <span aria-hidden="true" className="text-2xl">{DEVICES[n.type].icon}</span>
              {labelOf(n)}
            </button>
          ))}
          {!nodes.length && <p className="absolute inset-0 grid place-items-center text-muted">{t('topology.empty')}</p>}
        </div>
      </div>

      <div className="text-sm">
        <h3 className="font-semibold">{t('topology.links', { count: links.length })}</h3>
        <ul className="mt-1 space-y-1">
          {links.map(([a, b], i) => (
            <li key={i} className="flex items-center gap-2">
              {name(a)} ↔ {name(b)}
              <button type="button" className="underline" onClick={() => setTopo({ nodes, links: links.filter((_, j) => j !== i) })} aria-label={t('topology.removeLink', { a: name(a), b: name(b) })}>{t('topology.remove')}</button>
            </li>
          ))}
          {!links.length && <li className="text-muted">{t('topology.none')}</li>}
        </ul>
      </div>
    </div>
  )
}
