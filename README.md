# Hilook Interiors

A cinematic, single-page luxury interior-design website with a canvas-scrubbed
scroll hero, a full public site, and an admin panel with a lightweight
file-based database.

## ⚠️ Before you do anything else

This project was built in a sandbox whose network policy blocked
`registry.npmjs.org`, so **`npm install` was never actually run against this
code**, and neither was `npm run dev` / `tsc --noEmit`. Every file was
written carefully by hand and passed a TypeScript syntax check, but you are
the first real compile. Run the steps below and fix anything that surfaces —
it should be close to nothing, but don't skip this.

```bash
npm install
npx tsc --noEmit
npm run dev
```

Then open http://localhost:3000.

## The hero video

The connected Runway account had a 0 credit balance, so the initial build
shipped with a locally-generated abstract placeholder. That's since been
replaced with a real AI-generated cinematic house flythrough you provided
directly (exterior night approach → interior flythrough → exterior reveal),
run through the same ffmpeg extraction pipeline: `fps=24, scale=1920:-1`,
141 frames (`frame_0001.jpg` .. `frame_0141.jpg`), `FRAME_COUNT = 141` in
`app/components/ScrollHero.tsx`. Source is 1376×768, upscaled to 1920 wide
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
3. Update `FRAME_COUNT` at the top of `app/components/ScrollHero.tsx` to the
   **exact** number counted above — don't trust `ffprobe`'s `nb_frames`,
   count the files on disk.

## Admin panel

Visit `/admin/login`.

- **Username:** `admin`
- **Password:** `HilookAdmin!2026`

**Change this password immediately** (Admin Users page — sign in, then add
a new owner account with your own credentials and remove the default one),
or better, set a real `SESSION_SECRET` env var and edit the seed hash in
`lib/db.ts` before your first deploy.

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

All of this is backed by a single JSON file at `data/db.json` (via
[lowdb](https://github.com/typicode/lowdb)) rather than a full SQL database —
this was a deliberate scope call given the sandbox couldn't install or test
a native database driver. It's genuinely functional (real reads/writes,
real auth, real file uploads) but if you outgrow a single-file datastore,
the `lib/db.ts` module is the one place to swap in Postgres/SQLite/etc —
every route already goes through `getDB()`.

## What's simplified vs. a fully custom build

- **Database:** JSON file (lowdb) instead of a hosted SQL/NoSQL database —
  see above.
- **Auth:** a signed JWT in an httpOnly cookie, checked per-request. No
  password reset flow, no 2FA, no audit log.
- **Roles:** two roles (`owner`, `editor`). Owners can manage admin
  accounts; both can manage content. There isn't granular per-resource
  permissioning beyond that.
- **Analytics:** first-party, in-process counters (page views, section
  views, referrer hostnames). No geolocation, device/browser breakdown, or
  historical time-series — just running totals.
- **Newsletter signup:** stores emails in the same JSON store; there's no
  outbound email sending wired up.

None of this affects the public-facing site's design, copy rules, or the
scroll hero mechanics — those follow the spec exactly.

## Structure

```
app/
  components/        Public site sections + ScrollHero
  admin/
    login/            Public login page
    (dashboard)/       Auth-gated admin pages (layout redirects to /admin/login)
  api/
    admin/             Admin CRUD routes (all check the session cookie)
    contact/, newsletter/, analytics/section/   Public-facing routes
lib/
  db.ts                lowdb schema + seed data
  auth.ts              JWT session helpers
  analytics.ts         First-party analytics writers
public/
  frames/              Extracted hero video frames (see "The hero video" above)
  hero.mp4             Hero source video (used only for frame extraction — not played as <video>)
  uploads/             Admin-uploaded media (git-ignored)
data/
  db.json              Runtime data store (git-ignored, created on first run)
```

## No invented brand content

Per the brief, nothing about Hilook Interiors' real history, designers,
credentials, awards, press, clients, or reviews was invented. Everywhere
that content wasn't supplied, the site ships with clearly-labeled,
easily-findable placeholder copy ("Editable placeholder — ...") that you
replace from the admin panel's Content, Portfolio, Reviews, and Awards &
Press pages.
