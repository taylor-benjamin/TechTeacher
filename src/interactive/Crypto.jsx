import { useEffect, useState } from 'react'
import { btn, btnPrimary, field, input } from '../lib/ui'

const enc = new TextEncoder()
const dec = new TextDecoder()
const hex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('')
const b64 = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf)))
const unb64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0))
const mono = 'break-all rounded-md border border-line bg-surface p-2 font-mono text-xs'

async function digests(text) {
  const out = {}
  for (const algo of ['SHA-1', 'SHA-256', 'SHA-512']) out[algo] = await crypto.subtle.digest(algo, enc.encode(text))
  return out
}

function bitsDifferent(a, b) {
  const x = new Uint8Array(a)
  const y = new Uint8Array(b)
  let n = 0
  x.forEach((v, i) => { for (let d = v ^ y[i]; d; d >>= 1) n += d & 1 })
  return n
}

// Live hash generator. Two inputs side by side show the avalanche effect.
export function Hasher() {
  const [a, setA] = useState('Hello, world')
  const [b, setB] = useState('Hello, world!')
  const [h, setH] = useState(null)
  useEffect(() => {
    let live = true
    Promise.all([digests(a), digests(b)]).then(([ha, hb]) => live && setH({ a: ha, b: hb }))
    return () => { live = false }
  }, [a, b])
  const diff = h ? bitsDifferent(h.a['SHA-256'], h.b['SHA-256']) : 0
  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-2">
        {[['Input A', a, setA, 'a'], ['Input B', b, setB, 'b']].map(([label, value, set, k]) => (
          <div key={k}>
            <label htmlFor={`hash-${k}`} className="block text-sm font-medium">{label}</label>
            <input id={`hash-${k}`} className={`${input} mt-1 w-full font-mono`} value={value} onChange={(e) => set(e.target.value)} />
            {h && Object.entries(h[k]).map(([algo, buf]) => (
              <div key={algo} className="mt-2">
                <p className="text-xs font-semibold text-muted">{algo} ({buf.byteLength * 8} bits)</p>
                <p className={mono}>{hex(buf)}</p>
              </div>
            ))}
          </div>
        ))}
      </div>
      <p className="rounded-lg border-l-4 border-accent bg-accent-soft p-3 text-sm" aria-live="polite">
        {a === b
          ? 'Identical inputs always produce identical hashes. That is what makes hashes useful for checking integrity.'
          : <><strong>{diff} of 256</strong> SHA-256 bits differ ({Math.round((diff / 256) * 100)}%). A tiny change to the input flips about half the output bits: the avalanche effect.</>}
      </p>
    </div>
  )
}

async function aesKey(password, salt) {
  const base = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveKey'])
  return crypto.subtle.deriveKey({ name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt'])
}

function Symmetric() {
  const [text, setText] = useState('Meet me at noon.')
  const [password, setPassword] = useState('correct horse battery staple')
  const [cipher, setCipher] = useState('')
  const [tryPass, setTryPass] = useState('')
  const [result, setResult] = useState(null)

  async function encrypt() {
    const salt = crypto.getRandomValues(new Uint8Array(16))
    const iv = crypto.getRandomValues(new Uint8Array(12))
    const data = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await aesKey(password, salt), enc.encode(text))
    setCipher([salt, iv, data].map(b64).join('.'))
    setTryPass(password)
    setResult(null)
  }
  async function decrypt() {
    try {
      const [salt, iv, data] = cipher.split('.').map(unb64)
      const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, await aesKey(tryPass, salt), data)
      setResult({ ok: true, text: dec.decode(plain) })
    } catch {
      setResult({ ok: false, text: 'Decryption failed. The key is wrong or the ciphertext was changed. AES-GCM detects both.' })
    }
  }
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted">AES-256-GCM. The same secret encrypts and decrypts. Your password is stretched into a key with PBKDF2.</p>
      <label className="block text-sm font-medium">Message
        <input className={`${input} mt-1 block w-full`} value={text} onChange={(e) => setText(e.target.value)} />
      </label>
      <label className="block text-sm font-medium">Shared secret (password)
        <input className={`${input} mt-1 block w-full font-mono`} value={password} onChange={(e) => setPassword(e.target.value)} />
      </label>
      <button type="button" className={btnPrimary} onClick={encrypt}>🔒 Encrypt</button>
      {cipher && (
        <>
          <label className="block text-sm font-medium">Ciphertext (salt.iv.data, Base64). Try editing a character.
            <textarea rows={3} className={`${field} mt-1 block w-full font-mono text-xs`} value={cipher} onChange={(e) => setCipher(e.target.value)} />
          </label>
          <label className="block text-sm font-medium">Password to decrypt with
            <input className={`${input} mt-1 block w-full font-mono`} value={tryPass} onChange={(e) => setTryPass(e.target.value)} />
          </label>
          <button type="button" className={btn} onClick={decrypt}>🔓 Decrypt</button>
        </>
      )}
      <p aria-live="polite" className={result ? (result.ok ? 'font-semibold text-ok' : 'font-semibold text-bad') : ''}>
        {result && (result.ok ? `Decrypted: ${result.text}` : result.text)}
      </p>
    </div>
  )
}

function Asymmetric() {
  const [keys, setKeys] = useState(null)
  const [pub, setPub] = useState('')
  const [text, setText] = useState('For your eyes only.')
  const [cipher, setCipher] = useState(null)
  const [plain, setPlain] = useState('')
  const [busy, setBusy] = useState(false)

  async function generate() {
    setBusy(true)
    const k = await crypto.subtle.generateKey({ name: 'RSA-OAEP', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' }, true, ['encrypt', 'decrypt'])
    setKeys(k)
    setPub(b64(await crypto.subtle.exportKey('spki', k.publicKey)))
    setCipher(null)
    setPlain('')
    setBusy(false)
  }
  const encrypt = async () => {
    setCipher(await crypto.subtle.encrypt({ name: 'RSA-OAEP' }, keys.publicKey, enc.encode(text)))
    setPlain('')
  }
  const decrypt = async () => setPlain(dec.decode(await crypto.subtle.decrypt({ name: 'RSA-OAEP' }, keys.privateKey, cipher)))

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted">RSA-OAEP 2048. Anyone can encrypt with the public key; only the private key can decrypt.</p>
      <button type="button" className={btnPrimary} onClick={generate} disabled={busy}>{busy ? 'Generating…' : keys ? 'Generate a new key pair' : '1. Generate a key pair'}</button>
      {keys && (
        <>
          <div>
            <p className="text-sm font-medium">Public key (safe to share)</p>
            <p className={`${mono} max-h-20 overflow-auto`}>{pub}</p>
            <p className="mt-1 text-sm text-muted">Private key: kept inside your browser and never shown. That is the point.</p>
          </div>
          <label className="block text-sm font-medium">Message (up to about 190 characters with this key size)
            <input className={`${input} mt-1 block w-full`} maxLength={180} value={text} onChange={(e) => setText(e.target.value)} />
          </label>
          <button type="button" className={btn} onClick={encrypt}>2. 🔒 Encrypt with public key</button>
          {cipher && (
            <>
              <p className={mono}>{b64(cipher)}</p>
              <button type="button" className={btn} onClick={decrypt}>3. 🔓 Decrypt with private key</button>
            </>
          )}
          <p aria-live="polite" className="font-semibold text-ok">{plain && `Decrypted: ${plain}`}</p>
        </>
      )}
    </div>
  )
}

export function Cipher({ mode = 'symmetric' }) {
  const [tab, setTab] = useState(mode)
  return (
    <div>
      <div className="mb-4 flex gap-1" role="group" aria-label="Encryption type">
        {[['symmetric', 'Symmetric (AES)'], ['asymmetric', 'Asymmetric (RSA)']].map(([id, label]) => (
          <button key={id} type="button" aria-pressed={tab === id} className={tab === id ? btnPrimary : btn} onClick={() => setTab(id)}>{label}</button>
        ))}
      </div>
      {tab === 'symmetric' ? <Symmetric /> : <Asymmetric />}
    </div>
  )
}
