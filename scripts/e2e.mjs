// End-to-end checks of the interactive widgets, driven through headless Edge (no dependencies).
// Usage: npm run build; npm run preview (in another terminal); node scripts/e2e.mjs [screenshot-dir]
import { spawn } from 'node:child_process'
import { existsSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const BASE = 'http://localhost:4173/#/'
const PORT = 9333
const shotDir = process.argv[2]
const edge = ['C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', 'C:/Program Files/Microsoft/Edge/Application/msedge.exe'].find(existsSync)
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const browser = spawn(edge, ['--headless=new', '--disable-gpu', '--no-first-run', `--remote-debugging-port=${PORT}`, `--user-data-dir=${join(tmpdir(), 'tt-e2e-profile')}`, 'about:blank'])

let target
for (let i = 0; i < 50 && !target; i++) {
  await sleep(200)
  target = await fetch(`http://127.0.0.1:${PORT}/json/list`).then((r) => r.json()).then((l) => l.find((t) => t.type === 'page')).catch(() => null)
}
const ws = new WebSocket(target.webSocketDebuggerUrl)
await new Promise((r) => (ws.onopen = r))
const pending = new Map()
const pageErrors = []
let nextId = 1
ws.onmessage = ({ data }) => {
  const msg = JSON.parse(data)
  if (msg.id) return pending.get(msg.id)?.(msg)
  if (msg.method === 'Runtime.exceptionThrown') pageErrors.push(msg.params.exceptionDetails.exception?.description ?? msg.params.exceptionDetails.text)
  if (msg.method === 'Runtime.consoleAPICalled' && msg.params.type === 'error') pageErrors.push(msg.params.args.map((a) => a.value ?? a.description).join(' '))
}
const send = (method, params = {}) =>
  new Promise((resolve) => {
    const id = nextId++
    pending.set(id, resolve)
    ws.send(JSON.stringify({ id, method, params }))
  })
const js = async (expression) => {
  const { result } = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description ?? 'evaluate failed')
  return result.result.value
}
const goto = async (route) => {
  await send('Page.navigate', { url: 'about:blank' })
  await send('Page.navigate', { url: BASE + route })
  await waitFor(`!!document.querySelector('h1')`, 10000)
}
async function waitFor(expression, timeout = 8000) {
  const end = Date.now() + timeout
  while (Date.now() < end) {
    const v = await js(expression)
    if (v) return v
    await sleep(150)
  }
  return false
}
const click = (text, nth = 0) =>
  js(`(() => { const b = [...document.querySelectorAll('button')].filter(b => b.textContent.includes(${JSON.stringify(text)}))[${nth}]; if (!b) return false; b.click(); return true })()`)
const type = (selector, value) =>
  js(`(() => { const el = document.querySelector(${JSON.stringify(selector)}); const proto = el.tagName === 'TEXTAREA' ? HTMLTextAreaElement : HTMLInputElement;
    Object.getOwnPropertyDescriptor(proto.prototype, 'value').set.call(el, ${JSON.stringify(value)}); el.dispatchEvent(new Event('input', { bubbles: true })); return true })()`)
const text = (selector = 'main') => js(`document.querySelector(${JSON.stringify(selector)})?.innerText ?? ''`)
const has = (needle, selector = 'main', timeout = 8000) => waitFor(`(document.querySelector(${JSON.stringify(selector)})?.innerText ?? '').includes(${JSON.stringify(needle)})`, timeout)
const shot = async (name) => {
  if (!shotDir) return
  const { result } = await send('Page.captureScreenshot', { format: 'png' })
  writeFileSync(join(shotDir, name + '.png'), Buffer.from(result.data, 'base64'))
}

await send('Page.enable')
await send('Runtime.enable')
await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false })

const results = []
const only = process.env.E2E_ONLY // run a subset: E2E_ONLY=AES node scripts/e2e.mjs
async function check(name, fn) {
  if (only && !name.includes(only)) return
  let ok = false
  let info = ''
  try {
    const r = await fn()
    ok = !!r
    if (typeof r === 'string') info = r
  } catch (e) {
    info = e.message
  }
  results.push(ok)
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${info ? '  (' + info + ')' : ''}`)
}
const runner = (route, button, expected, timeout) => async () => {
  await goto(route)
  await waitFor(`!!document.querySelector('[role=log]')`)
  await click(button)
  return has(expected, '[role=log]', timeout)
}

await check('JavaScript runner (worker)', runner('software/javascript/syntax-basics', 'Run', 'Ava has 12 points'))
await check('JavaScript runner: fetch + top-level await', runner('software/javascript/core-concepts', 'Run', 'lives in'))
await check('Node runner: event loop order', async () => {
  await runner('software/nodejs/core-concepts', 'Run', '4. timer')()
  const out = await text('[role=log]')
  return out.indexOf('3. promise') < out.indexOf('4. timer') && out.indexOf('2. end') < out.indexOf('3. promise')
})
await check('Python runner (Pyodide)', runner('software/python/syntax-basics', 'Run', 'Ava has 12 points', 90000))
await check('Python mini project', runner('software/python/mini-project', 'Run', "'password': weak", 60000))
await check('SQL runner (sql.js)', runner('software/sql/core-concepts', 'Run', 'Robotics', 30000))
await check('SQL mini project', runner('software/sql/mini-project', 'Run', 'spent', 30000))
await check('Bash simulator', runner('software/bash/core-concepts', 'Run', 'logs/app.log has 5 lines'))
await check('Java expected output', runner('software/java/syntax-basics', 'Show expected output', 'Ava has 12 points'))
await check('HTML live preview', async () => {
  await goto('software/html-css/syntax-basics')
  return waitFor(`document.querySelector('iframe[title="Live preview"]')?.srcdoc.includes('Hello, web!')`)
})
await check('API tester: GET returns 200', async () => {
  await goto('software/apis/live-api-tester')
  await click('Send')
  return (await has('200', 'form', 15000)) && has('"userId"', 'form')
})
await check('API tester: 404 preset', async () => {
  await click('Trigger a 404')
  await click('Send')
  return has('404', 'form', 15000)
})
await check('Neural net trains XOR', async () => {
  await goto('ai/how-ai-works/neural-networks')
  const loss = () => text('main').then((t) => parseFloat(t.match(/Loss \(error\):\s*([\d.]+)/)[1]))
  const before = await loss()
  for (let i = 0; i < 30; i++) await click('Train 100 steps')
  await sleep(300)
  const after = await loss()
  return after < before && after < 0.05 ? `loss ${before} -> ${after}` : false
})
await check('Tokenizer', async () => {
  await goto('ai/how-ai-works/tokens')
  await type('#tok-text', 'unbelievable cats')
  await sleep(200)
  const t = await text('main')
  return /Tokens:\s*4/.test(t) ? 'un|believ|able| cats' : false
})
await check('Subnet calculator', async () => {
  await goto('networking/fundamentals/subnetting')
  if (!(await has('192.168.10.64')) || !(await has('192.168.10.127'))) return false
  await type('#subnet-in', '10.20.30.200/26')
  return (await has('10.20.30.192')) && has('10.20.30.255')
})
await check('Topology builder: sample, add, connect', async () => {
  await goto('networking/home-lab/pfsense-topology')
  await click('Load sample home lab')
  if (!(await has('Connections (6)'))) return false
  await click('Switch') // palette button adds a device and selects it
  await click('Connect devices')
  await click('Managed switch')
  return has('Connections (7)')
})
await check('Contrast checker', async () => {
  await goto('webdesign/fundamentals/color')
  return has('3.45 : 1')
})
await check('Hash generator', async () => {
  await goto('security/cryptography/hashing')
  if (!(await has('of 256'))) return false
  await type('#hash-a', 'abc')
  // Known SHA-256 of "abc"
  return has('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad')
})
await check('AES encrypt / decrypt', async () => {
  await goto('security/cryptography/symmetric-encryption')
  await click('🔒 Encrypt')
  await waitFor(`!!document.querySelector('textarea')`)
  await click('🔓 Decrypt')
  if (await has('Decrypted: Meet me at noon.')) return true
  console.log('      ' + (await text('#sec-4 ~ *')).slice(-400).replace(/\n/g, ' | '))
  return false
})
await check('AES rejects a wrong password', async () => {
  await js(`(() => { const i = [...document.querySelectorAll('input')].at(-1); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(i, 'wrong'); i.dispatchEvent(new Event('input', { bubbles: true })) })()`)
  await click('🔓 Decrypt')
  return has('Decryption failed')
})
await check('RSA encrypt / decrypt', async () => {
  await goto('security/cryptography/asymmetric-encryption')
  await click('Generate a key pair')
  await waitFor(`[...document.querySelectorAll('button')].some(b => b.textContent.includes('Encrypt with public key'))`, 20000)
  await click('Encrypt with public key')
  await waitFor(`[...document.querySelectorAll('button')].some(b => b.textContent.includes('Decrypt with private key'))`)
  await click('Decrypt with private key')
  return has('Decrypted: For your eyes only.')
})
await check('Packet viewer filter', async () => {
  await goto('security/wireshark/packet-analysis')
  await type('#pkt-filter', 'http')
  if (!(await has('Showing 2 of 16'))) return false
  await click('13')
  return has('password = Summer2024!')
})
await check('Quiz feedback', async () => {
  await goto('software/apis/what-is-an-api')
  await js(`document.querySelectorAll('input[name=q0]')[1].click()`)
  await click('Check answer')
  return has('Correct.')
})
await check('Ordering exercise', async () => {
  await goto('security/defense/incident-response')
  await click('Check order')
  return has('Some items are out of place')
})
await check('Glossary tooltip', async () => {
  await goto('software/apis/what-is-an-api')
  await js(`document.querySelector('button.term').click()`)
  return waitFor(`!!document.querySelector('[role=tooltip]')`)
})
await check('Progress saved to localStorage', async () => {
  await click('Mark lesson complete')
  await sleep(200)
  const saved = await js(`JSON.parse(localStorage.getItem('tt.progress'))['software/apis/what-is-an-api'] === true`)
  return saved && has('1/5', 'aside')
})
await check('Level filter', async () => {
  await click('Advanced')
  await click('JavaScript')
  return has('No lessons at this level', 'aside')
})
await check('Global search', async () => {
  await goto('software')
  await type('#global-search', 'subnet calculator')
  return has('Subnetting with a calculator', '[role=search]')
})
await check('Learning path progress', async () => {
  await goto('paths')
  return (await has('SOC Analyst')) && has('1 of 19 lessons')
})
await check('Theme toggle', async () => {
  const before = await js(`document.documentElement.classList.contains('dark')`)
  await js(`document.querySelector('button[aria-label^="Switch to"]').click()`)
  await sleep(100)
  return (await js(`document.documentElement.classList.contains('dark')`)) !== before
})

// Layout: no page may scroll sideways on a phone.
await send('Emulation.setDeviceMetricsOverride', { width: 375, height: 800, deviceScaleFactor: 2, mobile: true })
for (const route of ['', 'software', 'software/apis/live-api-tester', 'software/python/syntax-basics', 'ai/how-ai-works/neural-networks', 'networking/fundamentals/subnetting', 'networking/home-lab/pfsense-topology', 'security/wireshark/packet-analysis', 'security/cryptography/hashing', 'paths', 'glossary']) {
  await check(`No horizontal scroll at 375px: /${route}`, async () => {
    await goto(route)
    await sleep(600)
    const w = await js(`document.documentElement.scrollWidth`)
    return w <= 375 ? true : (console.log(`      scrollWidth=${w}`), false)
  })
}
await check('Header controls fit on a phone', async () => {
  await goto('networking/fundamentals/subnetting')
  await sleep(500)
  await shot('mobile')
  return js(`document.querySelector('button[aria-label^="Switch to"]').getBoundingClientRect().right <= 375`)
})

// Screenshots in both themes for a visual check.
await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 1600, deviceScaleFactor: 1, mobile: false })
for (const theme of shotDir && !only ? ['light', 'dark'] : []) {
  await js(`localStorage.setItem('tt.theme', '"${theme}"')`)
  for (const [name, route] of [['home', ''], ['lesson', 'security/cryptography/hashing'], ['lesson2', 'ai/how-ai-works/neural-networks']]) {
    await goto(route)
    await sleep(700)
    await shot(`${name}-${theme}`)
  }
}

const failed = results.filter((r) => !r).length
console.log(`\n${results.length - failed} passed, ${failed} failed.`)
if (pageErrors.length) console.log('Page errors:\n  ' + [...new Set(pageErrors)].join('\n  '))
ws.close()
browser.kill()
process.exit(failed ? 1 : 0)
