# Recallbox

A local-first flashcard app.

## Run

Use Node.js 22.12+ and npm.

```sh
npm ci
npm run dev
```

Open the local URL shown by Vite. No account or backend is required. The first launch includes four editable starter decks, with 14 cards and no fabricated review history.

```sh
npm run build       # strict TypeScript check + production build
npm run preview     # serve the production PWA
npm test            # storage, scheduling, and ZIP integrity tests
npm run test:e2e    # desktop + Android-sized Chromium tests
npm run lint
npm run format       # format the project with Oxfmt
npm run format:check # check formatting without writing
```

If Chromium is not installed for Playwright, run `npx playwright install chromium` once. Build before running the browser tests. Browser tests also check accessibility, image persistence, backup restore, and offline reviews.

## What is included

- Deck and card creation, editing, deletion, search, and tags.
- Global tags: one topic can connect cards and decks across the library. Card and deck editors share searchable tag suggestions, removable chips, and an explicit create-tag option. Tags are trimmed, lowercased, and deduplicated (up to 30 tags, 50 characters each). Unselected tag drafts stay visible and must be selected, created, or cleared before saving.
- Searchable single-tag filters on the deck library and card lists. Library tag filters remain in the URL for bookmarks and reloads.
- Markdown prompts and answers, with a formatting toolbar, preview, tables, task lists, code blocks, links, and images. Raw HTML is not executed.
- Paste images from the clipboard or upload PNG/JPEG/WebP/GIF files, up to 10 MB each. Uploaded images live in IndexedDB, not a remote service.
- Optional reverse practice. The full answer becomes the reverse prompt unless a shorter override is provided. The original prompt is the reverse answer.
- FSRS v6, via `ts-fsrs`, with 90% target retention. Forward and reverse schedules are independent. Disabling reverse practice preserves its schedule.
- Due-only review sessions. Space reveals the answer; 1–4 grade it. Each direction appears once in a session; short learning steps return when due in a later session. Progress saves after every answer.
- Real activity, recall rate, and calendar-day streaks. “Learned” means the FSRS Review state, not permanent mastery.
- System/light/dark themes with a shared preference in the header and settings. System follows device appearance changes. Responsive layouts, keyboard controls, tooltips, and reduced-motion support.
- A compact overview with due reviews, decks ordered by their oldest due review, and activity for the last seven calendar days. When nothing is due, it shows recently created decks.
- Installable PWA. The production app works offline after its first successful load. Updates prompt before reloading, so an open editor is not silently lost.
- Versioned ZIP backups containing `recallbox.json` and `assets/<id>`. Imports validate schemas, unique IDs, references, and bounded decompressed sizes before an atomic replacement. Restore is not a merge.
- Optional manual Google Drive backups in a visible **My Drive / Recallbox** folder.

## Google Drive setup

Google Drive needs a public OAuth client ID for your deployment. ZIP export/import works without it.

1. Create a project in [Google Cloud Console](https://console.cloud.google.com/).
2. Enable **Google Drive API**.
3. Configure the **Google Auth Platform** consent screen. If the app is in testing, add your Google account as a test user.
4. Create an OAuth client of type **Web application**.
5. Add the exact **Authorized JavaScript origins** you use, for example:
   - `http://localhost:5173` for development
   - `http://localhost:4173` for preview
   - `https://your-recallbox-domain.example` for production
6. Copy `.env.example` to `.env.local`, set `VITE_GOOGLE_CLIENT_ID`, and restart Vite or rebuild.
7. Open **Settings & backup → Connect Drive** and grant access. Then choose **Back up now**.

The app uses Google's Identity Services token model and the narrow `drive.file` scope. It accesses files created or authorized for this app, not all files in your Drive. Tokens stay in memory, not in IndexedDB, localStorage, or exports. After expiry, reconnect. No client secret belongs in this frontend.

Backups are ordinary, timestamped ZIP files in the visible Recallbox folder. They are not placed in `appDataFolder`. You can download, move, or delete them in Drive. The app lists the latest 100 backups and can restore one after confirmation. Upload uses Google's resumable-upload endpoint; if a request fails, retry from **Back up now**. Automatic background backup, cross-device sync, and automatic network-retry recovery are not included.

**Verification limit:** the Google Drive integration has not been tested against a live Google account because this project has no configured OAuth client. Consent, allowed origins, and Google project policy must be checked with your deployment.

## Storage and safety

Your library belongs to this **browser profile and origin**. A different browser, port, domain, or device has a separate library. IndexedDB transactions keep related changes together. An outdated review from another tab is rejected; saving an older editor preserves newer review schedules. Unused uploaded images are removed after card/deck edits or deletion.

- Clearing site data, private browsing cleanup, or losing your device can remove local data. **Keep browser data** requests persistent storage to prevent automatic removal under storage pressure; the browser can decline. This is not encryption or a backup. Keep regular ZIP backups.
- Data and ZIP files are **not encrypted by Recallbox**. Device security and Drive account security still matter.
- Linked external images remain links; they need a network connection and are not bundled in backups. Paste or upload an image for an offline copy.
- ZIP import is limited to 100 MB compressed and expanded content. Large libraries and review histories have not been load-tested; the current dashboard reads the local library into memory.
- There is no conflict-resolving sync. Restoring a backup replaces the complete local library, after confirmation.
- JSZip 3.10.2 omits its documented `ZipObject.internalStream` API from its published TypeScript declarations. `src/types/jszip.d.ts` supplies that declaration; no runtime behavior is patched. The stream lets imports stop when the declared size limit is exceeded.

## Stack and structure

Started from the official **Vite React + TypeScript** template. Components were generated with the official **shadcn CLI**, `--base base --preset nova` (`base-nova` in `components.json`). Tailwind v4 uses its official Vite plugin. Toasts use **Base UI Toast**, not Sonner.

- `src/components/ui/`: shadcn/Base UI components and Base UI toast renderer.
- `src/components/`: layout, editors, Markdown, and shared components.
- `src/pages/`: overview, library, study, activity, and settings.
- `src/lib/model.ts`: data schemas and FSRS scheduling.
- `src/lib/db.ts`: Dexie/IndexedDB transactions and starter content.
- `src/lib/backup.ts`: portable ZIP validation and restore.
- `src/lib/drive.ts`: Google Identity Services and Drive API.
- `src/lib/search.ts`: reusable Zod schemas for route search parameters.
- `src/routes/`: TanStack Router file routes. The Vite plugin generates `src/routeTree.gen.ts` and splits page components into lazy chunks.
- `src/router.ts`: router instance and generated route-tree registration.
- `src/index.css`: centralized theme/color tokens and responsive app layouts.
- `tests/`: unit and browser tests.

Versions are recorded in `package-lock.json`. Use `npm ci` for repeatable installation. Fonts are bundled locally; no font CDN is needed. Oxfmt uses two-space indentation, double quotes, and no semicolons. Source imports use `@/` (including unit tests); Oxlint rejects relative imports. Vite and Vitest both resolve the alias.

## Route search parameters

TanStack Router accepts Zod v4 schemas directly as `validateSearch`; no adapter is needed. Add new search fields to `src/lib/search.ts` using the shared `searchString` field. Its `.catch("").default("")` makes missing and malformed values resolve to an empty string (no filter) instead of showing a route error. `.default()` alone does not recover invalid values; `.catch()` alone does not make the field optional for typed links. The schemas are tested against JSON-typed URL values and browser deep links.

## Deployment

Deploy `dist/` to an HTTPS static host. Configure an SPA fallback so `/decks`, `/study`, and other routes serve `index.html`. Service workers require HTTPS, except on localhost. For an Android device on a local network, use HTTPS to test install/offline behavior; plain LAN HTTP is not a secure context.

## Official references used

- [shadcn + Vite](https://ui.shadcn.com/docs/installation/vite)
- [Base UI Toast](https://base-ui.com/react/components/toast)
- [TanStack Router](https://tanstack.com/router/latest/docs/framework/react/quick-start)
- [TanStack Router search parameters](https://tanstack.com/router/latest/docs/framework/react/guide/search-params)
- [Zod defaults and catch](https://zod.dev/api#defaults)
- [Dexie React](https://dexie.org/docs/Tutorial/React)
- [ts-fsrs](https://open-spaced-repetition.github.io/ts-fsrs/)
- [Google token model](https://developers.google.com/identity/oauth2/web/guides/use-token-model)
- [Google Drive uploads](https://developers.google.com/drive/api/guides/manage-uploads)
- [Vite PWA update prompts](https://vite-pwa-org.netlify.app/guide/prompt-for-update.html)
- [JSZip streaming](https://stuk.github.io/jszip/documentation/api_zipobject/internal_stream.html)
