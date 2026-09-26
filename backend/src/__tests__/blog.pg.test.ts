// ============================================
// Blog — docs/blog-migration.sql run unchanged (twice) in a real Postgres,
// then docs/VERIFY-blog.sql on the result.
//
// What only a real database can prove: that two simultaneous likes by one
// person are ONE row, that the counts are exact, and that RLS lets anon and a
// signed-in user read exactly what the plan says — and write nothing.
// ============================================

import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import EmbeddedPostgres from 'embedded-postgres'
import postgres from 'postgres'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'

const PORT = 57000 + Math.floor(Math.random() * 900)
const dir = mkdtempSync(join(tmpdir(), 'hisabche-pg-blog-'))
const pg = new EmbeddedPostgres({
  databaseDir: dir,
  port: PORT,
  user: 'postgres',
  password: 'test',
  persistent: false,
  initdbFlags: ['--encoding=UTF8', '--locale=C'],
  // Postgres refuses to run as root. In a root container (CI, cloud sessions)
  // this hands the data directory to the `postgres` user; elsewhere it is off,
  // because a non-root process cannot chown to another user.
  createPostgresUser: process.getuid?.() === 0,
})
const url = `postgres://postgres:test@localhost:${PORT}/blog`
let a: postgres.Sql
let b: postgres.Sql

const DOCS = join(__dirname, '..', '..', '..', 'docs')
const migration = readFileSync(join(DOCS, 'blog-migration.sql'), 'utf8')
const verify = readFileSync(join(DOCS, 'VERIFY-blog.sql'), 'utf8')

const ALI = '11111111-1111-1111-1111-111111111111'
const SARA = '22222222-2222-2222-2222-222222222222'

beforeAll(async () => {
  await pg.initialise()
  await pg.start()
  await pg.createDatabase('blog')
  const setup = postgres(url, { max: 1, onnotice: () => {} })
  // The parts of Supabase the migration touches: the three API roles,
  // auth.uid() read from the request's JWT claim, and storage.buckets.
  await setup.unsafe(`
    DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN CREATE ROLE anon NOLOGIN; END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN CREATE ROLE service_role NOLOGIN BYPASSRLS; END IF;
    END $$;
    CREATE SCHEMA IF NOT EXISTS auth;
    CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS
      $$ SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    GRANT USAGE ON SCHEMA auth, public TO anon, authenticated, service_role;
    CREATE SCHEMA IF NOT EXISTS storage;
    CREATE TABLE storage.buckets (
      id text PRIMARY KEY, name text NOT NULL, public boolean DEFAULT false,
      file_size_limit bigint, allowed_mime_types text[]
    );
  `)
  await setup.unsafe(migration)
  await setup.unsafe(migration)
  await setup.end()
  a = postgres(url, { max: 10, onnotice: () => {} })
  b = postgres(url, { max: 10, onnotice: () => {} })
}, 180_000)

afterAll(async () => {
  await a?.end()
  await b?.end()
  await pg.stop()
  rmSync(dir, { recursive: true, force: true })
}, 60_000)

let published: string
let draft: string

async function post(status: string, publishedAt: string | null, slug: string): Promise<string> {
  const [row] = await a`
    INSERT INTO blog_posts (locale, slug, title, status, published_at, content_html)
    VALUES ('fa', ${slug}, ${'عنوان ' + slug}, ${status}, ${publishedAt}, '<p>متن</p>')
    RETURNING id`
  return row!.id as string
}

beforeEach(async () => {
  await a`DELETE FROM blog_posts`
  published = await post('published', new Date(Date.now() - 60_000).toISOString(), 'published')
  draft = await post('draft', null, 'draft')
})

/** Run `fn` as a PostgREST request would: role + the caller's JWT subject. */
async function as<T>(
  role: 'anon' | 'authenticated',
  userId: string | null,
  fn: (tx: postgres.TransactionSql) => Promise<T>,
): Promise<T> {
  return (await a.begin(async (tx) => {
    await tx.unsafe(`SET LOCAL ROLE ${role}`)
    if (userId) await tx.unsafe(`SET LOCAL request.jwt.claim.sub = '${userId}'`)
    return fn(tx)
  })) as T
}

describe('the migration', () => {
  it('ran twice without error and VERIFY-blog.sql is all ok', async () => {
    const rows = await a.unsafe(verify)
    expect(rows.length).toBe(11)
    expect(rows.filter((r) => r.ok !== true).map((r) => r.check)).toEqual([])
  })
})

describe('reactions — one row per person, whatever the timing', () => {
  it('⚠️ twenty simultaneous likes from one user on two connections: exactly one row', async () => {
    const like = (sql: postgres.Sql) =>
      sql`SELECT blog_set_reaction(${published}::uuid, ${ALI}::uuid, 1::smallint)`
    await Promise.all(Array.from({ length: 20 }, (_, i) => like(i % 2 ? a : b)))

    const rows = await a`SELECT value FROM blog_reactions WHERE post_id = ${published}`
    expect(rows).toHaveLength(1)
    expect(rows[0]!.value).toBe(1)
  })

  it('like → dislike switches the same row; 0 takes it back', async () => {
    await a`SELECT blog_set_reaction(${published}::uuid, ${ALI}::uuid, 1::smallint)`
    await a`SELECT blog_set_reaction(${published}::uuid, ${ALI}::uuid, -1::smallint)`
    expect(await a`SELECT value FROM blog_reactions`).toEqual([{ value: -1 }])

    await a`SELECT blog_set_reaction(${published}::uuid, ${ALI}::uuid, 0::smallint)`
    expect(await a`SELECT value FROM blog_reactions`).toEqual([])
  })

  it('a draft cannot be reacted to', async () => {
    await expect(
      a`SELECT blog_set_reaction(${draft}::uuid, ${ALI}::uuid, 1::smallint)`,
    ).rejects.toThrow('BLOG_POST_NOT_PUBLIC')
  })
})

describe('ratings', () => {
  it('⚠️ simultaneous ratings from one user: one row, the stars are one of the sent values', async () => {
    await Promise.all(
      [1, 2, 3, 4, 5, 5, 4, 3].map(
        (stars, i) =>
          (i % 2
            ? a
            : b)`SELECT blog_set_rating(${published}::uuid, ${SARA}::uuid, ${stars}::smallint)`,
      ),
    )
    const rows = await a`SELECT stars FROM blog_ratings WHERE post_id = ${published}`
    expect(rows).toHaveLength(1)
    expect([1, 2, 3, 4, 5]).toContain(rows[0]!.stars)
  })

  it('refuses 0 and 6 stars', async () => {
    await expect(
      a`SELECT blog_set_rating(${published}::uuid, ${SARA}::uuid, 6::smallint)`,
    ).rejects.toThrow('BLOG_RATING_INVALID')
    await expect(
      a`SELECT blog_set_rating(${published}::uuid, ${SARA}::uuid, 0::smallint)`,
    ).rejects.toThrow('BLOG_RATING_INVALID')
  })
})

describe('statistics are exact counts', () => {
  it('likes, dislikes, ratings, comments and views', async () => {
    await a`SELECT blog_set_reaction(${published}::uuid, ${ALI}::uuid, 1::smallint)`
    await a`SELECT blog_set_reaction(${published}::uuid, ${SARA}::uuid, -1::smallint)`
    await a`SELECT blog_set_rating(${published}::uuid, ${ALI}::uuid, 5::smallint)`
    await a`SELECT blog_set_rating(${published}::uuid, ${SARA}::uuid, 4::smallint)`
    await a`INSERT INTO blog_comments (post_id, user_id, body, status) VALUES
            (${published}, ${ALI}, 'خوب بود', 'approved'),
            (${published}, ${SARA}, 'سؤال دارم', 'pending'),
            (${published}, ${SARA}, 'اسپم', 'spam')`
    for (let i = 0; i < 3; i += 1) await a`SELECT blog_record_view(${published}::uuid)`
    await a`SELECT blog_record_view(${draft}::uuid)`

    const [stats] = await a`SELECT * FROM blog_post_stats(ARRAY[${published}::uuid, ${draft}::uuid])
                             WHERE post_id = ${published}`
    expect(stats).toMatchObject({
      likes: '1',
      dislikes: '1',
      rating_count: '2',
      rating_avg: '4.50',
      approved_comments: '1',
      pending_comments: '1',
      views: '3',
    })
    const [draftStats] = await a`SELECT views FROM blog_post_stats(ARRAY[${draft}::uuid])`
    expect(draftStats!.views).toBe('0')
  })
})

describe('publishing', () => {
  it('scheduled in the future is private; once the time passes it is public', async () => {
    const future = await post('scheduled', new Date(Date.now() + 3_600_000).toISOString(), 'later')
    const past = await post('scheduled', new Date(Date.now() - 1_000).toISOString(), 'earlier')
    const visible = await as('anon', null, (tx) => tx`SELECT id FROM blog_posts`)
    const ids = visible.map((r) => r.id)
    expect(ids).toContain(published)
    expect(ids).toContain(past)
    expect(ids).not.toContain(future)
    expect(ids).not.toContain(draft)
  })

  it('a published post must have a date; a cover must have alt text', async () => {
    await expect(post('published', null, 'nodate')).rejects.toThrow('blog_posts_publish_date')
    await expect(
      a`INSERT INTO blog_posts (locale, slug, title, cover_url) VALUES ('fa', 'x', 't', 'https://x/y.png')`,
    ).rejects.toThrow('blog_posts_cover_alt')
  })

  it('slug is unique per locale, not globally', async () => {
    await a`INSERT INTO blog_posts (locale, slug, title) VALUES ('en', 'published', 'English twin')`
    await expect(
      a`INSERT INTO blog_posts (locale, slug, title) VALUES ('fa', 'published', 'dup')`,
    ).rejects.toThrow()
  })
})

describe('comments — one level of replies', () => {
  it('a reply to a reply is refused; so is a reply on another post', async () => {
    const [top] = await a`INSERT INTO blog_comments (post_id, user_id, body)
                          VALUES (${published}, ${ALI}, 'اول') RETURNING id`
    const [reply] = await a`INSERT INTO blog_comments (post_id, user_id, parent_id, body)
                            VALUES (${published}, ${SARA}, ${top!.id}, 'پاسخ') RETURNING id`
    expect(reply!.id).toBeTruthy()

    await expect(
      a`INSERT INTO blog_comments (post_id, user_id, parent_id, body)
        VALUES (${published}, ${ALI}, ${reply!.id}, 'پاسخِ پاسخ')`,
    ).rejects.toThrow('BLOG_COMMENT_REPLY_DEPTH')
    const other = await post('published', new Date().toISOString(), 'other')
    await expect(
      a`INSERT INTO blog_comments (post_id, user_id, parent_id, body)
        VALUES (${other}, ${ALI}, ${top!.id}, 'جای اشتباه')`,
    ).rejects.toThrow('BLOG_COMMENT_REPLY_DEPTH')
  })
})

describe('row level security, as PostgREST would run it', () => {
  beforeEach(async () => {
    await a`INSERT INTO blog_comments (post_id, user_id, body, status) VALUES
            (${published}, ${ALI}, 'تأییدشده', 'approved'),
            (${published}, ${ALI}, 'در انتظار علی', 'pending'),
            (${published}, ${SARA}, 'در انتظار سارا', 'pending'),
            (${draft}, ${ALI}, 'روی پیش‌نویس', 'approved')`
    await a`SELECT blog_set_reaction(${published}::uuid, ${ALI}::uuid, 1::smallint)`
    await a`SELECT blog_set_reaction(${published}::uuid, ${SARA}::uuid, 1::smallint)`
  })

  it('anon sees approved comments on public posts only', async () => {
    const rows = await as('anon', null, (tx) => tx`SELECT body FROM blog_comments ORDER BY body`)
    expect(rows.map((r) => r.body)).toEqual(['تأییدشده'])
  })

  it('a signed-in author also sees their OWN pending comment — not anyone else’s', async () => {
    const rows = await as('authenticated', SARA, (tx) => tx`SELECT body FROM blog_comments`)
    const bodies = rows.map((r) => r.body)
    expect(bodies).toContain('تأییدشده')
    expect(bodies).toContain('در انتظار سارا')
    expect(bodies).not.toContain('در انتظار علی')
  })

  it('a user reads their own reaction only', async () => {
    const rows = await as('authenticated', ALI, (tx) => tx`SELECT user_id FROM blog_reactions`)
    expect(rows.map((r) => r.user_id)).toEqual([ALI])
  })

  it('⚠️ clients write nothing directly — not even their own row', async () => {
    await expect(
      as(
        'authenticated',
        ALI,
        (tx) =>
          tx`INSERT INTO blog_comments (post_id, user_id, body) VALUES (${published}, ${ALI}, 'مستقیم')`,
      ),
    ).rejects.toThrow(/permission denied/)
    await expect(
      as(
        'authenticated',
        ALI,
        (tx) => tx`UPDATE blog_reactions SET value = -1 WHERE user_id = ${ALI}`,
      ),
    ).rejects.toThrow(/permission denied/)
    await expect(
      as(
        'authenticated',
        ALI,
        (tx) => tx`SELECT blog_set_reaction(${published}::uuid, ${ALI}::uuid, 1::smallint)`,
      ),
    ).rejects.toThrow(/permission denied/)
    await expect(as('anon', null, (tx) => tx`UPDATE blog_posts SET title = 'x'`)).rejects.toThrow(
      /permission denied/,
    )
  })

  it('view statistics are not readable by any client', async () => {
    await expect(
      as('authenticated', ALI, (tx) => tx`SELECT * FROM blog_post_view_days`),
    ).rejects.toThrow(/permission denied/)
  })
})
