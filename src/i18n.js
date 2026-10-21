import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import en from './locales/en.json'
import es from './locales/es.json'

export const LANGS = ['en', 'es']

// A saved choice wins; otherwise Spanish-language browsers start in Spanish.
function initialLanguage() {
  try {
    const saved = JSON.parse(localStorage.getItem('tt.lang'))
    if (LANGS.includes(saved)) return saved
  } catch {}
  return navigator.languages?.some((l) => l.toLowerCase().startsWith('es')) ? 'es' : 'en'
}

i18n.use(initReactI18next).init({
  resources: { en: { translation: en }, es: { translation: es } },
  lng: initialLanguage(),
  fallbackLng: 'en',
  supportedLngs: LANGS,
  interpolation: { escapeValue: false }, // React already escapes
  returnObjects: true,
})

// Only an explicit switch is saved, so the browser default keeps applying until then.
document.documentElement.lang = i18n.language
i18n.on('languageChanged', (lng) => {
  document.documentElement.lang = lng
  try {
    localStorage.setItem('tt.lang', JSON.stringify(lng))
  } catch {}
})

export default i18n
