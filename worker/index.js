import { createAuth } from './auth'
import { ensureSchema } from './schema'

// Lesson keys look like "web/html-basics/intro"; anything else is rejected.
const LESSON_KEY = /^[a-z0-9-]{1,40}(\/[a-z0-9-]{1,60}){2}$/
const EVENTS = new Set(['lesson_open', 'lesson_complete', 'lesson_uncomplete'])
const MAX_SYNC = 500

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } })

// Writes from a page on another site are refused, so a logged-in visitor's cookie can't be borrowed.
const sameOrigin = (request) => request.headers.get('origin') === new URL(request.url).origin

async function api(request, env, userId, path) {
  const { method } = request
  const db = env.DB

  if (path === '/api/progress' && method === 'GET') {
    const { results } = await db.prepare('select "lessonKey", "completedAt" from "progress" where "userId" = ?').bind(userId).all()
    return json({ progress: Object.fromEntries(results.map((r) => [r.lessonKey, r.completedAt])) })
  }

  // Merge lessons completed while signed out into the account. Never removes anything.
  if (path === '/api/progress/sync' && method === 'POST') {
    const { keys } = await request.json().catch(() => ({}))
    if (!Array.isArray(keys) || keys.length > MAX_SYNC || !keys.every((k) => LESSON_KEY.test(k))) return json({ error: 'bad_request' }, 400)
    const now = Date.now()
    const insert = db.prepare('insert or ignore into "progress" ("userId", "lessonKey", "completedAt") values (?, ?, ?)')
    if (keys.length) await db.batch(keys.map((k) => insert.bind(userId, k, now)))
    return api(new Request(request.url, { method: 'GET' }), env, userId, '/api/progress')
  }

  const lessonMatch = path.match(/^\/api\/progress\/(.+)$/)
  if (lessonMatch && (method === 'PUT' || method === 'DELETE')) {
    const key = decodeURIComponent(lessonMatch[1])
    if (!LESSON_KEY.test(key)) return json({ error: 'bad_request' }, 400)
    const now = Date.now()
    const done = method === 'PUT'
    await db.batch([
      done
        ? db.prepare('insert or ignore into "progress" ("userId", "lessonKey", "completedAt") values (?, ?, ?)').bind(userId, key, now)
        : db.prepare('delete from "progress" where "userId" = ? and "lessonKey" = ?').bind(userId, key),
      db.prepare('insert into "activity" ("userId", "event", "lessonKey", "at") values (?, ?, ?, ?)').bind(userId, done ? 'lesson_complete' : 'lesson_uncomplete', key, now),
    ])
    return json({ ok: true })
  }

  if (path === '/api/activity' && method === 'POST') {
    const { event, lessonKey } = await request.json().catch(() => ({}))
    if (!EVENTS.has(event) || (lessonKey != null && !LESSON_KEY.test(lessonKey))) return json({ error: 'bad_request' }, 400)
    await db.prepare('insert into "activity" ("userId", "event", "lessonKey", "at") values (?, ?, ?, ?)').bind(userId, event, lessonKey ?? null, Date.now()).run()
    return json({ ok: true })
  }

  if (path === '/api/activity' && method === 'GET') {
    const { results } = await db
      .prepare('select "event", "lessonKey", "at" from "activity" where "userId" = ? order by "at" desc limit 50')
      .bind(userId)
      .all()
    return json({ activity: results })
  }

  return json({ error: 'not_found' }, 404)
}

export default {
  async fetch(request, env) {
    const path = new URL(request.url).pathname
    if (!path.startsWith('/api/')) return env.ASSETS.fetch(request)

    if (!env.BETTER_AUTH_SECRET) return json({ error: 'accounts_not_configured' }, 503)
    await ensureSchema(env.DB)
    const auth = createAuth(env, request)

    if (path.startsWith('/api/auth/')) return auth.handler(request)

    if (request.method !== 'GET' && !sameOrigin(request)) return json({ error: 'forbidden' }, 403)
    const session = await auth.api.getSession({ headers: request.headers })
    if (!session) return json({ error: 'unauthorized' }, 401)
    return api(request, env, session.user.id, path)
  },
}
