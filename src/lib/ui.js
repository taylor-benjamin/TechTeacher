// Shared class strings so every control looks and focuses the same way.
export const btn =
  'inline-flex items-center justify-center gap-1.5 rounded-full border border-line bg-panel px-4 py-1.5 text-sm font-medium text-ink hover:border-accent hover:bg-accent-soft disabled:cursor-not-allowed disabled:opacity-50'
export const btnPrimary =
  'glow inline-flex items-center justify-center gap-1.5 rounded-full border border-transparent bg-accent px-4 py-1.5 text-sm font-semibold text-on-accent hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50'
export const input =
  'rounded-full border border-edge bg-panel px-4 py-1.5 text-sm text-ink placeholder:text-muted'
// Multi-line fields keep squarer corners so text does not crowd the curve.
export const field = 'rounded-xl border border-edge bg-panel px-3 py-2 text-sm text-ink placeholder:text-muted'
export const card = 'rounded-2xl border border-line bg-panel'

// Dots give the level a non-colour cue. Labels come from t('levels.<id>').
export const LEVELS = {
  beginner: { dots: '●○○' },
  intermediate: { dots: '●●○' },
  advanced: { dots: '●●●' },
}

export const href = (key) => '#/' + key
