// Transactional email through Resend (https://resend.com/docs/api-reference/emails/send-email).
const FROM = 'TechTeacher <no-reply@techteacher.page>'

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])

const COPY = {
  en: {
    verify: {
      subject: 'Confirm your TechTeacher email',
      intro: 'Confirm this is your email address so you can reset your password if you ever forget it.',
      button: 'Confirm email',
      note: 'If you did not create a TechTeacher account, you can ignore this email.',
    },
    reset: {
      subject: 'Reset your TechTeacher password',
      intro: 'Someone asked to reset the password for your TechTeacher account. The link works once and expires in 1 hour.',
      button: 'Choose a new password',
      note: 'If this was not you, ignore this email. Your password stays the same.',
    },
    greeting: (name) => `Hi ${name},`,
  },
  es: {
    verify: {
      subject: 'Confirma tu correo de TechTeacher',
      intro: 'Confirma que esta es tu dirección de correo para poder restablecer tu contraseña si alguna vez la olvidas.',
      button: 'Confirmar correo',
      note: 'Si no creaste una cuenta en TechTeacher, puedes ignorar este correo.',
    },
    reset: {
      subject: 'Restablece tu contraseña de TechTeacher',
      intro: 'Alguien pidió restablecer la contraseña de tu cuenta de TechTeacher. El enlace funciona una vez y caduca en 1 hora.',
      button: 'Elegir una contraseña nueva',
      note: 'Si no fuiste tú, ignora este correo. Tu contraseña no cambia.',
    },
    greeting: (name) => `Hola, ${name}:`,
  },
}

function render(lang, kind, name, url) {
  const c = COPY[lang] ?? COPY.en
  const t = c[kind]
  const text = `${c.greeting(name)}\n\n${t.intro}\n\n${t.button}: ${url}\n\n${t.note}\n`
  const html = `<!doctype html><html lang="${lang}"><body style="margin:0;background:#f4f4f7;font-family:Arial,Helvetica,sans-serif;color:#1a1a2e">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:#ffffff;border-radius:16px;padding:32px">
<tr><td style="font-size:20px;font-weight:bold;padding-bottom:16px">TechTeacher</td></tr>
<tr><td style="font-size:15px;line-height:1.6">${esc(c.greeting(name))}<br><br>${esc(t.intro)}</td></tr>
<tr><td style="padding:24px 0"><a href="${esc(url)}" style="display:inline-block;background:#3d2a8c;color:#ffffff;text-decoration:none;font-weight:bold;padding:12px 24px;border-radius:999px">${esc(t.button)}</a></td></tr>
<tr><td style="font-size:13px;line-height:1.5;color:#5a5a6e">${esc(t.note)}<br><br><a href="${esc(url)}" style="color:#5a5a6e;word-break:break-all">${esc(url)}</a></td></tr>
</table></td></tr></table></body></html>`
  return { subject: t.subject, text, html }
}

// Failures are logged rather than thrown, so a mail outage never blocks sign-up.
export async function sendEmail(env, { to, lang, kind, name, url }) {
  const { subject, text, html } = render(lang, kind, name, url)
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { authorization: `Bearer ${env.RESEND_API_KEY}`, 'content-type': 'application/json' },
      body: JSON.stringify({ from: FROM, to: [to], subject, text, html }),
    })
    if (!res.ok) console.error('resend error', res.status, await res.text())
  } catch (err) {
    console.error('resend failed', err)
  }
}
