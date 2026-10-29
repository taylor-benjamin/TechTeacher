import { useTranslation } from 'react-i18next'
import { card } from '../lib/ui'

// Plain-language privacy notice. The text lives in locales/*.json under "privacy".
export default function Privacy() {
  const { t } = useTranslation()
  const sections = t('privacy.sections')
  return (
    <article aria-labelledby="privacy-h" className={`${card} mx-auto max-w-2xl p-6 sm:p-8`}>
      <h1 id="privacy-h" className="text-2xl font-normal tracking-tight">{t('privacy.title')}</h1>
      <p className="mt-1 text-sm text-muted">{t('privacy.updated')}</p>
      <p className="mt-4">{t('privacy.intro')}</p>
      {sections.map((s) => (
        <section key={s.heading} className="mt-6">
          <h2 className="text-lg font-medium">{s.heading}</h2>
          <ul className="mt-2 list-disc space-y-1.5 pl-5 text-sm leading-relaxed">
            {s.items.map((item) => <li key={item}>{item}</li>)}
          </ul>
        </section>
      ))}
    </article>
  )
}
