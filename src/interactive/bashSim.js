// A small simulated shell so Bash lessons can run in the browser.
// It covers the commands the lessons teach; it is not a real Bash.

const SUPPORTED = 'echo pwd cd ls mkdir touch cat rm cp mv grep wc head tail sort uniq seq whoami date export test [ true false chmod'

function splitTop(str, sep) {
  const parts = []
  let cur = ''
  let quote = null
  let depth = 0
  for (let i = 0; i < str.length; i++) {
    const c = str[i]
    if (quote) {
      if (c === quote) quote = null
    } else if (c === '"' || c === "'") quote = c
    else if (c === '(') depth++
    else if (c === ')') depth--
    else if (!depth && str.startsWith(sep, i) && (sep !== '|' || str[i + 1] !== '|')) {
      parts.push(cur)
      cur = ''
      i += sep.length - 1
      continue
    }
    cur += c
  }
  parts.push(cur)
  return parts.map((p) => p.trim()).filter(Boolean)
}

export function runBash(script) {
  const out = []
  const fs = new Map([
    ['/', null],
    ['/home', null],
    ['/home/learner', null],
    ['/home/learner/notes.txt', 'buy milk\nlearn bash\nship project\n'],
    ['/home/learner/logs', null],
    ['/home/learner/logs/app.log', 'INFO start\nERROR disk full\nINFO retry\nERROR timeout\nINFO done\n'],
  ])
  const vars = { HOME: '/home/learner', USER: 'learner' }
  let cwd = '/home/learner'
  let status = 0

  const resolve = (p) => {
    const parts = (p.startsWith('/') ? p : `${cwd}/${p}`).replace(/^~/, vars.HOME).split('/')
    const stack = []
    for (const s of parts) {
      if (s === '..') stack.pop()
      else if (s && s !== '.') stack.push(s)
    }
    return '/' + stack.join('/')
  }
  const isDir = (p) => fs.has(p) && fs.get(p) === null
  const isFile = (p) => typeof fs.get(p) === 'string'
  const parentOf = (p) => p.slice(0, p.lastIndexOf('/')) || '/'
  const children = (dir) => [...fs.keys()].filter((k) => k !== dir && parentOf(k) === dir).sort()
  const base = (p) => p.split('/').pop()
  const lines = (s) => (s ? s.replace(/\n$/, '').split('\n') : [])
  const fail = (msg) => {
    status = 1
    out.push({ kind: 'err', text: msg })
    return ''
  }

  const expand = (s) =>
    s
      .replace(/\$\(\((.+?)\)\)/g, (_, e) => {
        const expr = expand(e).replace(/\b[A-Za-z_]\w*\b/g, (v) => vars[v] ?? 0)
        return /^[\d\s+\-*/%()]+$/.test(expr) ? String(Math.trunc(Function(`return (${expr})`)())) : '0'
      })
      .replace(/\$\(([^()]+)\)/g, (_, cmd) => pipeline(cmd).trim())
      .replace(/\$\{(\w+)\}|\$(\w+)/g, (_, a, b) => vars[a ?? b] ?? '')
      .replace(/\$\?/g, String(status))

  function tokenize(cmd) {
    const tokens = []
    let cur = ''
    let has = false
    let quote = null
    let glob = false
    const push = () => {
      if (!has) return
      if (glob) {
        const re = new RegExp('^' + cur.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*') + '$')
        const hits = children(cwd).map(base).filter((n) => re.test(n))
        tokens.push(...(hits.length ? hits : [cur]))
      } else tokens.push(cur)
      cur = ''
      has = glob = false
    }
    let seg = ''
    const flush = (raw) => {
      cur += raw ? seg : expand(seg)
      seg = ''
    }
    let depth = 0 // inside $( ... ), spaces and quotes belong to the inner command
    for (const c of cmd) {
      if (quote) {
        if (c === quote) {
          flush(quote === "'")
          quote = null
        } else seg += c
      } else if (depth && c !== ')') {
        if (c === '(') depth++
        seg += c
      } else if (c === '(' || (c === ')' && depth)) {
        depth += c === '(' ? 1 : -1
        seg += c
        has = true
      } else if (c === '"' || c === "'") {
        flush(false)
        quote = c
        has = true
      } else if (/\s/.test(c)) {
        flush(false)
        push()
      } else {
        if (c === '*') glob = true
        seg += c
        has = true
      }
    }
    flush(false)
    push()
    return tokens
  }

  const flags = (args) => {
    const f = new Set()
    const rest = []
    for (const a of args) (/^-[a-zA-Z]+$/.test(a) ? [...a.slice(1)].forEach((x) => f.add(x)) : rest.push(a))
    return [f, rest]
  }
  const numArg = (args, def) => {
    const i = args.indexOf('-n')
    if (i >= 0) return [parseInt(args[i + 1], 10), args.filter((_, j) => j !== i && j !== i + 1)]
    const short = args.find((a) => /^-\d+$/.test(a))
    return short ? [parseInt(short.slice(1), 10), args.filter((a) => a !== short)] : [def, args]
  }
  const read = (files, stdin, name) => {
    if (!files.length) return stdin
    let s = ''
    for (const f of files) {
      const p = resolve(f)
      if (isDir(p)) fail(`${name}: ${f}: Is a directory`)
      else if (!isFile(p)) fail(`${name}: ${f}: No such file or directory`)
      else s += fs.get(p)
    }
    return s
  }
  const test = (a) => {
    if (a[0] === '!') return !test(a.slice(1))
    if (a[0] === '-f') return isFile(resolve(a[1] ?? ''))
    if (a[0] === '-d') return isDir(resolve(a[1] ?? ''))
    if (a[0] === '-e') return fs.has(resolve(a[1] ?? ''))
    if (a[0] === '-z') return !a[1]
    if (a[0] === '-n') return !!a[1]
    const [l, op, r] = a
    const n = { '-eq': l == r, '-ne': l != r, '-gt': +l > +r, '-lt': +l < +r, '-ge': +l >= +r, '-le': +l <= +r, '=': l === r, '==': l === r, '!=': l !== r }
    return op in n ? n[op] : !!l
  }

  function command(tokens, stdin) {
    const [name, ...args] = tokens
    status = 0
    switch (name) {
      case 'echo': {
        const n = args[0] === '-n'
        return (n ? args.slice(1) : args).join(' ') + (n ? '' : '\n')
      }
      case 'pwd': return cwd + '\n'
      case 'whoami': return vars.USER + '\n'
      case 'date': return new Date().toString() + '\n'
      case 'true': case 'chmod': return ''
      case 'false': status = 1; return ''
      case 'export': args.forEach((a) => { const m = a.match(/^(\w+)=(.*)$/); if (m) vars[m[1]] = m[2] }); return ''
      case 'test': status = test(args) ? 0 : 1; return ''
      case '[': status = test(args.slice(0, -1)) ? 0 : 1; return ''
      case 'seq': {
        const [a, b] = args.length > 1 ? args.map(Number) : [1, Number(args[0])]
        return Array.from({ length: Math.max(0, b - a + 1) }, (_, i) => a + i).join('\n') + '\n'
      }
      case 'cd': {
        const p = resolve(args[0] ?? vars.HOME)
        if (!isDir(p)) return fail(`cd: ${args[0]}: No such file or directory`)
        cwd = p
        return ''
      }
      case 'ls': {
        const [f, rest] = flags(args)
        const p = resolve(rest[0] ?? '.')
        if (isFile(p)) return base(p) + '\n'
        if (!isDir(p)) return fail(`ls: cannot access '${rest[0]}': No such file or directory`)
        const names = children(p).map((k) => base(k) + (isDir(k) ? '/' : '')).filter((n) => f.has('a') || !n.startsWith('.'))
        return names.length ? names.join('\n') + '\n' : ''
      }
      case 'mkdir': {
        const [f, rest] = flags(args)
        for (const d of rest) {
          const p = resolve(d)
          const parent = p.slice(0, p.lastIndexOf('/')) || '/'
          if (fs.has(p)) { if (!f.has('p')) fail(`mkdir: cannot create directory '${d}': File exists`) }
          else if (!isDir(parent) && !f.has('p')) fail(`mkdir: cannot create directory '${d}': No such file or directory`)
          else p.split('/').reduce((acc, s) => { const q = acc + '/' + s; if (s && !fs.has(q)) fs.set(q, null); return s ? q : acc }, '')
        }
        return ''
      }
      case 'touch': args.forEach((a) => { const p = resolve(a); if (!fs.has(p)) fs.set(p, '') }); return ''
      case 'cat': return read(args, stdin, 'cat')
      case 'rm': {
        const [f, rest] = flags(args)
        for (const a of rest) {
          const p = resolve(a)
          if (!fs.has(p)) { if (!f.has('f')) fail(`rm: cannot remove '${a}': No such file or directory`) }
          else if (isDir(p) && !f.has('r')) fail(`rm: cannot remove '${a}': Is a directory`)
          else [...fs.keys()].filter((k) => k === p || k.startsWith(p + '/')).forEach((k) => fs.delete(k))
        }
        return ''
      }
      case 'cp': case 'mv': {
        const [, rest] = flags(args)
        const src = resolve(rest[0] ?? '')
        let dst = resolve(rest[1] ?? '')
        if (!isFile(src)) return fail(`${name}: cannot stat '${rest[0]}': No such file`)
        if (isDir(dst)) dst += '/' + base(src)
        fs.set(dst, fs.get(src))
        if (name === 'mv') fs.delete(src)
        return ''
      }
      case 'grep': {
        const [f, rest] = flags(args)
        if (!rest.length) return fail('grep: missing pattern')
        let re
        try { re = new RegExp(rest[0], f.has('i') ? 'i' : '') } catch { return fail(`grep: bad pattern '${rest[0]}'`) }
        const hits = lines(read(rest.slice(1), stdin, 'grep'))
          .map((l, i) => [l, i + 1])
          .filter(([l]) => re.test(l) !== f.has('v'))
        if (!hits.length) status = 1
        if (f.has('c')) return hits.length + '\n'
        return hits.map(([l, n]) => (f.has('n') ? `${n}:${l}` : l)).join('\n') + (hits.length ? '\n' : '')
      }
      case 'wc': {
        const [f, rest] = flags(args)
        const s = read(rest, stdin, 'wc')
        const counts = { l: lines(s).length, w: s.split(/\s+/).filter(Boolean).length, c: s.length }
        const keys = ['l', 'w', 'c'].filter((k) => !f.size || f.has(k))
        return keys.map((k) => counts[k]).join(' ') + (rest[0] ? ' ' + rest[0] : '') + '\n'
      }
      case 'head': case 'tail': {
        const [n, rest] = numArg(args, 10)
        const l = lines(read(rest, stdin, name))
        const pick = name === 'head' ? l.slice(0, n) : l.slice(-n)
        return pick.length ? pick.join('\n') + '\n' : ''
      }
      case 'sort': {
        const [f, rest] = flags(args)
        const l = lines(read(rest, stdin, 'sort')).sort(f.has('n') ? (a, b) => parseFloat(a) - parseFloat(b) : undefined)
        if (f.has('r')) l.reverse()
        return l.length ? l.join('\n') + '\n' : ''
      }
      case 'uniq': {
        const [f, rest] = flags(args)
        const groups = []
        for (const l of lines(read(rest, stdin, 'uniq'))) {
          if (groups.length && groups.at(-1)[0] === l) groups.at(-1)[1]++
          else groups.push([l, 1])
        }
        return groups.map(([l, n]) => (f.has('c') ? `${String(n).padStart(4)} ${l}` : l)).join('\n') + (groups.length ? '\n' : '')
      }
      default:
        status = 127
        out.push({ kind: 'err', text: `${name}: command not found (this simulated shell supports: ${SUPPORTED})` })
        return ''
    }
  }

  // Runs "a | b | c > file" and returns whatever is left on stdout.
  function pipeline(text) {
    let data = ''
    for (const part of splitTop(text, '|')) {
      let tokens = tokenize(part)
      let target = null
      const r = tokens.findIndex((t) => t === '>' || t === '>>')
      if (r >= 0) {
        target = { path: resolve(tokens[r + 1] ?? ''), append: tokens[r] === '>>' }
        tokens = tokens.slice(0, r)
      }
      if (!tokens.length) continue
      if (tokens.length === 1 && /^\w+=/.test(tokens[0])) {
        const i = tokens[0].indexOf('=')
        vars[tokens[0].slice(0, i)] = tokens[0].slice(i + 1)
        status = 0
        data = ''
        continue
      }
      data = command(tokens, data)
      if (target) {
        fs.set(target.path, (target.append && isFile(target.path) ? fs.get(target.path) : '') + data)
        data = ''
      }
    }
    return data
  }

  function run(text) {
    for (const stmt of splitTop(text, ';')) {
      for (const piece of splitTop(stmt, '&&')) {
        emit(pipeline(piece))
        if (status !== 0) break
      }
    }
  }
  const emit = (s) => s && out.push({ kind: 'out', text: s.replace(/\n$/, '') })

  // Join multi-line for/if blocks into single statements, then run each one.
  const src = script.split('\n').map((l) => l.replace(/(^|\s)#.*$/, '').trim()).filter(Boolean)
  let block = []
  let depth = 0
  for (const line of src) {
    if (/^(for|if)\b/.test(line)) depth++
    block.push(line)
    if (/(^|;\s*)(done|fi)$/.test(line)) depth--
    if (depth <= 0) {
      depth = 0
      const joined = block.join('; ').replace(/\b(do|then|else);/g, '$1')
      block = []
      try {
        // Keep for/if blocks whole so their inner semicolons are not split apart.
        if (/^(for|if)\b/.test(joined)) runBlock(joined)
        else run(joined)
      } catch (e) {
        out.push({ kind: 'err', text: String(e.message ?? e) })
      }
    }
  }
  function runBlock(stmt) {
    const loop = stmt.match(/^for\s+(\w+)\s+in\s+(.+?)\s*;\s*do\s+(.+?)\s*;?\s*done$/s)
    const cond = stmt.match(/^if\s+(.+?)\s*;\s*then\s+(.+?)(?:\s*;\s*else\s+(.+?))?\s*;?\s*fi$/s)
    if (loop) {
      for (const item of tokenize(loop[2])) {
        vars[loop[1]] = item
        run(loop[3])
      }
    } else if (cond) {
      emit(pipeline(cond[1]))
      run(status === 0 ? cond[2] : (cond[3] ?? 'true'))
    } else run(stmt)
  }
  if (block.length) out.push({ kind: 'err', text: 'syntax error: unexpected end of file (missing done or fi?)' })
  return out
}
