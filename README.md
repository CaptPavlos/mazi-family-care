# Mazi — care, together

A focused English/Greek family care dashboard inspired by the workflows of [OpenCare](https://github.com/NexaFlowFrance/OpenCare). This is an independent implementation, not an OpenCare fork; no OpenCare source is incorporated.

## What works

- Interactive front/back body map with explicit patient left/right, source provenance and confirmation status.
- Conditions, medication records, appointments, assigned family tasks and expenses with original Drive receipt links.
- English and Greek interface, regional dates/currency, responsive layout and keyboard-operable dialogs.
- Private local storage, or an authenticated shared PostgreSQL workspace with encrypted record payloads and optimistic concurrency checks.
- Google OAuth with state, nonce, PKCE, verified identity, HTTP-only encrypted cookies, member access control and server-only tokens.
- Recursive, paginated Google Drive metadata indexing; original files open in Drive. DICOM study packages are linked as folders, keeping their many image slices and bundled viewer programs out of the document list. No document bytes are copied or served by this app. Existing Drive sharing still applies.
- Review-before-import for Mazi conditions JSON or FHIR R4 Condition resources in a Bundle. Duplicate IDs are skipped; imported records are unconfirmed.

## Local development

Node 22 or later:

```sh
npm ci
cp .env.example .env.local
npm run dev
```

Without connections the application is an in-memory demonstration with fictional data. For explicitly local private use set `ALLOW_LOCAL_PRIVATE=true`; records are saved under the ignored `.private/state.json`. The development server binds to loopback. Local bypass is disabled in production and on Vercel regardless of the environment flag. The private folder must never be committed, uploaded, or copied into public assets.

## Google and shared-family setup

1. Create a Google Cloud OAuth **web application** client; enable the Drive API. Configure the consent screen and permitted test users if the app is in testing.
2. Set `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `APP_URL`, `OWNER_EMAIL` and a random `SESSION_SECRET` of at least 32 characters in server environment settings. Generate a secret with `openssl rand -base64 32`.
3. Register the exact callback `APP_URL/api/auth/callback`. The app requests `openid`, `email` and `https://www.googleapis.com/auth/drive.metadata.readonly`. Metadata access is a restricted scope and public distribution may require Google's verification process. Files are opened through their original Drive URLs, not downloaded using the token.
4. For hosted use set a TLS `DATABASE_URL` and a unique `WORKSPACE_ID`. Use a separate database/workspace for previews. The app initializes one namespaced table on first authorized use. Workspace payloads are encrypted with a key derived from `SESSION_SECRET`; back up that secret as well as the database. Changing it without migrating records makes old records unreadable.
5. Sign in as the configured owner, add family members' Google email addresses in Settings, select a folder and refresh the index. Family members retain their own Drive permissions; adding them here does not share the source files. The Google account used for refresh must be able to see the selected folder.

Do not place any of these values in `NEXT_PUBLIC_*` variables. Never copy the credentials of a Codex connector into this application. A connected Codex Drive plugin and this application's OAuth client are separate authorizations.

## MyHealth: implemented scope and limitation

[Greece's official developer services](https://ehealthrecord.gov.gr/en/developers-services) directs software developers to an interoperability compliance/simulation platform. No unauthenticated personal-record API or undocumented endpoint is assumed here.

The app currently opens the official portal and supports a reviewed structured import; **direct MyHealth sync and a live authenticated browser collector are not implemented**. The JSON/FHIR formats supported by the importer are app interchange formats, not a claim that the citizen portal exports them. A locally supervised portal extraction can be normalized to the documented Mazi format and reviewed before import. Do not put Taxisnet credentials, browser profiles, or cookies in the app or repository. PDFs/scans can stay in Drive and be linked to manually reviewed records. OCR and automatic medical interpretation are not included.

Example import (fictional):

```json
{
  "conditions": [
    {
      "id": "example-1",
      "title": { "en": "Example record", "el": "Ενδεικτική εγγραφή" },
      "region": "body",
      "status": "history",
      "detail": { "en": "Original source wording", "el": "Αρχική διατύπωση" },
      "date": "",
      "source": "document",
      "sourceId": "",
      "verified": false
    }
  ]
}
```

## Vercel

Import the public source repository as a Next.js project, then configure the server environment above. Unauthenticated visits show fictional demo data. Real records must be entered/imported only inside an authenticated workspace. The local private store and local environment files are excluded by `.gitignore`, `.vercelignore` and output tracing exclusions. Do not connect a production data store to untrusted preview deployments.

The application organizes source records; it does not diagnose, recommend treatment, infer missing doses, or verify family-reported claims. Clinical translations are not automatically generated: original text is preserved unless a person edits the other language.

## Checks

```sh
npm run typecheck
npm test
npm run build
```

The security tests cover role boundaries, invalid folder identifiers, import confirmation and deduplication. Real Google token exchange and MyHealth access need the respective live account configuration and are not represented as tested by these checks.

## References

- [OpenCare family workflows](https://github.com/NexaFlowFrance/OpenCare)
- [Google server-side OAuth](https://developers.google.com/identity/protocols/oauth2/web-server)
- [Google Drive scopes](https://developers.google.com/workspace/drive/api/guides/api-specific-auth)
- [Greek NEHR developer onboarding](https://ehealthrecord.gov.gr/en/developers-services)
