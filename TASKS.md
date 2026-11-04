# Feature milestones

Complete and verify one milestone before starting the next. Commit and push each completed milestone, as requested by the project owner. Use the maintained product plan for acceptance criteria; revise the list if priorities change.

| Order | Milestone | Status |
|---|---|---|
| 1 | Signup, sign-in, sessions, protected workspace, sign-out | Complete — delivered on `codex/signup-signin` |
| 2 | Expense entry and persistent transaction history with ownership checks | Next |
| 3 | Income, refunds, edit/delete, categories, and filtering | Planned |
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
