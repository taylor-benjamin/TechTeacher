import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { getActivity } from '../lib/account'
import { useContent } from '../lib/content'
import { btn, btnPrimary, card, href, input } from '../lib/ui'
import Turnstile from './Turnstile'

// Maps an API error to a translated message; unknown codes fall back to a generic one.
function useErrorText() {
  const { t } = useTranslation()
  return (err) => {
    if (err?.status === 429) return t('account.errors.tooMany')
    const code = err?.data?.code
    return t(`account.errors.${code}`, { defaultValue: t('account.errors.generic') })
  }
}

function Field({ id, label, ...props }) {
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium">{label}</label>
      <input id={id} name={id} required className={`${input} mt-1 w-full`} {...props} />
    </div>
  )
}

function SignInForm({ account }) {
  const { t } = useTranslation()
  const errorText = useErrorText()
  const [mode, setMode] = useState('signIn')
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)
  const [captcha, setCaptcha] = useState(null)
  const turnstile = useRef(null)
  const signingUp = mode === 'signUp'

  async function onSubmit(e) {
    e.preventDefault()
    const f = new FormData(e.currentTarget)
    setBusy(true)
    setError(null)
    try {
      if (signingUp) await account.signUp(f.get('name').trim(), f.get('email').trim(), f.get('password'), captcha)
      else await account.signIn(f.get('email').trim(), f.get('password'), captcha)
    } catch (err) {
      setError(errorText(err))
      turnstile.current?.reset() // each token works once
    } finally {
      setBusy(false)
    }
  }

  return (
    <section aria-labelledby="account-h" className={`${card} mx-auto max-w-md p-6`}>
      <h1 id="account-h" className="text-2xl font-normal tracking-tight">{signingUp ? t('account.createTitle') : t('account.signInTitle')}</h1>
      <p className="mt-1 text-sm text-muted">{t('account.why')}</p>
      <form className="mt-5 space-y-3" onSubmit={onSubmit}>
        {signingUp && <Field id="name" label={t('account.name')} autoComplete="name" maxLength={80} />}
        <Field id="email" label={t('account.email')} type="email" autoComplete="email" maxLength={254} />
        <Field
          id="password"
          label={t('account.password')}
          type="password"
          autoComplete={signingUp ? 'new-password' : 'current-password'}
          minLength={signingUp ? 10 : undefined}
          maxLength={128}
          aria-describedby={signingUp ? 'password-hint' : undefined}
        />
        {signingUp && <p id="password-hint" className="text-xs text-muted">{t('account.passwordHint')}</p>}
        <Turnstile ref={turnstile} onToken={setCaptcha} />
        {error && <p role="alert" className="text-sm text-bad">{error}</p>}
        <button type="submit" className={`${btnPrimary} w-full`} disabled={busy || !captcha}>
          {signingUp ? t('account.create') : t('account.signIn')}
        </button>
      </form>
      <p className="mt-4 text-center text-sm">
        {signingUp ? t('account.haveAccount') : t('account.noAccount')}{' '}
        <button type="button" className="font-medium underline" onClick={() => (setMode(signingUp ? 'signIn' : 'signUp'), setError(null))}>
          {signingUp ? t('account.signIn') : t('account.create')}
        </button>
      </p>
    </section>
  )
}

function Profile({ account, done }) {
  const { t, i18n } = useTranslation()
  const { allLessons, lessonByKey } = useContent()
  const errorText = useErrorText()
  const [activity, setActivity] = useState(null)
  const [error, setError] = useState(null)
  const completed = allLessons.filter((l) => done[l.key]).length

  useEffect(() => {
    getActivity().then((r) => setActivity(r.activity)).catch(() => setActivity([]))
  }, [done])

  async function onDelete(e) {
    e.preventDefault()
    if (!confirm(t('account.deleteConfirm'))) return
    try {
      await account.deleteAccount(new FormData(e.currentTarget).get('confirm-password'))
    } catch (err) {
      setError(errorText(err))
    }
  }

  const when = new Intl.DateTimeFormat(i18n.resolvedLanguage, { dateStyle: 'medium', timeStyle: 'short' })

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <section aria-labelledby="account-h" className={`${card} p-6`}>
        <h1 id="account-h" className="text-2xl font-normal tracking-tight">{t('account.title')}</h1>
        <p className="mt-1 text-muted">{account.user.name} · {account.user.email}</p>
        <p className="mt-4 text-sm">{t('account.completed', { count: completed, total: allLessons.length })}</p>
        <button type="button" className={`${btn} mt-4`} onClick={account.signOut}>{t('account.signOut')}</button>
      </section>

      <section aria-labelledby="activity-h" className={`${card} p-6`}>
        <h2 id="activity-h" className="text-lg font-medium">{t('account.activity')}</h2>
        {activity == null ? null : activity.length === 0 ? (
          <p className="mt-2 text-sm text-muted">{t('account.noActivity')}</p>
        ) : (
          <ul className="mt-3 space-y-2 text-sm">
            {activity.map((a, i) => {
              const lesson = lessonByKey[a.lessonKey]
              return (
                <li key={i} className="flex flex-wrap justify-between gap-x-4">
                  <span>
                    {t(`account.events.${a.event}`)}
                    {lesson && <> · <a className="underline" href={href(lesson.key)}>{lesson.title}</a></>}
                  </span>
                  <time className="text-muted" dateTime={new Date(a.at).toISOString()}>{when.format(a.at)}</time>
                </li>
              )
            })}
          </ul>
        )}
      </section>

      <section aria-labelledby="delete-h" className={`${card} p-6`}>
        <h2 id="delete-h" className="text-lg font-medium">{t('account.deleteTitle')}</h2>
        <p className="mt-1 text-sm text-muted">{t('account.deleteText')}</p>
        <form className="mt-3 flex flex-wrap items-end gap-2" onSubmit={onDelete}>
          <div className="min-w-0 flex-1">
            <Field id="confirm-password" label={t('account.password')} type="password" autoComplete="current-password" />
          </div>
          <button type="submit" className={`${btn} border-bad text-bad`}>{t('account.delete')}</button>
        </form>
        {error && <p role="alert" className="mt-2 text-sm text-bad">{error}</p>}
      </section>
    </div>
  )
}

export default function Account({ account, done }) {
  const { t } = useTranslation()
  if (account.status === 'loading') return null
  if (account.status === 'unavailable') return <p className={`${card} p-6`}>{t('account.unavailable')}</p>
  return account.status === 'signedIn' ? <Profile account={account} done={done} /> : <SignInForm account={account} />
}
