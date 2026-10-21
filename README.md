# TechTeacher
Link to live site: https://taylor-benjamin.github.io/TechTeacher/****

A single-page learning platform covering Software Development, AI/ML, Networking, Web Design and Cybersecurity. Built with React, Tailwind CSS and Vite. All lesson content lives in JSON.

## Run it

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # production build in dist/
npm run preview    # serve the build at http://localhost:4173
```

## Add or edit a lesson

Lessons live in `src/content/modules/<tab>/<nn>-<module>.json`. Any JSON file in those folders is loaded automatically, so adding a module is just adding a file.

Every lesson has the same six parts:

```jsonc
{
  "id": "my-lesson",            // unique within the module, used in the URL
  "title": "My lesson",
  "level": "beginner",          // beginner | intermediate | advanced
  "minutes": 10,
  "concept":   { "text": "Plain-language explanation.", "analogy": "It is like…" },
  "visual":    { "type": "flow", "nodes": [{ "label": "A", "detail": "…" }] },
  "steps":     [{ "title": "First", "text": "Do this.", "code": "optional" }],
  "interactive": { "type": "quiz", "questions": [{ "q": "?", "options": ["a", "b"], "answer": 0, "explain": "…" }] },
  "challenge": { "prompt": "Try…", "hint": "…", "solution": "…" },
  "takeaways": ["One", "Two"]
}
```

Text supports `**bold**`, `` `code` `` and blank lines between paragraphs. Glossary terms are underlined automatically.

| Field | Options |
| --- | --- |
| `visual.type` | `flow` (nodes), `layers` (layers), `sequence` (actors, messages), `compare` (columns, rows), `cards` (items) |
| `interactive.type` | `quiz`, `order`, `code`, `api-tester`, `neural-net`, `tokenizer`, `subnet`, `topology`, `hash`, `cipher`, `packets`, `contrast` |
| `code` languages | `javascript`, `node`, `python`, `sql` (optional `seed`), `html`, `bash`, `java`, `csharp` (give `expected`) |
| `challenge` extras | `language` + `starter` add a code runner; `"code": true` shows the solution as a code block |

Other content files: `tabs.json` (the five subjects), `glossary.json` (hover definitions) and `paths.json` (learning paths, as lists of `tab/module/lesson` keys).

After editing content, run `npm run validate`. It checks every lesson and learning path and names the file and lesson for each problem.

## Spanish

The EN/ES switch in the header translates the whole site. Spanish-language browsers start in Spanish, and the choice is saved under `tt.lang`.

- Interface text lives in `src/locales/en.json` and `es.json` (i18next).
- Lesson text lives in `src/content/es/`, which mirrors `src/content/` but holds only the readable strings. Code, ids and numbers always come from the English files, and anything not yet translated falls back to English.
- `npm run check:es` lists every string that is missing or misplaced in the Spanish files. To start translating a new module, `node scripts/i18n-content.mjs extract <dir>` writes English skeletons in the right shape.

## How code runs in the browser

| Language | Runtime |
| --- | --- |
| JavaScript, Node.js | A sandboxed Web Worker. Node-only modules such as `fs` are not available. |
| Python | Pyodide, loaded from a CDN on first run |
| SQL | sql.js (SQLite compiled to WebAssembly), loaded from a CDN on first run |
| HTML and CSS | A sandboxed iframe with live preview |
| Bash | A simulated shell (`src/interactive/bashSim.js`) with a small practice file system |
| Java, C# | No browser runtime exists, so these show the expected output of the starter program. To run them for real, host a [Piston](https://github.com/engineer-man/piston) server and set `VITE_PISTON_URL` in a `.env` file. |

## Tests

```bash
npm run validate      # lesson format and learning-path links
npm run check:es      # Spanish translations are complete
npm run test:bash     # runs the Bash lesson snippets through the simulated shell

# With `npm run build` done and `npm run preview` running in another terminal:
npm run test:e2e                  # drives every interactive widget in headless Edge
powershell -ExecutionPolicy Bypass -File scripts/smoke.ps1 -Quiet   # renders every route
```

## Deploy

The build is fully static and uses relative paths, so `dist/` works on any host.

- **Netlify / Vercel**: import the repository. Build command `npm run build`, output directory `dist`.
- **GitHub Pages**: `.github/workflows/deploy.yml` validates the content, builds and publishes `dist/` on every push to `main`. In the repository's Settings → Pages, set the source to **GitHub Actions** once.

## Project layout

```
src/
  App.jsx               layout, routing, sidebar, level filter
  components/           Lesson, Visual (diagrams), RichText (glossary tooltips), Home, Search
  interactive/          code runner, API tester, neural net, tokenizer, subnet calculator,
                        topology builder, hash and cipher demos, packet viewer, contrast checker
  content/              tabs, glossary, paths and modules/<tab>/*.json
  content/es/           Spanish strings for the same files
  locales/              interface text in English and Spanish
  lib/                  content loading and search, localStorage hooks, shared styles
scripts/                validation and test scripts
```

Progress, theme, language, level filter and the topology canvas are saved in `localStorage` under keys starting with `tt.`.
