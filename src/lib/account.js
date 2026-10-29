import { useCallback, useEffect, useState } from 'react'

// Relative URLs, so the API is found next to the page. Hosts without the Worker
// (GitHub Pages) answer with a 404 page, and accounts stay hidden there.
async function call(path, { method = 'GET', body, captcha } = {}) {
  const res = await fetch(path, {
    method,
    credentials: 'same-origin',
    headers: {
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

  useEffect(() => {
    call('api/auth/get-session')
      .then((s) => setState(s?.user ? { status: 'signedIn', user: s.user } : { status: 'signedOut', user: null }))
      .catch(() => setState({ status: 'unavailable', user: null }))
  }, [])

  const signIn = useCallback(async (email, password, captcha) => {
    const { user } = await call('api/auth/sign-in/email', { method: 'POST', body: { email, password }, captcha })
    setState({ status: 'signedIn', user })
  }, [])

  const signUp = useCallback(async (name, email, password, captcha) => {
    const { user } = await call('api/auth/sign-up/email', { method: 'POST', body: { name, email, password }, captcha })
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

  return { ...state, signIn, signUp, signOut, deleteAccount }
}

const lessonPath = (key) => 'api/progress/' + key.split('/').map(encodeURIComponent).join('/')

export const syncProgress = (keys) => call('api/progress/sync', { method: 'POST', body: { keys } })
export const setLessonDone = (key, done) => call(lessonPath(key), { method: done ? 'PUT' : 'DELETE' })
export const logActivity = (event, lessonKey) => call('api/activity', { method: 'POST', body: { event, lessonKey } })
export const getActivity = () => call('api/activity')
