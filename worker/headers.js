// Security headers added to every response the Worker sends.
// If a lesson starts loading something from a new host, add it to the matching directive below.

const policy = (directives) =>
  Object.entries(directives)
    .map(([name, values]) => [name, ...values].join(' '))
    .join('; ')

const PYODIDE = 'https://cdn.jsdelivr.net/pyodide/'
const SQLJS = 'https://cdnjs.cloudflare.com/ajax/libs/sql.js/'
const TURNSTILE = 'https://challenges.cloudflare.com'
// Hosts the API tester and lesson code are allowed to call.
const LESSON_APIS = ['https://jsonplaceholder.typicode.com', 'https://api.github.com']

// The app itself: no inline scripts, no eval, nothing framed from or loaded off other sites except these.
const APP = policy({
  'default-src': ["'self'"],
  // wasm-unsafe-eval lets the Python and SQL runners compile WebAssembly; it does not allow JS eval.
  'script-src': ["'self'", "'wasm-unsafe-eval'", TURNSTILE, PYODIDE, SQLJS],
  // CodeMirror and Turnstile insert <style> tags, so inline styles are allowed (styles cannot run code).
  'style-src': ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
  'font-src': ["'self'", 'https://fonts.gstatic.com'],
  'img-src': ["'self'", 'data:'],
  'connect-src': ["'self'", PYODIDE, SQLJS, ...LESSON_APIS],
  'frame-src': ["'self'", TURNSTILE],
  'worker-src': ["'self'"],
  'manifest-src': ["'self'"],
  'object-src': ["'none'"],
  'base-uri': ["'none'"],
  'form-action': ["'self'"],
  'frame-ancestors': ["'none'"],
})

// The JavaScript runner worker may compile learner code, but may only call the lesson APIs,
// never this site, so code pasted from elsewhere cannot act on the learner's account.
const JS_RUNNER = policy({
  'default-src': ["'none'"],
  'script-src': ["'unsafe-eval'"],
  'connect-src': LESSON_APIS,
})

// The HTML preview runs learner pages, scripts included. It is always loaded in a sandbox
// (opaque origin, no cookies, no access to the app), and only this site may frame it.
const HTML_PREVIEW = policy({
  'default-src': ['*', 'data:', 'blob:', "'unsafe-inline'", "'unsafe-eval'"],
  'frame-ancestors': ["'self'"],
})

const COMMON = {
  // .page is HTTPS-only in browsers already; this also covers subdomains and opts in to preload lists.
  'Strict-Transport-Security': 'max-age=63072000; includeSubDomains; preload',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=(), usb=(), bluetooth=(), serial=(), hid=()',
  'Cross-Origin-Opener-Policy': 'same-origin',
}

export function withSecurityHeaders(response, path) {
  const res = new Response(response.body, response)
  for (const [k, v] of Object.entries(COMMON)) res.headers.set(k, v)
  if (path === '/js-runner.js') {
    res.headers.set('Content-Security-Policy', JS_RUNNER)
  } else if (path === '/html-preview.html' || path === '/html-preview') {
    res.headers.set('Content-Security-Policy', HTML_PREVIEW)
    res.headers.set('X-Frame-Options', 'SAMEORIGIN')
  } else {
    res.headers.set('Content-Security-Policy', APP)
    res.headers.set('X-Frame-Options', 'DENY')
  }
  return res
}
