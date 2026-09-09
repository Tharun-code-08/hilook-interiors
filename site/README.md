# Hilook Interiors

A cinematic, single-page luxury interior-design website with a canvas-scrubbed
scroll hero, a full public site, and an admin panel with a lightweight
file-based database.

## Getting started

```bash
npm install
cp .env.example .env.local     # optional for local dev; required for deploy
npm run dev                     # migrates the database, then starts Next
```

`npm run dev` runs the frame manifest generator and `db:migrate` first, so a
clean clone comes up with a working schema and no manual steps.

### Migrating from the old JSON store

Earlier versions kept everything in `data/db.json` via lowdb. If you have one
of those, import it once:

```bash
npm run db:migrate    # create the schema
npm run db:import     # copy db.json into it
```

The import is idempotent (keyed by primary key) and never deletes anything it
didn't write. It leaves `db.json` in place — keep it until you've confirmed
the site reads correctly from SQL, then delete it.

Two notes on what the import can and can't carry over:

- Project images become rows in `project_images`, so each one now has its own
  order and alt text.
- The old analytics were running totals with no timestamps. Daily visit counts
  are replayed as dated pageviews; section and referrer totals genuinely
  cannot be dated, so they are not imported and the log starts clean.

## Database

SQLite through libSQL, with Drizzle for the schema and queries.

- **Local / VPS** — `TURSO_DATABASE_URL` unset, so it opens `data/hilook.db`
  as a file. No account, no network.
- **Serverless** — set `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN` and the
  same driver talks to [Turso](https://turso.tech) over HTTP.

```bash
npm run db:generate   # regenerate SQL migrations after editing lib/schema.ts
npm run db:migrate    # apply pending migrations
npm run db:studio     # browse the data
```

Route handlers never touch the database directly — everything goes through
`lib/repos/`. That boundary is where transactions live, and it's what makes
concurrent admin saves safe.

## Deploying

The app writes nothing to the filesystem at runtime once these are set:

| Variable                                  | Why                                                                                                                     |
| ----------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `SESSION_SECRET`                          | Without it the app would write a generated secret to disk. Required in production — it throws rather than falling back. |
| `TURSO_DATABASE_URL` + `TURSO_AUTH_TOKEN` | Otherwise the database is a local file.                                                                                 |
| `BLOB_READ_WRITE_TOKEN`                   | Otherwise uploads go to `.storage/` on local disk. Needs `npm install @vercel/blob`.                                    |
| `NEXT_PUBLIC_SITE_URL`                    | Absolute URLs for canonicals, sitemap, and Open Graph.                                                                  |

Run `npm run db:migrate` as a deploy step, before the app starts.

## The hero video

The connected Runway account had a 0 credit balance, so the initial build
shipped with a locally-generated abstract placeholder. That's since been
replaced with a real AI-generated cinematic house flythrough you provided
directly (exterior night approach → interior flythrough → exterior reveal),
run through the same ffmpeg extraction pipeline: `fps=24, scale=1920:-1`,
141 frames (`frame_0001.jpg` .. `frame_0141.jpg`), so `FRAME_COUNT = 141`.

The placeholder extraction was 360 frames, and replacing it only overwrote
the first 141 — `frame_0142.jpg` .. `frame_0360.jpg` are still on disk as
leftovers from it. They are not served (see step 3 below) and
`node scripts/prune-stale-frames.mjs --apply` removes them.

Source is 1376×768, upscaled to 1920 wide
with Lanczos filtering during extraction — the canvas draw logic doesn't
care about the exact resolution (it cover-fits from each image's natural
size), but a higher-resolution source would look sharper on large displays
if you regenerate it later. Frames are JPEG quality `-q:v 6` (a size/quality
tradeoff to keep the delivered project small) — re-extract at `-q:v 2` or
`3` for a sharper result once you're working locally with no zip-size
constraint.

The source video lives only at `public/hero.mp4` (not duplicated elsewhere)
— it's not played anywhere as a `<video>` element, it exists purely as the
frame-extraction source, so keep it around for whenever you want to
re-extract at a different quality or frame rate.

To swap in a different or longer video later:

1. Replace `public/hero.mp4` with the new source.
2. Re-run the extraction:
   ```bash
   rm -rf public/frames && mkdir public/frames
   ffmpeg -i public/hero.mp4 -vf "fps=24,scale=1920:-1" -q:v 3 "public/frames/frame_%04d.jpg"
   ls public/frames/*.jpg | wc -l   # this is your new FRAME_COUNT
   ```
3. Nothing to update by hand. `FRAME_COUNT` is generated into
   `lib/frames.generated.ts` on every `predev` / `prebuild` by
   `scripts/generate-frame-manifest.mjs`, which reads the frame count out
   of `public/hero.mp4` itself (the MP4 `stsz` sample count — no ffmpeg
   needed) and checks `public/frames` against it.

   Deliberately the video and **not** the file count: a shorter video replacing
   a longer one overwrites `frame_0001..N` and leaves the old frames above
   `N` behind, and counting those puts dead footage into the scrub. If the
   directory has more frames than the video, the generator says so and ignores
   the extras; `node scripts/prune-stale-frames.mjs` (add `--apply`) deletes
   them. Fewer frames than the video is a failed extraction and fails the build.

## Admin panel

Visit `/admin/login`.

**On a fresh install** (an empty database) the app creates an owner account
called `admin` and prints a randomly generated password to the server log once,
on the run that seeds it. Watch the terminal on first `npm run dev`.
To choose the password yourself instead, set `ADMIN_INITIAL_PASSWORD` before
that first run.

Either way the account is flagged `mustChangePassword`, so the first sign-in is
forced through the change-password screen at `/admin/password` before the panel
is usable. No credential is committed to this repository.

> **Upgrading an existing install:** stores created before this change still
> hold the old seeded `admin` account. It has been flagged for rotation, so the
> next sign-in will require a new password. Change it immediately — the previous
> value was published in this README and in `lib/db.ts`, and should be treated
> as compromised.

What's in the admin panel:

- **Dashboard** — page views, popular sections, traffic sources, contact
  submission counts. Collected first-party (no external analytics
  service): page views are counted server-side per request, section views
  fire once each section scrolls into view.
- **Portfolio** — add/edit/delete projects, category (Residential/
  Commercial), drag-and-drop reorder (native HTML5 drag and drop, no
  external dependency).
- **Services** — add/edit/remove.
- **Reviews** — add/edit/delete, approve, feature, star rating.
- **Inbox** — contact form submissions, mark read/responded, CSV export.
- **Content** — hero tagline, about copy, contact details, social links.
- **Awards & Press** — empty by default; only shows on the public site once
  you add real entries (nothing is invented).
- **Media Library** — upload images (stored in `public/uploads`), copy URLs
  to use in Portfolio/Reviews.
- **Admin Users** — owners can add/remove admin accounts with `owner` or
  `editor` roles.

All of this is backed by the SQL store described under **Database** above.
Every mutation goes through `lib/repos/`, so a change of engine is a change to
`lib/client.ts` and the repositories, not to any route or component.

### Things that look handled and are not

Three of these turned up in one verification pass, and they share a shape: a
mechanism that appears to cover a case, next to a comment saying it does.

- **`prefers-reduced-motion`.** `globals.css` flattens `animation-duration` and
  `transition-duration` under the preference, which made the site look
  compliant. `Reveal` — used by every section of the public site — animates
  through framer-motion, which writes inline styles from JavaScript that no CSS
  rule can reach. The whole page kept sliding and fading for someone who had
  asked the system not to. It now checks `useReducedMotion()`.

- **The sitemap and web manifest.** Both read from the database and both said
  in their own comments that a change in the admin panel carries through
  without a deploy. Next prerenders metadata routes by default, so both were
  baked at build time: the sitemap shipped a fixed list of projects with a
  build timestamp, and the manifest shipped whatever the studio was called when
  it was built. Both are `force-dynamic` now, verified by adding a project
  through the panel and watching the sitemap go from four URLs to five with no
  rebuild.

- **The contact form's success path.** There were tests for both ways a
  submission can be rejected — bad email, honeypot — and none for it working.
  For a studio whose enquiries are the business, the only untested path was the
  one that matters. Now covered end to end: fill the form, wait out
  `MIN_FILL_MS`, assert it appears in the admin inbox.

The last one has a wrinkle worth knowing. `app/api/contact/route.ts` discards
anything submitted within 3s of the form rendering, and returns the normal
success shape when it does — telling a bot which check it tripped teaches the
author to evade it. That is the right call for spam, but it means a false
positive loses a client enquiry silently, with only a `console.warn` behind it.
The 3s window starts when the form renders rather than when someone starts
typing, so a human tripping it is close to impossible; if that ever needs to be
tightened, store the discarded submission flagged as spam rather than dropping
it.

### Why the admin pages are server components

Every list screen renders its data on the server and hands it to the
interactive half as a prop. That is the reason for the `page.tsx` /
`XxxAdmin.tsx` split throughout `app/admin/(dashboard)/`.

They used to be client components that fetched on mount: the browser received
an empty shell, downloaded and ran the JavaScript, and only then asked for the
data the server had been holding when it rendered the page. Measured against a
database with 40,000 analytics events and 400 enquiries, the request for
`/api/admin/portfolio` started **463ms after the document arrived** — a whole
round trip spent showing "Loading…".

Three other things were costing time, all found by measuring rather than
guessing:

- `summary()` ran ten independent queries with ten separate `await`s. Against a
  local SQLite file that hides; against Turso every one is a network hop, so
  the dashboard paid ten in series before it could render a number. They now go
  out together, as do the two trailing submission-window queries.
- `listSubmissions()` and `listMedia()` were unbounded — every row, every
  render. The inbox only grows, so that screen would have got slower every
  month with no ceiling. Both are capped, and the inbox says so on screen
  rather than truncating silently; CSV export still covers everything.
- The activity log rendered 200 rows. Nobody reads the two-hundredth.

Measured after, clicking through the sidebar: every screen lands between
roughly 100 and 230ms, with **no API calls at all once the page has loaded**.
If you add a screen, follow the same split — a `useEffect` that fetches on
mount puts the round trip back.

### Sessions and revocation

The session cookie is a JWT, but it is not self-contained: each one carries a
`jti` matching a row in `sessions`, and every authenticated request checks
that row is still live. That is what makes revocation possible at all.

Before it, signing out only deleted the cookie. A token captured beforehand —
off a shared machine, a proxy log, a laptop left open — kept working for the
rest of its seven days, and changing a password did nothing to sessions
elsewhere. Both are covered by e2e tests that hold a copy of the token and try
to use it afterwards, because a cleared cookie and a revoked token look
identical from the browser.

- **Signing out** revokes that session.
- **Changing a password** mints a fresh session for the current browser and
  revokes every other one, including the old session on this device. Someone
  changing their password because they think it is compromised gets the
  attacker signed out, which is the point.
- **Removing an admin account** revokes its sessions.
- **Account security** (`/admin/password`) lists signed-in devices with their
  last-active time and address, and can end any one of them or all the others.

### Activity and errors

**Activity** (`/admin/activity`) is the audit log unfiltered, including
sign-in attempts that failed. The dashboard feed deliberately hides those — a
"what changed" list is not improved by someone mistyping their password — but
that is the entry that matters when the question is whether anyone is trying
to get in, and there was nowhere to see it.

**Errors** (`/admin/errors`) records server failures through Next's
`onRequestError` hook in `instrumentation.ts`, so nothing depends on each
handler remembering a try/catch. Rows are grouped by a fingerprint of the
message, first stack frame and path: one bug in a loop is one row with a
count, not ten thousand rows burying everything else.

This is deliberately not Sentry. Error payloads here can carry a client's name,
email and message straight out of the contact form, and sending those to a
third party is a decision worth making on purpose rather than inheriting from a
default. Nothing is recorded beyond a message, stack, path, method and user
agent — never a request body, never headers.

Two consequences worth knowing:

- Middleware runs on Edge, where the database client and `node:crypto` do not
  exist, so middleware failures do not reach this table. They still appear in
  the platform logs. The fingerprint hash is FNV-1a rather than SHA-256 for the
  same reason — webpack follows the import into the Edge bundle even behind a
  runtime check.
- Marking an error resolved hides it but does not delete it. If the same
  failure recurs, the row comes back with its history intact.

### Content-Security-Policy

`script-src` carries a per-request nonce rather than `'unsafe-inline'`. That
directive is the one that decides whether an injected `<script>` executes;
with it present the rest of the policy is largely decoration.

The catch is that a nonce only works when the HTML was produced by the request
that minted it. **Any statically prerendered page comes out with unnonced
scripts and every one of them is blocked** — and it fails quietly. `/admin/login`
rendered an empty shell with no way to sign in, and the 404 page rendered
nothing at all, both still returning normal status codes. Both routes are now
`force-dynamic`, and `tests/e2e/public.spec.ts` loads a route of each shape and
fails on any CSP violation or an empty body. Add a static page and that test is
what will tell you.

Note that route-segment config like `export const dynamic` is ignored in a
`"use client"` file — that is why the sign-in page is split into `page.tsx`
(server, carries the config) and `LoginForm.tsx` (client).

`style-src` still needs `'unsafe-inline'` and says so in the policy comments:
next/font inlines `@font-face`, the public components style themselves with
React style objects, and a nonce cannot cover a style _attribute_, only a
`<style>` element.

### Saving

The edit-in-place lists (Portfolio, Services, Process, Reviews) have no Save
button — edits persist about ¾ of a second after you stop typing, and the
header says where they are up to.

They previously fired a `PUT` straight from `onChange`, so typing a
description was one request per character. The e2e suite measures this: with
the debounce removed it records 24 requests for a 23-character edit; with it,
one. That is not only wasted traffic — every one of those was an audit-log row
and a chance for two responses to land out of order and write a stale value
back.

`useAutosave` coalesces per record, so editing a title and then its
description inside one window is a single request carrying both. Discrete
actions — the approve/feature toggles, the category select, the image list —
go through `saveNow` instead and skip the delay, because waiting out a typing
debounce to publish a testimonial reads as the click not registering.

The risk a debounce introduces is losing the newest keystrokes when the page
goes away mid-window, so it flushes on unmount and on `pagehide`, both with
`keepalive` so the request outlives the document. There is an e2e test for
exactly that: type, navigate immediately, come back, and the edit is there.

### Design system

The panel has its own stylesheet, `app/admin/admin.css`, loaded only on
`/admin` by `app/admin/layout.tsx`, plus a small set of primitives in
`app/admin/components/ui.tsx`. It deliberately does not use the public site's
palette or typography: this is a tool someone works in, so it is neutral greys,
a system font stack, dense rows, and one accent reserved for primary actions.
The brand lives on the public site.

It replaced 260 inline `style={{}}` objects spread across 20 files with no
shared class between them. That is not only a tidiness problem — it is why
`#B08A4A` ended up as a button fill in fourteen places despite the token
comment in `globals.css` calling it decoration-only at 2.86:1, which is a
WCAG AA failure. There was nothing to be consistent _with_.

Every colour in `admin.css` is measured against the surface it sits on and
annotated with its ratio, and the Playwright suite now runs axe over all
eleven authenticated pages, not just the sign-in screen. Three inline styles
remain, all of them bar widths computed from data — those cannot become
classes, so `/admin` still needs `style-src 'unsafe-inline'`; the reduction
narrows the surface rather than removing the directive.

If you add a screen, use the primitives — `Button`, `TextField`, `Card`,
`Badge` — rather than reaching for a hex value. `TextField` and friends also
wire up `<label for>`, `aria-describedby` and `aria-invalid`, which is the
part that is easy to forget and expensive to retrofit.

## What's simplified vs. a fully custom build

- **Database:** SQLite via libSQL. Real transactions, indexes, and foreign
  keys; runs as a local file or against Turso with no code change.
- **Auth:** a signed JWT in an httpOnly cookie, checked per-request. Admin
  mutations are recorded to an audit log (`lib/audit.ts`). No password reset
  flow and no 2FA.
- **Roles:** two roles (`owner`, `editor`). Owners can manage admin
  accounts; both can manage content. There isn't granular per-resource
  permissioning beyond that.
- **Analytics:** first-party append-only event log. Unique visitors (via a
  daily-salted hash — no IP is stored), device and browser class, referrer
  hosts, and per-day aggregation. No external tracker.
- **Newsletter signup:** stores emails in the same SQL store; there's no
  outbound email sending wired up.

None of this affects the public-facing site's design, copy rules, or the
scroll hero mechanics — those follow the spec exactly.

## Quality gates

```bash
npm run verify      # typecheck + lint + unit and integration tests
npm run test:e2e    # Playwright + axe, against a production build
npm run lhci        # Lighthouse budgets and audits
```

All three run in CI (`.github/workflows/ci.yml`) on every pull request.

**Lighthouse** (`lighthouserc.js`) builds and starts its own production
server on port 3101 with a throwaway database, so it needs no deployment and
no hosted URL. It asserts byte budgets and the accessibility, SEO and
best-practices scores as errors; the performance _score_ is only a warning,
because it is a timing measured on a shared runner and gating merges on it
produces a flaky check people learn to ignore.

The budgets are measured, not aspirational — currently 166KB of script and
10.8MB of images on `/`. That image figure is the hero: 141 frames at
`w1920`, all of which land during the idle backfill. The budget sits at 13MB
as a **regression tripwire**, not a target — it is what catches the frame set
being padded out again or the WebP quality being raised. If the hero is ever
made lighter, lower the budget in the same commit.

Two SEO audits (`meta-description`, `canonical`) are warnings rather than
errors. `generateMetadata` in `app/layout.tsx` is async and reads settings
from the database, so Next cannot resolve metadata before flushing the
streamed shell: title, description and canonical are emitted into `<body>`
rather than `<head>`. The tags are present and correct — the Playwright suite
asserts them, since it searches the whole document — but Lighthouse only
credits them in the head. Making these pass means making the metadata static
and giving up admin-editable SEO copy, which is a product decision rather than
a lint fix.

On Windows, `npm run lhci` frequently ends with `EPERM ... Templighthouse.*`
after the audit has already finished. That is chrome-launcher racing its own
temp-directory cleanup; the reports in `.lighthouseci/` are complete, and
`npx lhci assert` re-checks them without re-running Chrome. CI runs on ubuntu
and is unaffected.

## Structure

```
app/
  components/        Public site sections + ScrollHero
  admin/
    login/            Public login page
    (dashboard)/      Auth-gated admin pages
  api/
    admin/            Admin CRUD (session + CSRF checked)
    media/[key]/      Serves uploaded media from the storage driver
    contact/, newsletter/, analytics/section/   Public endpoints
lib/
  schema.ts           Drizzle table definitions
  client.ts           libSQL connection (local file or Turso)
  repos/              Repository layer — the only place that queries
  storage.ts          Media storage: local disk or object storage
  validation.ts       Zod schemas, shared by API and admin forms
  auth.ts             JWT session helpers
  rate-limit.ts       Shared fixed-window limiter
drizzle/              Generated SQL migrations (committed)
scripts/              Frame manifest, frame encoding, migrate, import
public/
  frames/             Hero frames — source JPEGs plus w960/ and w1920/ WebP
data/
  hilook.db           Local SQL store (git-ignored)
.storage/             Local media uploads (git-ignored)
```

## No invented brand content

Per the brief, nothing about Hilook Interiors' real history, designers,
credentials, awards, press, clients, or reviews was invented. Everywhere
that content wasn't supplied, the site ships with clearly-labeled,
easily-findable placeholder copy ("Editable placeholder — ...") that you
replace from the admin panel's Content, Portfolio, Reviews, and Awards &
Press pages.
