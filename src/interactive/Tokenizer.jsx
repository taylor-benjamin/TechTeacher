import { useState } from 'react'
import { field, input } from '../lib/ui'

const SUFFIXES = ['ization', 'ation', 'tion', 'ness', 'ment', 'able', 'ing', 'est', 'ous', 'ize', 'ed', 'er', 'ly', 's']
const PREFIXES = ['un', 're', 'pre', 'dis', 'over']

// Imitates how subword (BPE-style) tokenizers behave: short common words stay whole,
// longer or rarer words break into pieces, and a leading space belongs to the token.
function tokenize(text) {
  const tokens = []
  for (const chunk of text.match(/\s*[A-Za-z]+|\s*\d+|\s*[^\sA-Za-z\d]|\s+$/g) ?? []) {
    const space = chunk.match(/^\s*/)[0]
    const word = chunk.slice(space.length)
    let parts = [word]
    if (/^\d+$/.test(word)) parts = word.match(/\d{1,3}/g)
    else if (word.length > 6) {
      let stem = word
      const tail = []
      const pre = PREFIXES.find((p) => stem.toLowerCase().startsWith(p) && stem.length - p.length >= 4)
      const head = pre ? [stem.slice(0, pre.length)] : []
      if (pre) stem = stem.slice(pre.length)
      const suf = SUFFIXES.find((s) => stem.toLowerCase().endsWith(s) && stem.length - s.length >= 3)
      if (suf) {
        tail.unshift(stem.slice(-suf.length))
        stem = stem.slice(0, -suf.length)
      }
      parts = [...head, ...(stem.length > 8 ? stem.match(/.{1,4}/g) : [stem]), ...tail]
    }
    parts.filter((p) => p !== '').forEach((p, i) => tokens.push((i === 0 ? space : '') + p))
    if (!word && space) tokens.push(space)
  }
  return tokens
}

// Stable fake ID so the same token always maps to the same number, like a real vocabulary.
const tokenId = (t) => {
  let h = 2166136261
  for (const c of t) h = Math.imul(h ^ c.codePointAt(0), 16777619)
  return (h >>> 0) % 50000
}

export default function Tokenizer() {
  const [text, setText] = useState('Tokenization breaks unbelievable words into smaller pieces. It costs 1234567 tokens!')
  const tokens = tokenize(text)
  const words = text.trim().split(/\s+/).filter(Boolean).length
  return (
    <div className="space-y-3">
      <label htmlFor="tok-text" className="block text-sm font-medium">Type or paste any text</label>
      <textarea id="tok-text" rows={3} className={`${field} block w-full`} value={text} onChange={(e) => setText(e.target.value)} />
      <dl className="flex flex-wrap gap-x-6 gap-y-1 text-sm" aria-live="polite">
        {[['Characters', text.length], ['Words', words], ['Tokens', tokens.length], ['Characters per token', tokens.length ? (text.length / tokens.length).toFixed(1) : '0']].map(([k, v]) => (
          <div key={k} className="flex gap-1.5"><dt className="text-muted">{k}:</dt><dd className="font-semibold">{v}</dd></div>
        ))}
      </dl>
      <ol className="flex flex-wrap gap-1 rounded-lg border border-line bg-surface p-3" aria-label="Tokens">
        {tokens.map((t, i) => (
          <li key={i} className={`rounded border px-1.5 py-0.5 text-center font-mono text-sm ${i % 2 ? 'border-edge bg-panel' : 'border-accent bg-accent-soft'}`}>
            <span className="whitespace-pre">{t.replace(/ /g, '·').replace(/\n/g, '↵')}</span>
            <span className="block text-[10px] text-muted">{tokenId(t)}</span>
          </li>
        ))}
      </ol>
      <p className="text-sm text-muted">
        The dot (·) marks a space that belongs to the token. This demo imitates subword tokenization so you can see the idea; real tokenizers (such as BPE) learn their pieces from data, so exact splits and IDs differ per model.
      </p>
    </div>
  )
}
