# Expense Tracker

A personal expense tracker, built feature by feature. Signup/sign-in and the first expense-ledger milestone are implemented: record, review, edit, filter and delete your own expenses.

## Run locally

Requires Node.js 22.13+ and npm.

```sh
npm ci
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). The development server listens on loopback only. Signup creates your own account; there are no seeded users or shared demo credentials.

Development automatically creates an ignored `.data/development-secret` and SQLite database at `.data/expense-tracker.sqlite`. Accounts, sessions, preferences, categories and expenses survive restarts. Keep this directory private; it contains authentication and financial data. Deleting it deletes local accounts and records. No secret, database, user account, or generated build is committed.

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
- Server protection for private pages/APIs and sign-out that revokes the current session.
- Database-backed request limits, cross-site request protection, trusted-origin validation, security headers, and no-store responses for private pages/APIs.
- Inline validation/server/network failures, prevention of repeat submits, unsaved-form navigation confirmation, and keyboard/reduced-motion support.
- Automated backend, browser, accessibility, and CI checks.
- First-use workspace setup and settings for user-confirmed currency/timezone. GBP, USD, EUR, INR, JPY, AED and BHD are supported. Currency locks after the first recorded expense, including if that expense is later deleted.
- Private, persistent expenses with amount, category and date, plus optional merchant/description, payment method and note. Add custom categories from the entry form.
- Decimal-string parsing into exact integer minor units, currency-aware precision and validation of real calendar dates through today in the selected timezone.
- Search by merchant, category or note; date/category filters, sorting, 25-row pagination and a total covering all matching results. Search text stays out of URLs.
- Edit/version conflicts, permanent deletion with confirmation, safe create retries and request tombstones to prevent a deleted expense from being recreated by an old retry.
- Desktop entry drawer, mobile full-screen form, unsaved-input recovery, stale-list/error states and session-expiry guidance.

After signup, choose currency/timezone, select **Add expense**, fill the amount/category/date and save. Records and settings are private to the signed-in account. The sign-in illustration remains explicitly labeled sample content. The expense ledger displays actual saved records only.

Income, refunds, category rename/archive, monthly dashboards, budgets, reports, CSV export, attachments and offline synchronization are still planned. Payment methods are labels, not connected account balances. Expense totals do not imply a bank balance or amount available to spend.

Amounts are limited to 999,999,999 minor units per expense. Negative/zero amounts, unsupported precision, dates before 1900 and future dates are rejected. This milestone permanently deletes individual expenses after confirmation; it does not promise Undo. Workspace/account deletion and retention policies remain launch work.

## Checks

```sh
npm run format:check
npm run build
npm test
npm run test:e2e
```

Browser tests use Chrome on a local workstation. Install Chrome or use CI, where Playwright Chromium is installed by the workflow. Browser tests run an isolated server on port 4173 and use a separate ignored database, never the normal development account database.

Backend tests cover authentication, exact amounts, calendar/timezone boundaries, record persistence, ownership isolation, origin rejection, safe retries, edit/delete conflicts, filtered totals and pagination. Browser tests cover auth, workspace setup/settings, full expense CRUD, custom categories, search, filtering, mobile reflow, save-response loss, failure recovery, session expiry and automated axe accessibility scans. Automated checks do not establish complete accessibility conformance.

## Expense API

All endpoints require a valid session. Mutations/search require `Content-Type: application/json` and an `Origin` matching `BETTER_AUTH_URL`. Ownership comes from the session; callers cannot choose another owner.

| Endpoint | Behavior |
|---|---|
| `GET /api/workspace` | Current preferences and private categories |
| `PUT /api/workspace` | Confirm currency/timezone; currency changes rejected after the first expense |
| `POST /api/categories` | Create or reuse a category name in this workspace |
| `GET /api/expenses` | Paginated list with safe date/category/sort/page parameters |
| `POST /api/expenses/search` | Same list with private search text in a JSON body |
| `GET /api/expenses/:id` | Fetch one owned expense |
| `POST /api/expenses` | Create with a unique `Idempotency-Key` header |
| `PATCH /api/expenses/:id` | Edit with the current numeric `version` |
| `DELETE /api/expenses/:id` | Delete with the current numeric `version` |

Expense body: `currency` matching the confirmed workspace, `amount` as a decimal string, ISO `date`, owned `categoryId`, optional `merchant`, `paymentMethod` and `note`. Creates return 201, identical safe retries 200, stale edits/deletes or a changed workspace currency 409, missing or unowned IDs 404, invalid fields 400, and expired sessions 401. A retry after an uncertain create reuses the same key and details. The editor freezes these details until retry or discard to avoid duplicate records. A workspace currency change in another tab must never silently reinterpret the entered amount.

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

Stack: React, TypeScript, Vite, Express, Better Auth, and better-sqlite3. The browser never stores credentials/session tokens or expense drafts in localStorage. Better Auth owns authentication security; the ledger router separately requires a verified session and exact origin/JSON checks for mutations. Do not replace these checks with a browser-only login flag.

Completed feature milestones are committed and pushed to the GitHub repository on a `codex/` branch, with review links and validation evidence. Do not push credentials, account databases, screenshots containing user data, or failing work as completed.
