# Vinyl Archive

A personal vinyl collection manager. You sign in to edit; the world can browse a read-only public site
if you choose to publish one. Everything is private until you say otherwise.

React, TypeScript (strict), Vite, Tailwind 4, Firebase Auth + Firestore, hosted on GitHub Pages (hash routing).

## What it does

- **Collection**: albums with one or more physical copies (pressing, condition, purchase details, location).
- **Add albums** from **Discogs first**, with **MusicBrainz and Cover Art Archive as automatic backup**
  (search by album/artist, barcode or catalog number; pick the exact pressing). Manual entry always works.
- **Discogs community info** on each album: rating, have/want counts, for sale, notes, credits, videos.
- Reviews and ratings, wantlist (with "I bought it"), listening journal, gear and costs, price observations.
- **Map** of where you buy records, **statistics** (spending, genres, decades, ratings), **dashboard**.
- **Admin**: choose who can view (private, unlisted link, or public website), which sections, which fields, which items.
- **Backup and export**: full JSON backup, CSV exports, validated import that never deletes.

Prices are entered in one currency (USD). Currencies are never converted or added together; automatic
conversion is not built yet.

## Setup

```bash
npm install
cp .env.example .env      # fill in the Firebase values (no quotes, no spaces)
npm run dev
```

Scripts: `dev`, `build`, `preview`, `test`, `lint`, `typecheck`, `test:rules`.

### Firebase

1. Create a Firebase project (Spark plan is enough). Enable **Email/Password** sign-in, create your one owner user,
   then **disable new sign-ups** (Authentication > Settings > User actions).
2. Create a Firestore database (production mode).
3. Copy the owner's UID (Authentication > Users). Put it in `VITE_OWNER_UID` (a UI gate only) **and** replace
   `REPLACE_WITH_OWNER_UID` in `firestore.rules` (the real enforcement). If you sign in before setting it, the app shows your UID.
4. Deploy rules and indexes (do this again after every update that changes them):
   ```bash
   npx firebase login
   npx firebase use <project-id>
   npx firebase deploy --only firestore:rules,firestore:indexes
   ```

### Discogs (recommended)

Settings > Discogs: save either your application's **consumer key and secret**, or a **personal access token**.
They are stored in your private settings document (readable only by your account), never bundled into the site,
and sent only to `api.discogs.com` from your browser, in an `Authorization` header.

- With credentials: searches go to Discogs first and fall back to MusicBrainz (with a visible notice) if Discogs
  errors or finds nothing. Without them: MusicBrainz and Cover Art Archive only.
- Discogs asks every client for a descriptive `User-Agent`. Browsers don't let a page set it, so requests carry the
  browser's own, and Discogs may throttle or block that. The Discogs code was only tested against mocked
  responses. If Discogs gets blocked, the app keeps working through the MusicBrainz backup; the reliable fix is a
  tiny proxy (for example a free Cloudflare Worker) that adds the header and holds the key and secret.
- **Written reviews are not available**: the Discogs API doesn't provide them. The app shows the community rating
  and count, have/want, copies for sale, release notes, credits and videos, and links to the release for reviews.
- Cover art: Discogs image links may not load in every browser. "Try Cover Art Archive" on the add form swaps in the backup artwork.

## Public website and Admin

Admin (sidebar) controls everything public. There are three modes:

| Mode | Who can read |
| --- | --- |
| Private | Only you, signed in |
| Unlisted link | Anyone with the secret link `#/public/<id>` |
| Public website | Anyone, at `#/view` (the front page for signed-out visitors) |

Then switch sections on or off (collection, wantlist, listening journal, gear, map, statistics), pick the fields to
include, and tick the exact albums, wantlist items, gear and places to publish. Turning a section off deletes its published copies.

- Visitors read a **sanitized copy** under `publicCollections/`, built by an allowlist. Purchase prices, sellers,
  private notes, addresses and your email/UID are never copied. **Show prices** is an explicit switch (off by default).
- Journal entries are published only for albums that are themselves public. Places show name and position only.
- Signed-out visitors who open any edit page are sent to the public site. Only your account can write, enforced by the Firestore rules.
- Statistics on the public site are computed in the visitor's browser from only what you published.
- After updating from an older version, **redeploy the rules and re-publish** from Admin once.

## Security notes

- Firestore rules: `users/{uid}/**` owner-only; public data readable only when the share is enabled **and** that section's
  switch is on; strict key allowlists, size and range checks on every public document; default deny.
  `src/lib/rulesConsistency.test.ts` fails if the rules and the code's public keys drift apart.
  `tests/firestore.rules.test.ts` exercises the rules against the emulator (`npm run test:rules`; needs Java). It has not been
  run by the author of this code, so run it, or let the `rules-tests` CI job do it, before relying on the rules.
- Links stored from outside (artwork, sources) must be `http(s)`; `javascript:` and `data:` links are rejected.
- Import validates every record, restricts IDs, never deletes, and skips records whose album is missing.
- No `dangerouslySetInnerHTML`; external links use `rel="noreferrer"`.
- Optional Content Security Policy: set `VITE_ENABLE_CSP=true` for the production build. It is off by default because it
  can't be verified without a real browser. Test with `npm run build && npm run preview` and check the console for blocked requests.
- `npm audit` reports advisories in `@grpc/grpc-js`. That is a Node server library; it is not in the browser bundle
  (verified), so they don't apply. Don't run `npm audit fix --force`: it would downgrade Firebase.
- `package.json` pins `@firebase/app` with `overrides` so only one copy is installed. Two copies cause
  "Component auth has not been registered yet". `src/firebase/dedupe.test.ts` guards this.

## Data sources and attribution

Metadata from Discogs and MusicBrainz; artwork from Cover Art Archive and Discogs; maps © OpenStreetMap contributors.
Public pages carry attribution. MusicBrainz requests are queued about 1.1 s apart and cached. OpenStreetMap tiles and the
optional Nominatim address lookup see your IP address; the lookup only runs when you press its button.

## Backup, export and import

JSON backup holds all records plus preferences, and excludes your Discogs credentials and share link. CSV exports are for
spreadsheets only (formula-injection protected). Import accepts only Vinyl Archive JSON, shows a preview, adds missing
records by default, and replaces differing ones only if you opt in. Writes run in batches of 400; re-running is safe.

## Accessibility

Skip link, focus moves to the page content on navigation, page titles per route, labelled fields with hints and errors
linked by `aria-describedby`, accessible dialogs, charts with data tables, keyboard alternatives to the map, reduced-motion
support, an offline notice, and a collapsible sidebar (remembered on the device). Colour contrast of the design tokens is
checked against WCAG AA in `src/lib/contrast.test.ts`. A real screen-reader and keyboard pass is still worth doing.

## Troubleshooting

- **Blank page**: restart `npm run dev` after editing `.env`; open the page in Chrome or Edge (not an editor preview) and check the
  console. Start-up problems now show a message.
- **"Component auth has not been registered yet"**: run `npm ls @firebase/app`; it must show a single version.
- **Dashboard says spending needs indexes**: run `npx firebase deploy --only firestore:indexes`.
- **Public site says "private"**: set Admin to Public website, press Save and publish, and make sure the rules are deployed.

## Deploy to GitHub Pages

1. Push to GitHub on `main`. Settings > Pages > Source: **GitHub Actions**.
2. Settings > Secrets and variables > Actions > **Variables**: `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`,
   `VITE_FIREBASE_PROJECT_ID`, `VITE_FIREBASE_APP_ID`, `VITE_FIREBASE_MESSAGING_SENDER_ID`, `VITE_OWNER_UID`
   (optional: `VITE_PUBLIC_APP_URL`, `VITE_ENABLE_CSP`).
3. Add your Pages domain to Firebase Auth > Settings > Authorized domains.
4. Push. The workflow lints, typechecks, tests, builds and deploys; a separate job runs the rules tests.

## Not verified here

The author could not run: the Firestore emulator tests, anything against the live Discogs, MusicBrainz or Nominatim APIs,
or the app in a real browser (including charts, the map, and the optional CSP). Unit tests cover the logic with mocked responses.
