# Expense Tracker

A personal expense tracker, built feature by feature. The first milestone implements real email/password signup and sign-in, persistent accounts, protected workspace access, and sign-out.

## Run locally

Requires Node.js 22.13+ and npm.

```sh
npm ci
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). The development server listens on loopback only. Signup creates your own account; there are no seeded users or shared demo credentials.

Development automatically creates an ignored `.data/development-secret` and SQLite database at `.data/expense-tracker.sqlite`. Accounts and sessions survive restarts. Keep this directory private; it contains authentication data. Deleting it deletes local accounts. No secret, database, user account, or generated build is committed.

Optional configuration: copy `.env.example` to `.env`. To generate your own secret:

```sh
node -e "console.log(require('node:crypto').randomBytes(32).toString('base64url'))"
```

Put the generated value in `BETTER_AUTH_SECRET`. `BETTER_AUTH_URL` must match the origin used in the browser, including the port. Set `PORT` consistently when changing it. Changing the secret can invalidate existing sessions.

## Implemented

- Responsive signup and sign-in screens, shared accessible fields, local fonts, and password visibility controls.
- Name/email/password validation, 12–128 character signup passwords, and confirmation matching.
- Better Auth password hashing, database-backed sessions, and same-origin cookie authentication.
- Persistent SQLite accounts and additive authentication-schema migrations at startup; `npm run db:migrate` also runs migrations explicitly.
- Server protection for `/app` and `/api/me`, a minimal signed-in welcome screen, and sign-out that revokes the current session.
- Database-backed request limits, cross-site request protection, trusted-origin validation, security headers, and no-store responses for private pages/APIs.
- Inline validation/server/network failures, prevention of repeat submits, unsaved-form navigation confirmation, and keyboard/reduced-motion support.
- Automated backend, browser, accessibility, and CI checks.

No transactions or financial totals are implemented yet. The sign-in illustration is explicitly labeled sample content; the signed-in screen describes the next milestone.

## Checks

```sh
npm run format:check
npm run build
npm test
npm run test:e2e
```

Browser tests use Chrome on a local workstation. Install Chrome or use CI, where Playwright Chromium is installed by the workflow. Browser tests run an isolated server on port 4173 and use a separate ignored database, never the normal development account database.

Backend tests cover persistence, password hashes, invalid credentials, duplicate accounts, expiration, sign-out/revocation, private route access, origin rejection, and IP-spoof-resistant rate limiting. Browser tests cover signup/sign-in/sign-out, reloads, mobile validation, password visibility, discard confirmation, network failures, reflow, and automated axe accessibility scans. Automated checks do not establish complete accessibility conformance.

## Production setup

```sh
npm ci
npm run build
npm start
```

Before starting, configure:

- `BETTER_AUTH_SECRET`: a high-entropy secret of at least 32 characters, injected through your hosting platform's secret store.
- `BETTER_AUTH_URL`: the exact public HTTPS origin. Production startup rejects HTTP.
- `DATABASE_PATH`: a persistent private volume for the SQLite file; back up and test restoration. This implementation is for a single app instance, not ephemeral/serverless filesystems or independently scaled replicas.
- `HOST` / `PORT`: local defaults are `127.0.0.1` / `3000`. Set `HOST=0.0.0.0` only when required by your hosting network, with appropriate access controls.
- `TRUSTED_PROXY_CIDRS`: optional comma-separated addresses/CIDRs for your actual reverse proxies. Leave unset for direct connections. Proxies must sanitize forwarding headers and direct origin access should be restricted. Without this setting, rate limiting behind a proxy groups visitors by the proxy's address.

Use a reverse proxy that terminates HTTPS. Production cookies use Secure and HttpOnly with SameSite=Lax; sessions last up to seven days and refresh after a day of activity. Sign-out invalidates the current session immediately. Configure production secret, persistent storage, backup/retention procedures, and public-domain access before exposing real data.

Email ownership verification, password-reset email, and social login are not part of this milestone. Signup currently signs users in immediately and does not verify mailbox ownership. Connect a mail provider and complete verification/recovery before a public release handling personal financial records. The UI does not offer a recovery link that cannot send mail.

Authentication behavior is delegated to [Better Auth](https://better-auth.com/docs/installation), following its [SQLite](https://better-auth.com/docs/adapters/sqlite), [Express](https://better-auth.com/docs/integrations/express), and [security](https://better-auth.com/docs/reference/security) guidance.

## Project guide

- [Full feature roadmap](PROJECT_PLAN.md)
- [Visual design and runtime token mapping](DESIGN.md)
- [Interaction contract](UX-CONTRACT.md)
- [Milestones](TASKS.md)

Stack: React, TypeScript, Vite, Express, Better Auth, and better-sqlite3. The browser never stores credentials/session tokens in localStorage. Password hashing, cookie signing, session creation/revocation, and CSRF checks belong to Better Auth; do not replace them with a browser-only login flag.

Completed feature milestones are committed and pushed to the GitHub repository on a `codex/` branch, with review links and validation evidence. Do not push credentials, account databases, screenshots containing user data, or failing work as completed.
