// D1 schema, applied idempotently on the first request each Worker instance serves.
// The first five tables are Better Auth's (generated with its getMigrations for SQLite).
// To change a table later, add a new statement here (ALTER TABLE ...) rather than editing one.
export const SCHEMA = [
  `create table if not exists "user" ("id" text not null primary key, "name" text not null, "email" text not null unique, "emailVerified" integer not null, "image" text, "createdAt" date not null, "updatedAt" date not null)`,
  `create table if not exists "session" ("id" text not null primary key, "expiresAt" date not null, "token" text not null unique, "createdAt" date not null, "updatedAt" date not null, "ipAddress" text, "userAgent" text, "userId" text not null references "user" ("id") on delete cascade)`,
  `create table if not exists "account" ("id" text not null primary key, "accountId" text not null, "providerId" text not null, "userId" text not null references "user" ("id") on delete cascade, "accessToken" text, "refreshToken" text, "idToken" text, "accessTokenExpiresAt" date, "refreshTokenExpiresAt" date, "scope" text, "password" text, "createdAt" date not null, "updatedAt" date not null)`,
  `create table if not exists "verification" ("id" text not null primary key, "identifier" text not null, "value" text not null, "expiresAt" date not null, "createdAt" date not null, "updatedAt" date not null)`,
  `create table if not exists "rateLimit" ("id" text not null primary key, "key" text not null unique, "count" integer not null, "lastRequest" bigint not null)`,
  `create index if not exists "session_userId_idx" on "session" ("userId")`,
  `create index if not exists "account_userId_idx" on "account" ("userId")`,
  `create index if not exists "verification_identifier_idx" on "verification" ("identifier")`,

  // One row per completed lesson.
  `create table if not exists "progress" ("userId" text not null references "user" ("id") on delete cascade, "lessonKey" text not null, "completedAt" integer not null, primary key ("userId", "lessonKey"))`,
  // Append-only usage history.
  `create table if not exists "activity" ("id" integer primary key, "userId" text not null references "user" ("id") on delete cascade, "event" text not null, "lessonKey" text, "at" integer not null)`,
  `create index if not exists "activity_user_at_idx" on "activity" ("userId", "at")`,
]

let ready
export function ensureSchema(db) {
  ready ??= db.batch(SCHEMA.map((sql) => db.prepare(sql))).catch((err) => {
    ready = undefined // retry on the next request
    throw err
  })
  return ready
}
