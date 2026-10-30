import { useCallback, useEffect, useState } from 'react'
import i18n from '../i18n'

// Relative URLs, so the API is found next to the page. Hosts without the Worker
// (GitHub Pages) answer with a 404 page, and accounts stay hidden there.
async function call(path, { method = 'GET', body, captcha } = {}) {
  const res = await fetch(path, {
    method,
    credentials: 'same-origin',
    headers: {
      'x-lang': i18n.resolvedLanguage, // emails are written in this language
      ...(body && { 'content-type': 'application/json' }),
      ...(captcha && { 'x-captcha-response': captcha }),
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  const data = res.headers.get('content-type')?.includes('application/json') ? await res.json() : null
  if (!res.ok) throw Object.assign(new Error(data?.code ?? data?.error ?? `HTTP ${res.status}`), { status: res.status, data })
  return data
}

// status: 'loading' | 'unavailable' | 'signedOut' | 'signedIn'
export function useAccount() {
  const [state, setState] = useState({ status: 'loading', user: null })
  // email: whether password reset and verification emails are switched on for this deployment.
  const [features, setFeatures] = useState({ email: false })

  useEffect(() => {
    call('api/auth/get-session')
      .then((s) => setState(s?.user ? { status: 'signedIn', user: s.user } : { status: 'signedOut', user: null }))
      // 404 (no Worker, e.g. a static host) or 503 (not configured) means no accounts here.
      // Anything else is temporary, so still offer sign-in.
      .catch((e) => setState({ status: [404, 503, undefined].includes(e.status) ? 'unavailable' : 'signedOut', user: null }))
    call('api/features').then(setFeatures).catch(() => {})
  }, [])

  const signIn = useCallback(async (email, password, captcha) => {
    const { user } = await call('api/auth/sign-in/email', { method: 'POST', body: { email, password }, captcha })
    setState({ status: 'signedIn', user })
  }, [])

  const signUp = useCallback(async (name, email, password, captcha) => {
    const { user } = await call('api/auth/sign-up/email', { method: 'POST', body: { name, email, password, callbackURL: '/?verified=1#/account' }, captcha })
    setState({ status: 'signedIn', user })
  }, [])

  const signOut = useCallback(async () => {
    await call('api/auth/sign-out', { method: 'POST', body: {} })
    setState({ status: 'signedOut', user: null })
  }, [])

  const deleteAccount = useCallback(async (password) => {
    await call('api/auth/delete-user', { method: 'POST', body: { password } })
    setState({ status: 'signedOut', user: null })
  }, [])

  return { ...state, features, signIn, signUp, signOut, deleteAccount }
}

// The emailed links bring people back to the site with ?token=… (reset) or ?verified=1 (verification).
export const requestPasswordReset = (email, captcha) =>
  call('api/auth/request-password-reset', { method: 'POST', body: { email, redirectTo: '/#/reset' }, captcha })
export const resetPassword = (token, newPassword) => call('api/auth/reset-password', { method: 'POST', body: { token, newPassword } })
export const sendVerificationEmail = (email) =>
  call('api/auth/send-verification-email', { method: 'POST', body: { email, callbackURL: '/?verified=1#/account' } })
export const changePassword = (currentPassword, newPassword) =>
  call('api/auth/change-password', { method: 'POST', body: { currentPassword, newPassword, revokeOtherSessions: true } })

const lessonPath = (key) => 'api/progress/' + key.split('/').map(encodeURIComponent).join('/')

export const syncProgress = (keys) => call('api/progress/sync', { method: 'POST', body: { keys } })
export const setLessonDone = (key, done) => call(lessonPath(key), { method: done ? 'PUT' : 'DELETE' })
export const logActivity = (event, lessonKey) => call('api/activity', { method: 'POST', body: { event, lessonKey } })
export const getActivity = (before) => call('api/activity' + (before ? `?before=${before}` : ''))
