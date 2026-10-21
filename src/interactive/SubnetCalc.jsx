import { useState } from 'react'
import { Trans, useTranslation } from 'react-i18next'
import i18n from '../i18n'
import { input } from '../lib/ui'

const toInt = (ip) => ip.split('.').reduce((n, o) => n * 256 + Number(o), 0)
const toIp = (n) => [24, 16, 8, 0].map((s) => Math.floor(n / 2 ** s) % 256).join('.')
const bin = (n) => n.toString(2).padStart(32, '0')

function calc(text) {
  const m = text.trim().match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})\s*\/\s*(\d{1,2})$/)
  if (!m || m.slice(1, 5).some((o) => +o > 255) || +m[5] > 32) return null
  const prefix = +m[5]
  const ip = toInt(m.slice(1, 5).join('.'))
  const size = 2 ** (32 - prefix)
  const network = Math.floor(ip / size) * size
  const broadcast = network + size - 1
  const mask = 2 ** 32 - size
  const p2p = prefix >= 31 // /31 and /32 have no separate network/broadcast addresses
  return {
    prefix, ip, network, broadcast, mask,
    rows: [
      ['network', toIp(network)],
      ['mask', toIp(mask)],
      ['wildcard', toIp(size - 1)],
      ['broadcast', p2p ? i18n.t('subnet.none') : toIp(broadcast)],
      ['first', toIp(p2p ? network : network + 1)],
      ['last', toIp(p2p ? broadcast : broadcast - 1)],
      ['usable', (p2p ? size : size - 2).toLocaleString(i18n.language)],
      ['total', size.toLocaleString(i18n.language)],
    ],
  }
}

function Bits({ label, value, prefix }) {
  const b = bin(value)
  // Bits from..to with a dot after each octet.
  const dotted = (from, to) =>
    [...b.slice(from, to)].map((c, i) => c + ((from + i + 1) % 8 === 0 && from + i + 1 < 32 ? '.' : '')).join('')
  return (
    <div className="flex flex-wrap items-baseline gap-x-3">
      <span className="w-20 text-muted">{label}</span>
      <span className="whitespace-nowrap font-mono">
        <span className="font-bold text-accent-ink">{dotted(0, prefix)}</span>
        <span className="underline decoration-dotted">{dotted(prefix, 32)}</span>
      </span>
    </div>
  )
}

export default function SubnetCalc() {
  const { t } = useTranslation()
  const [text, setText] = useState('192.168.10.77/26')
  const r = calc(text)
  return (
    <div className="space-y-4">
      <div>
        <label htmlFor="subnet-in" className="block text-sm font-medium">{t('subnet.label')}</label>
        <input id="subnet-in" className={`${input} mt-1 w-56 font-mono`} value={text} onChange={(e) => setText(e.target.value)}
          aria-invalid={!r} aria-describedby="subnet-help" />
        <p id="subnet-help" className={`mt-1 text-sm ${r ? 'text-muted' : 'text-bad'}`}>
          {r ? t('subnet.tip') : t('subnet.invalid')}
        </p>
      </div>
      {r && (
        <div aria-live="polite" className="space-y-4">
          <table className="border-collapse text-sm">
            <tbody>
              {r.rows.map(([k, v]) => (
                <tr key={k}>
                  <th scope="row" className="border border-line bg-surface px-3 py-1.5 text-left font-medium">{t(`subnet.${k}`)}</th>
                  <td className="border border-line px-3 py-1.5 font-mono">{v}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="overflow-x-auto rounded-lg border border-line bg-surface p-3 text-sm">
            <Bits label={t('subnet.address')} value={r.ip} prefix={r.prefix} />
            <Bits label={t('subnet.maskShort')} value={r.mask} prefix={r.prefix} />
            <Bits label={t('subnet.networkShort')} value={r.network} prefix={r.prefix} />
            <p className="mt-2 text-muted">
              <Trans i18nKey="subnet.legend" values={{ net: r.prefix, host: 32 - r.prefix }}
                components={[<strong className="text-accent-ink" />, <span className="underline decoration-dotted" />]} />
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
