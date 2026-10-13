import { useEffect, useState } from 'react'

// useState that persists to localStorage (falls back to memory if storage is blocked).
export function useStored(key, initial) {
  const [value, setValue] = useState(() => {
    try {
      const saved = localStorage.getItem(key)
      if (saved != null) return JSON.parse(saved)
    } catch {}
    return typeof initial === 'function' ? initial() : initial
  })
  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(value))
    } catch {}
  }, [key, value])
  return [value, setValue]
}

const parse = () => location.hash.replace(/^#\/?/, '').split('/').filter(Boolean).map(decodeURIComponent)

// Hash routing works on any static host with no server config.
export function useHashRoute() {
  const [parts, setParts] = useState(parse)
  useEffect(() => {
    const onChange = () => setParts(parse())
    addEventListener('hashchange', onChange)
    return () => removeEventListener('hashchange', onChange)
  }, [])
  return parts
}
