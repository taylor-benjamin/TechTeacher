# TechTeacher
Link to live site: https://techteacher.page

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
npm run check:contrast  # every theme colour pairing meets WCAG 2.2 AA (also runs on deploy)
npm run test:bash     # runs the Bash lesson snippets through the simulated shell

# With `npm run build` done and `npm run preview` running in another terminal:
npm run test:e2e                  # drives every interactive widget in headless Edge
powershell -ExecutionPolicy Bypass -File scripts/smoke.ps1 -Quiet   # renders every route
```

## Deploy

The build is fully static and uses relative paths, so `dist/` works on any host.

- **Netlify / Vercel**: import the repository. Build command `npm run build`, output directory `dist`.
- **GitHub Pages**: `.github/workflows/deploy.yml` validates the content and builds on every push to `main`, then publishes only `pages-redirect/`, which sends old `github.io` links to techteacher.page.
- **Cloudflare Workers** (the only host with accounts): Workers Builds runs `npx wrangler deploy` on every push to `main`. The public address is `techteacher.page`; `www.techteacher.page` and the `workers.dev` address redirect there. `wrangler.jsonc` builds the site, serves `dist/`, and routes `/api/*` to `worker/index.js`. The D1 database `techteacher-db` is created on the first deploy and its tables on the first API request.

## Accounts

Signed-in users' lesson progress and activity are stored in D1, so they follow them between devices. Signed-out visitors keep using `localStorage`, and their progress is merged into the account when they sign in. On hosts without the Worker the account button is hidden.

- Auth is [Better Auth](https://better-auth.com) with email and password (`worker/auth.js`). Passwords are hashed with PBKDF2-SHA256 through Web Crypto, and sign-in, sign-up and delete are rate-limited per IP.
- The Worker needs one secret, `BETTER_AUTH_SECRET` (a long random string), set in the Cloudflare dashboard under the Worker's **Settings → Variables and Secrets**. Without it, `/api/*` answers 503 and the site still works without accounts.
- Sign-in and sign-up are protected by Cloudflare Turnstile (`src/components/Turnstile.jsx`). The site key is in that file; the secret key goes in a second Worker secret, `TECH_TEACHER_TURNSTILE`. The server only enforces the check once that secret exists. On localhost the widget uses Cloudflare's always-pass test key.
- Password reset, email verification and change password use [Resend](https://resend.com) (`worker/email.js`), sending from `no-reply@techteacher.page`. They switch on once the `RESEND_API_KEY` Worker secret is set; verification is encouraged, not required.
- API: `GET /api/features`, `GET /api/progress`, `POST /api/progress/sync`, `PUT`/`DELETE /api/progress/<lesson key>`, `GET`/`POST /api/activity`.
- Run it locally: put `BETTER_AUTH_SECRET=<anything>` in `.dev.vars`, then `npm run build` and `npx wrangler dev` (uses a local D1 copy).

## Security

- **Headers** (`worker/headers.js`, added to every response): a strict Content-Security-Policy (no inline scripts or `eval` on the app, only listed hosts), HSTS, `X-Frame-Options: DENY`, `nosniff`, a strict referrer policy, a locked-down Permissions-Policy and `Cross-Origin-Opener-Policy`. If a lesson needs a new external host, add it there; `scripts/e2e.mjs` fails on any policy violation.
- **Code runners** keep their own policies: learner JavaScript runs in `public/js-runner.js`, which may compile code but cannot call this site; learner HTML renders in the sandboxed `public/html-preview.html`.
- **Accounts**: PBKDF2 password hashes, breached-password check (Have I Been Pwned, k-anonymity) on sign-up/reset/change, Turnstile on sign-in/sign-up/reset, per-IP rate limits, session revocation on password reset and change, same-origin checks on writes.
- **Dependencies**: Dependabot (`.github/dependabot.yml`) opens update PRs weekly; security updates arrive immediately.

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
worker/                 Cloudflare Worker: API routes, Better Auth setup, D1 schema
scripts/                validation and test scripts
```

Progress, theme, language, level filter and the topology canvas are saved in `localStorage` under keys starting with `tt.`.
