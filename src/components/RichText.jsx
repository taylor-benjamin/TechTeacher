import { useId, useRef, useState } from 'react'
import { glossaryLookup, glossaryRegex } from '../lib/content'

// Glossary term with a tooltip that works on hover, focus and tap, and closes on Escape.
function Term({ text, entry }) {
  const [open, setOpen] = useState(false)
  const [alignRight, setAlignRight] = useState(false)
  const ref = useRef(null)
  const id = useId()
  const show = () => {
    setAlignRight(ref.current.getBoundingClientRect().left + 272 > window.innerWidth)
    setOpen(true)
  }
  const hide = () => setOpen(false)
  return (
    <span className="relative inline-block" onMouseEnter={show} onMouseLeave={hide}>
      <button
        ref={ref}
        type="button"
        className="term"
        aria-describedby={open ? id : undefined}
        onFocus={show}
        onBlur={hide}
        onClick={show}
        onKeyDown={(e) => e.key === 'Escape' && hide()}
      >
        {text}
      </button>
      {open && (
        <span
          id={id}
          role="tooltip"
          className={`absolute top-full z-30 w-64 rounded-md bg-ink p-2 text-left text-sm font-normal text-surface shadow-lg ${alignRight ? 'right-0' : 'left-0'}`}
        >
          <strong>{entry.term}:</strong> {entry.def}
        </span>
      )}
    </span>
  )
}

function inline(text, seen, keyBase) {
  const out = []
  text.split(/(`[^`]+`|\*\*[^*]+\*\*)/).forEach((part, i) => {
    const key = `${keyBase}-${i}`
    if (part.startsWith('`')) return out.push(<code key={key}>{part.slice(1, -1)}</code>)
    if (part.startsWith('**')) return out.push(<strong key={key}>{part.slice(2, -2)}</strong>)
    // Only the first mention of each term in a block gets a tooltip.
    part.split(glossaryRegex).forEach((piece, j) => {
      const entry = j % 2 ? glossaryLookup(piece) : null
      if (entry && !seen.has(entry.term)) {
        seen.add(entry.term)
        out.push(<Term key={`${key}-${j}`} text={piece} entry={entry} />)
      } else if (piece) out.push(piece)
    })
  })
  return out
}

// Renders lesson text: blank lines split paragraphs, `code`, **bold**, glossary tooltips.
export default function RichText({ text, className = '', glossary = true }) {
  if (!text) return null
  const seen = glossary ? new Set() : { has: () => true }
  return (
    <div className={`prose-tt leading-relaxed ${className}`}>
      {text.split(/\n\n+/).map((p, i) => (
        <p key={i}>{inline(p, seen, i)}</p>
      ))}
    </div>
  )
}
