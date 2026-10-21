import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { btn, input } from '../lib/ui'

// Supports a useful subset of Wireshark display filters:
//   dns | tcp | http ...      protocol names
//   ip.addr==1.2.3.4          also ip.src / ip.dst
//   tcp.port==443             also udp.port
//   joined with &&
function matches(p, filter) {
  return filter.toLowerCase().split('&&').map((s) => s.trim()).filter(Boolean).every((term) => {
    const m = term.match(/^([a-z.]+)\s*==\s*(\S+)$/)
    if (!m) return p.proto.toLowerCase() === term || p.stack.includes(term)
    const [, field, value] = m
    if (field === 'ip.addr') return p.src === value || p.dst === value
    if (field === 'ip.src') return p.src === value
    if (field === 'ip.dst') return p.dst === value
    if (field === 'tcp.port' || field === 'udp.port') return p.stack.includes(field.slice(0, 3)) && (String(p.sport) === value || String(p.dport) === value)
    return false
  })
}

export default function PacketViewer({ packets, filters = [] }) {
  const { t } = useTranslation()
  const [filter, setFilter] = useState('')
  const [selected, setSelected] = useState(packets[0].no)
  const shown = packets.filter((p) => matches(p, filter))
  const current = packets.find((p) => p.no === selected)
  return (
    <div className="space-y-3">
      <div>
        <label htmlFor="pkt-filter" className="block text-sm font-medium">{t('packets.filter')}</label>
        <div className="mt-1 flex flex-wrap gap-1.5">
          <input id="pkt-filter" className={`${input} w-64 font-mono`} placeholder={t('packets.placeholder')} value={filter} onChange={(e) => setFilter(e.target.value)} spellCheck={false} />
          {['', ...filters].map((f) => (
            <button key={f} type="button" className={btn} onClick={() => setFilter(f)}>{f || t('packets.clear')}</button>
          ))}
        </div>
        <p className="mt-1 text-sm text-muted" aria-live="polite">{t('packets.showing', { shown: shown.length, total: packets.length })}</p>
      </div>

      <div className="max-h-72 overflow-auto rounded-lg border border-line">
        <table className="w-full min-w-[640px] border-collapse text-left font-mono text-xs">
          <thead className="sticky top-0 bg-accent text-on-accent">
            <tr>{t('packets.columns').map((c) => <th key={c} scope="col" className="px-2 py-1.5">{c}</th>)}</tr>
          </thead>
          <tbody>
            {shown.map((p) => (
              <tr key={p.no} className={`border-t border-line ${p.no === selected ? 'bg-accent-soft font-semibold' : ''}`}>
                <td className="px-2 py-1">
                  <button type="button" className="underline" aria-pressed={p.no === selected} aria-label={t('packets.inspect', { n: p.no })} onClick={() => setSelected(p.no)}>{p.no}</button>
                </td>
                <td className="px-2 py-1">{p.time}</td>
                <td className="px-2 py-1">{p.src}</td>
                <td className="px-2 py-1">{p.dst}</td>
                <td className="px-2 py-1">{p.proto}</td>
                <td className="px-2 py-1">{p.info}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {current && (
        <div className="rounded-lg border border-line bg-surface p-3 text-sm" aria-live="polite">
          <h3 className="font-semibold">{t('packets.details', { n: current.no })}</h3>
          {current.detail.map((d) => (
            <details key={d.layer} open className="mt-1.5">
              <summary className="cursor-pointer font-medium">{d.layer}</summary>
              <ul className="ml-5 mt-1 space-y-0.5 font-mono text-xs">
                {d.fields.map((f) => <li key={f}>{f}</li>)}
              </ul>
            </details>
          ))}
          {current.note && <p className="mt-2 border-l-4 border-accent pl-2 text-muted">💡 {current.note}</p>}
        </div>
      )}
    </div>
  )
}
