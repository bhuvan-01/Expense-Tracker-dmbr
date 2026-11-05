# Feature milestones

Complete and verify one milestone before starting the next. Commit and push each completed milestone, as requested by the project owner. Use the maintained product plan for acceptance criteria; revise the list if priorities change.

| Order | Milestone | Status |
|---|---|---|
| 1 | Signup, sign-in, sessions, protected workspace, sign-out | Complete — delivered on `codex/signup-signin` |
| 2 | Expense entry/history, edit/delete, starter/custom categories, filters and ownership checks | Complete — delivered on `codex/expense-entry` |
| 3 | Income, refunds and category rename/archive | Next |
| 4 | Monthly overview using one shared calculation service | Planned |
| 5 | Overall and category budgets | Planned |
| 6 | Reports and CSV export | Planned |
| 7 | Email verification/recovery, production privacy/data controls, launch checks | Required before public launch |

## Milestone 1 decisions — 4 November 2026

- The remote repository contained only a README; the existing local planning documents supplied the design/product brief.
- React/Vite frontend, same-origin Express backend, Better Auth email/password authentication, and SQLite with the stable better-sqlite3 driver.
- One private identity per account; no social providers, roles, or shared workspaces yet.
- Signup signs in immediately. Mailbox verification and password recovery require a configured email provider and are explicitly deferred before public launch.
- The post-login screen is a minimal account-ready workspace; the monthly overview illustration is labeled as sample preview content.
- Development secrets and databases are generated locally and ignored by Git. Production requires explicit secrets, HTTPS, and persistent private storage.

Verification on 4 November 2026: production build/typecheck, 12 backend/design tests, 4 Chrome browser tests with axe scans, formatting, and the strict UI contract audit passed. The design format checker reported zero errors, with reference warnings because runtime CSS owns the palette. Desktop sign-in and phone signup screenshots were visually inspected. Full accessibility conformance and production deployment are not claimed. Future milestones must preserve these auth checks.

## Milestone 2 decisions — 5 November 2026

- Replace the welcome placeholder with workspace setup and an owner-scoped expense ledger. Preserve existing auth accounts and the shared theme.
- Confirm currency and timezone before entry. Exact integer minor-unit storage supports GBP/USD/EUR/INR/AED (2 decimals), JPY (0) and BHD (3). Per-expense maximum: 999,999,999 minor units.
- Scope includes starter/custom categories, optional notes/payment labels, search/filter/sort, pagination, filtered totals, edit and confirmed permanent delete. These correction tools were pulled forward so saved expenses can be maintained immediately.
- The server enforces ownership, exact-origin JSON mutations, field validation, persistent create idempotency and edit/delete version conflicts. Local dates never shift when timezone changes.
- Workspace settings can change currency before the first expense and timezone afterwards. Currency remains locked even if all expenses are deleted.
- Native date/select popups deliberately retain platform-owned geometry and keyboard behavior. Shared modal/status components extend authentication consistently.
- Do not merge the authentication PR automatically. This branch is based on `codex/signup-signin`; its review should target that branch until PR #1 is merged.
- Income/refunds, category archive/rename, budgets, reports/export and the public-launch privacy/email requirements remain future milestones.

Verification on 5 November 2026: 21 backend/domain/design tests and 8 Chrome browser tests passed, including private-record isolation, exact totals, lost-save-response retries, stale mutations, desktop/mobile accessibility scans, settings, and modal focus recovery. Production build/typecheck, formatting, and strict UI audit passed. Desktop ledger and phone entry/history captures were visually inspected. Financial records, credentials, and generated captures remain excluded from Git. Full accessibility conformance and public production deployment are not claimed.
