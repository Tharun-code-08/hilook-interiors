/**
 * Lighthouse CI.
 *
 * Runs against a production build that LHCI starts itself, the same way
 * playwright.config.ts does — no hosted URL and no deployment needed, so this
 * gates a pull request before anything ships.
 *
 * What this is and is not:
 *
 *   Byte budgets and the accessibility / SEO / best-practices scores are
 *   asserted as errors. They are deterministic — the same commit produces the
 *   same numbers on any machine, so a failure means someone changed something.
 *
 *   The performance score is a warning, not an error. It is a timing, measured
 *   on a shared CI runner whose speed varies between runs; gating merges on it
 *   produces a flaky check that people learn to ignore, which is worse than no
 *   check. Read it, don't block on it.
 *
 * The byte budgets below are set from measurement, with headroom — they are
 * regression guards, not targets. See the note on images.
 */

const KB = 1024;
const MB = 1024 * KB;

module.exports = {
  ci: {
    collect: {
      // LHCI builds and starts the app itself. A throwaway database keeps this
      // off development data, and matches what playwright.config.ts does.
      // Port 3101, not 3000. LHCI does not fail when its server cannot bind the
      // port — it audits whatever is already listening. Pointed at 3000 with a
      // dev server up, this silently measured that instead, reporting a 1.7MB
      // main-app.js and flaky metadata because it was grading an unminified
      // development bundle. 3100 is the e2e suite; this gets its own.
      //
      // Builds as well as starts: scripts/lighthouse.mjs points NEXT_DIST_DIR
      // at .next-lhci so the build never races a dev server holding .next.
      startServerCommand:
        "npm run db:migrate && node scripts/seed-e2e.mjs && npm run build && npm run start -- --port 3101",
      startServerReadyPattern: "Ready in",
      startServerReadyTimeout: 300000,
      url: ["http://localhost:3101/", "http://localhost:3101/work"],
      numberOfRuns: 3,
      settings: {
        preset: "desktop",
        // The site sends no cookies to first-time visitors and the admin area
        // is behind auth; there is nothing for Lighthouse to sign into.
        disableStorageReset: false,
      },
    },

    assert: {
      assertions: {
        /* ---- Categories ------------------------------------------------ */

        // The suite already passes axe with no violations, so anything less
        // than a perfect score here is a regression, not a judgement call.
        "categories:accessibility": ["error", { minScore: 1 }],
        // 0.9, not 0.95: the SEO category is dragged down by the same two
        // body-metadata audits demoted below, so a tighter floor would
        // re-introduce the failure through the back door. Measured at 0.92 on
        // / and 0.91 on /work; anything below 0.9 is a genuine new problem.
        "categories:seo": ["error", { minScore: 0.9 }],
        "categories:best-practices": ["error", { minScore: 0.95 }],

        // Timing. Reported, never blocking — see the note at the top.
        "categories:performance": ["warn", { minScore: 0.7 }],

        /* ---- Byte budgets ---------------------------------------------- */

        // Measured against a production build: / transfers 166KB of script,
        // /work 118KB, largest single chunk 54KB. 260KB leaves room for
        // ordinary growth while still catching someone pulling in a charting
        // or animation library by accident.
        "resource-summary:script:size": ["error", { maxNumericValue: 260 * KB }],

        // Measured against a production build: / transfers 10,773KB of image
        // across 142 requests — 141 hero frames at w1920 plus the poster. The
        // idle backfill lands inside the Lighthouse run, so this is the real
        // number, not a partial one.
        //
        // 13MB is deliberately loose. It is not a target — it is the tripwire
        // for the specific regression this project already had once: the frame
        // directory being padded back out (360 frames would land at ~26MB) or
        // the WebP quality being raised. Tightening this below the real number
        // is how you get a red build nobody can fix, so if the hero is made
        // lighter, lower this at the same time.
        "resource-summary:image:size": ["error", { maxNumericValue: 13 * MB }],

        // Measured: 3KB stylesheet, 20KB document on /.
        "resource-summary:stylesheet:size": ["error", { maxNumericValue: 60 * KB }],
        "resource-summary:document:size": ["error", { maxNumericValue: 120 * KB }],

        /* ---- Specific audits worth naming ------------------------------ */

        // These are the SEO fixes this project made deliberately; an assertion
        // is what stops them being undone quietly.
        "is-crawlable": ["error", { minScore: 1 }],
        "document-title": ["error", { minScore: 1 }],
        "http-status-code": ["error", { minScore: 1 }],
        viewport: ["error", { minScore: 1 }],
        "color-contrast": ["error", { minScore: 1 }],

        // Warnings, not errors, for a specific and currently-accepted reason.
        //
        // generateMetadata in app/layout.tsx is async and reads settings from
        // the database, so Next cannot resolve metadata before it flushes the
        // streamed shell — title, description and canonical are emitted into
        // <body> rather than <head>. Lighthouse reads document.title (a
        // property, position-independent) so document-title passes, but it
        // queries the head for these two, so they fail.
        //
        // The tags are present and correct; the e2e suite asserts them with
        // Playwright, which searches the whole document. Making them pass here
        // means making the metadata static — giving up admin-editable SEO copy
        // — which is a product decision, not a lint fix. Warn until that call
        // is made, rather than shipping a permanently red gate.
        canonical: "warn",
        "meta-description": "warn",

        // Advisory: real problems, but ones whose score moves with runner
        // timing or with third-party script behaviour outside this repo.
        "unused-javascript": "warn",
        "uses-long-cache-ttl": "warn",
        "total-byte-weight": "warn",
        "largest-contentful-paint": "warn",
        "cumulative-layout-shift": "warn",
      },
    },

    upload: {
      // Keeps reports as CI artifacts. Switching to a Lighthouse server or
      // temporary-public-storage is a deliberate choice about where build data
      // goes, so it is not made here by default.
      target: "filesystem",
      outputDir: "./.lighthouseci",
    },
  },
};
