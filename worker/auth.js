import { betterAuth } from 'better-auth'
import { captcha } from 'better-auth/plugins/captcha'
import { sendEmail } from './email'

// Better Auth's default scrypt hash runs in pure JS and can exceed the Workers CPU limit,
// so passwords use the runtime's native PBKDF2-SHA256 instead (100k is the Workers maximum).
const ITERATIONS = 100_000
const enc = new TextEncoder()
const toHex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('')
const fromHex = (hex) => Uint8Array.from(hex.match(/../g), (h) => parseInt(h, 16))

async function pbkdf2(password, salt, iterations) {
  const key = await crypto.subtle.importKey('raw', enc.encode(password.normalize('NFKC')), 'PBKDF2', false, ['deriveBits'])
  return crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations }, key, 256)
}

async function hashPassword(password) {
  const salt = crypto.getRandomValues(new Uint8Array(16))
  return `pbkdf2-sha256$${ITERATIONS}$${toHex(salt)}$${toHex(await pbkdf2(password, salt, ITERATIONS))}`
}

async function verifyPassword({ hash, password }) {
  const [scheme, iterations, salt, expected] = hash.split('$')
  if (scheme !== 'pbkdf2-sha256') return false
  const actual = new Uint8Array(await pbkdf2(password, fromHex(salt), Number(iterations)))
  const want = fromHex(expected)
  // Constant-time comparison.
  let diff = actual.length ^ want.length
  for (let i = 0; i < want.length; i++) diff |= actual[i] ^ want[i]
  return diff === 0
}

// Built per request so the base URL matches whichever host served it (workers.dev, preview, custom domain).
export function createAuth(env, request) {
  const origin = new URL(request.url).origin
  // Emails go out in the language the site is shown in (sent by the client as x-lang).
  const lang = request.headers.get('x-lang') === 'es' ? 'es' : 'en'
  // Password reset and email verification switch on once the RESEND_API_KEY secret is set.
  const mail = env.RESEND_API_KEY
    ? (kind) => ({ user, url }) => sendEmail(env, { to: user.email, lang, kind, name: user.name, url })
    : null
  return betterAuth({
    database: env.DB,
    secret: env.BETTER_AUTH_SECRET,
    baseURL: origin,
    basePath: '/api/auth',
    trustedOrigins: [origin],
    emailAndPassword: {
      enabled: true,
      minPasswordLength: 10,
      maxPasswordLength: 128,
      password: { hash: hashPassword, verify: verifyPassword },
      sendResetPassword: mail?.('reset'),
      resetPasswordTokenExpiresIn: 60 * 60,
      revokeSessionsOnPasswordReset: true,
    },
    // Verification is encouraged, not required, so accounts made before email existed keep working.
    emailVerification: mail
      ? { sendVerificationEmail: mail('verify'), sendOnSignUp: true, autoSignInAfterVerification: true, expiresIn: 60 * 60 * 24 }
      : undefined,
    user: { deleteUser: { enabled: true } },
    session: { expiresIn: 60 * 60 * 24 * 30, updateAge: 60 * 60 * 24 },
    rateLimit: {
      enabled: true,
      storage: 'database',
      window: 60,
      max: 60,
      customRules: {
        '/sign-in/email': { window: 60, max: 5 },
        '/sign-up/email': { window: 600, max: 5 },
        '/delete-user': { window: 600, max: 5 },
        '/request-password-reset': { window: 600, max: 3 },
        '/send-verification-email': { window: 600, max: 3 },
        '/change-password': { window: 600, max: 5 },
        '/reset-password': { window: 600, max: 5 },
      },
    },
    advanced: { ipAddress: { ipAddressHeaders: ['cf-connecting-ip'] } },
    telemetry: { enabled: false },
    // Turnstile is enforced once the TECH_TEACHER_TURNSTILE secret is set (local dev runs without it).
    plugins: env.TECH_TEACHER_TURNSTILE
      ? [
          captcha({
            provider: 'cloudflare-turnstile',
            secretKey: env.TECH_TEACHER_TURNSTILE,
            endpoints: ['/sign-up/email', '/sign-in/email', '/request-password-reset'],
            allowedHostnames: [new URL(origin).hostname],
          }),
        ]
      : [],
  })
}
