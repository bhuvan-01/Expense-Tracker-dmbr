# Personal-use guide

The current release supports private accounts, exact expense/income/refund tracking, category maintenance, monthly overview, budgets, reports and CSV downloads. It is designed for one application instance with a persistent SQLite database.

## Start and use

1. Install Node 22.13 or later, run `npm ci`, then `npm run dev` in this checkout.
2. Open the URL printed in the terminal. Create an account, keep your password in a password manager, and confirm currency/timezone. Email password recovery is not configured yet.
3. Add expenses with a date/category. Use Income for received money. To record a refund, use the refund action beside its original expense; the receipt affects the month it is dated.
4. Use Overview to compare income with net spending. Choose a month in Budgets and set overall/category limits independently. Zero means no planned spending; an absent limit means no budget set.
5. Search/filter each history by date, category and payment method and export every matching page with Export this view. Reports downloads all entry types for the selected month. CSV is for review, not restoring an account.

Currency is fixed after the first entry or saved budget. A refund cannot predate or exceed its purchase. Correct/remove linked refunds before deleting their original purchase. Archived categories remain in history and reports.

## Back up

Run `npm run db:backup` from the same checkout/environment as the app. This uses SQLite's online backup API, so committed writes in the WAL are included without copying an incomplete live database file. A timestamped backup is written under `.data/backups/` and checked for integrity. Existing backup files are never replaced. An optional new destination can be passed after `--`.

Preserve the authentication secret separately (`BETTER_AUTH_SECRET` in production, ignored `.data/development-secret` locally). Database backups include all accounts, password hashes, financial entries and session data; keep them private and copy them to storage outside this machine. Backups are not automatically uploaded, encrypted or scheduled. Use storage permissions and encryption appropriate for your device/host. Do not commit a database, secret or private export to Git.

## Recover into a new database

1. Stop the app and preserve the current database and its WAL/SHM files. Keep the last known backup untouched.
2. Copy a verified backup into a **new** empty recovery directory with a new database filename. Set `DATABASE_PATH` to this restored copy and retain the same authentication secret. Avoid reusing old WAL/SHM files beside the restored database.
3. Revoke restored sessions before opening the app to users: using a SQLite administration tool on the restored copy, execute `DELETE FROM session;`. This prevents old sessions in the backup becoming active again.
4. Start the app with the restored path. Sign in, verify entries/budgets and compare a report with the expected backup date. Resume normal work only after checking the restored data. Keep the preserved original until recovery is confirmed.

Automated recovery checks open an independently backed-up database, run integrity/foreign-key checks and verify account, expense, income and budget records. They do not replace an operator's own backup-retention and recovery exercise.

## Public release still required

Configure mailbox verification and password-reset delivery, public HTTPS/domain settings, persistent private storage, tested off-device backups, retention/privacy terms and account-deletion handling before inviting public users. The app currently signs up without verifying mailbox ownership. This release has no bank connections, recurring entries, receipt uploads, CSV import or offline sync.
