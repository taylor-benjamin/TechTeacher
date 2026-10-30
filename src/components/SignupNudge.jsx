import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { btn, btnPrimary, card } from '../lib/ui'

// Shown to signed-out learners right after they complete a lesson: a gentle, dismissible
// invitation to save progress across devices. Announced politely; it never steals focus.
export default function SignupNudge({ count, onCreate, onDismiss }) {
  const { t } = useTranslation()
  const ref = useRef(null)
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && ref.current?.contains(document.activeElement) && onDismiss()
    addEventListener('keydown', onKey)
    return () => removeEventListener('keydown', onKey)
  }, [onDismiss])

  return (
    <aside
      ref={ref}
      role="status"
      aria-labelledby="nudge-h"
      className={`${card} fixed inset-x-4 bottom-4 z-50 p-4 shadow-xl sm:inset-x-auto sm:right-4 sm:w-96`}
    >
      <h2 id="nudge-h" className="font-semibold">{t('nudge.title', { count })}</h2>
      <p className="mt-1 text-sm text-muted">{t('nudge.text')}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <a href="#/account/create" className={btnPrimary} onClick={onCreate}>{t('account.create')}</a>
        <button type="button" className={btn} onClick={onDismiss}>{t('nudge.notNow')}</button>
      </div>
    </aside>
  )
}
