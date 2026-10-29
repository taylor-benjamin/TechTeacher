import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react'
import { useTranslation } from 'react-i18next'

const SITE_KEY = '0x4AAAAAAFrMRmmoutD4iPOT'
// Cloudflare's always-pass test key, so the widget works on localhost (the server skips the check there).
const TEST_KEY = '1x00000000000000000000AA'
const isLocal = ['localhost', '127.0.0.1'].includes(location.hostname)

let script
function loadTurnstile() {
  script ??= new Promise((resolve, reject) => {
    const s = document.createElement('script')
    s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'
    s.async = true
    s.onload = () => resolve(window.turnstile)
    s.onerror = () => ((script = undefined), reject(new Error('turnstile_load_failed')))
    document.head.append(s)
  })
  return script
}

// Bot check for the sign-in and sign-up forms. Calls onToken with a one-time token, or null when it expires.
// Tokens are single use, so the parent calls ref.reset() after each submit.
export default forwardRef(function Turnstile({ onToken }, ref) {
  const { i18n } = useTranslation()
  const el = useRef(null)
  const widget = useRef(null)

  useImperativeHandle(ref, () => ({
    reset() {
      onToken(null)
      if (widget.current != null) window.turnstile?.reset(widget.current)
    },
  }))

  useEffect(() => {
    let cancelled = false
    loadTurnstile()
      .then((turnstile) => {
        if (cancelled || !el.current) return
        widget.current = turnstile.render(el.current, {
          sitekey: isLocal ? TEST_KEY : SITE_KEY,
          theme: document.documentElement.classList.contains('dark') ? 'dark' : 'light',
          language: i18n.resolvedLanguage,
          size: 'flexible',
          callback: onToken,
          'expired-callback': () => onToken(null),
          'error-callback': () => onToken(null),
        })
      })
      .catch(() => onToken(null))
    return () => {
      cancelled = true
      if (widget.current != null) window.turnstile?.remove(widget.current)
      widget.current = null
    }
  }, [i18n.resolvedLanguage]) // eslint-disable-line react-hooks/exhaustive-deps

  return <div ref={el} className="min-h-[65px]" />
})
