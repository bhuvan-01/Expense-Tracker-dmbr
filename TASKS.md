# Feature milestones

Complete and verify one milestone before starting the next. Commit and push each completed milestone, as requested by the project owner. Use the maintained product plan for acceptance criteria; revise the list if priorities change.

| Order | Milestone | Status |
|---|---|---|
| 1 | Signup, sign-in, sessions, protected workspace, sign-out | Complete — delivered on `codex/signup-signin` |
| 2 | Expense entry/history, edit/delete, starter/custom categories, filters and ownership checks | Complete — delivered on `codex/expense-entry` |
| 3 | Income, refunds and category rename/archive | Complete |
| 4 | Monthly overview using one shared calculation service | Complete |
| 5 | Overall and category budgets | Complete |
| 6 | Reports and CSV export | Complete |
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

Verification on 5 November 2026: 22 backend/domain/design tests and 8 Chrome browser tests passed, including private-record isolation, exact totals, lost-save-response retries, stale mutations, cross-tab currency changes, desktop/mobile accessibility scans, settings, and modal focus recovery. Production build/typecheck, formatting, and strict UI audit passed. Desktop ledger and phone entry/history captures were visually inspected. Financial records, credentials, and generated captures remain excluded from Git. Full accessibility conformance and public production deployment are not claimed.


## Milestone 3 — 6 November 2026

Income CRUD, linked partial refunds, immutable refund ownership/linkage, category rename/archive/restore, and migration-safe starter category seeding implemented. Existing auth and expense workflows retained. Work lives in an isolated checkout to preserve the separate uncommitted bill-support prototype.

Verification: 23 backend/domain/design tests, 8 Chrome browser journeys, production build/typecheck, formatting and strict UI contract audit. Income/refund/category flows are included in the desktop journey; previous private-data, retry, conflict and mobile coverage remains.


## Milestone 4 — 6 November 2026

Owner-scoped monthly overview uses one shared dated-event calculation service. Exact income, expenses, refunds, net spending and income minus net spending agree with category/day breakdowns. Includes previous-month comparison, native month selection and empty/loading/error/retry states. Refunds of older purchases affect the refund month.


## Milestone 5 — 6 November 2026

Monthly overall/category budgets with exact shared spending totals, zero limits, bounded accessible progress, remaining/over text, versioned edit/removal, loss-safe identical retries and currency consistency. Archive preserves referenced budgets.


## Milestone 6 — 6 November 2026

Monthly daily reports and CSV downloads for a month or filtered expense/income/refund history. Exact signed spending/income columns, cross-page export, linked purchase IDs, private scopes, formula escaping and download recovery. Phone tables have keyboard-scroll regions and visible hints.


## Personal-use readiness — 6 November 2026

Added an integrity-checked online SQLite backup command, recovery guide and authenticated home redirect. Core milestones 1–6 are implemented. Public-launch email verification/recovery, profile/privacy/deletion lifecycle and hosted deployment remain open; personal-use readiness is not a public-launch claim. See PERSONAL_USE.md.

Personal-use polish also includes native payment-method filters across all histories and CSV, plus backend consistency coverage.

Final local validation: 29 backend/domain/design tests and all 8 Chrome journeys passed (the payment-filter journey was rerun after its import fix); build/typecheck, formatting and strict UI audit passed. Monthly overview, budget and report phone captures were inspected. Existing local database backup passed integrity checks; separate bill-support working changes were preserved.

CI caught a transient navigation contrast issue during a background fade. Navigation now switches text/background together without fading, preserving contrast throughout the state change. The existing browser accessibility journey verifies the final behavior.

Budget editor save/cancel restores focus to the persistent budget heading when a refresh removes the original row action. The desktop/phone journey asserts this recovery.
