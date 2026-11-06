# Expense Tracker — Proposed UX Contract

Status: authentication implemented on 4 November 2026; expense entry/history milestone implemented on 5 November 2026. Income, refunds, budgets, and reports remain planned.

## Context and ownership

Audience, scope, calculations, and privacy decisions are proposed in [PROJECT_PLAN.md](PROJECT_PLAN.md). Visual intent and tokens live in [DESIGN.md](DESIGN.md). The authentication decision and production boundaries are maintained in [TASKS.md](TASKS.md) and [README.md](README.md); implementation lives in `server/auth.ts`, `server/app.ts`, and the shared auth components. Financial component names below remain proposals.

## Implemented authentication owners and behavior

| Capability | Canonical owner | Source of truth | Allowed variants | Verification |
|---|---|---|---|---|
| Form | `src/components/Field.tsx`, `src/lib/validation.ts`, `src/pages/AuthPage.tsx` | Auth field/validation rules | Signup / sign-in | `tests/e2e/auth.spec.ts` |
| Scrollbar | `src/styles.css` | DESIGN.md runtime mapping | Global baseline | Global CSS baseline and browser inspection |
| Feedback | `src/pages/AuthPage.tsx`, `src/pages/WorkspacePage.tsx` | Inline errors and announced status | Error / pending | Failure/retry browser tests |
| Dialog | `src/components/LeaveDialog.tsx` | Native dialog with owned content and managed opening/cancel | Discard form | Escape, focus, discard tests |
| Session/access | `server/auth.ts`, `server/app.ts` | Better Auth and server-enforced session requirement | Public auth / protected workspace | `tests/auth.test.ts` |
| Select/Listbox | `src/components/SelectField.tsx` | Native select; platform owns popup appearance, geometry and keyboard interaction | Currency, timezone, category, payment method, filters, sort | `tests/e2e/expenses.spec.ts` |
| Date | `src/components/Field.tsx` with `type="date"`, `src/lib/ledger.ts` | Native calendar; ISO date-only storage with shared validation | Expense date, range filters | `tests/ledger.test.ts`, browser fill/keyboard tests |
| CRUD | `server/ledger.ts`, `server/ledger-routes.ts`, `src/components/ExpenseForm.tsx`, `ExpenseHistory.tsx`, `DeleteExpenseDialog.tsx` | Owner-scoped expense operations and shared status/dialog primitives | Create, read, edit, permanent delete | `tests/ledger.test.ts`, `tests/e2e/expenses.spec.ts` |

## Implemented expense behavior

The account-ready placeholder is replaced by workspace setup and a private expense ledger. Workspace currency and timezone require user confirmation before recording money. Supported currencies are GBP, USD, EUR, INR, JPY, AED and BHD; digits are explicit in `src/lib/ledger.ts`. Workspace settings permit correcting currency before the first expense and changing timezone later. Currency locks permanently after the first expense, including after deleting every expense. Date-only records never shift with timezone changes; timezone determines today's upper bound only.

The user can add positive expenses with amount, category and date, plus optional merchant/description, payment method and note. Starter categories and custom categories are owner-scoped. Category rename/archive remains future scope; there is no category deletion control. Custom category name retries reuse an existing case-insensitive match. Future category archiving must retain referenced history.

Money parses as a decimal string to integer minor units; a record is limited to 999,999,999 minor units. The expense payload includes the currency displayed by the form; a workspace currency change in another tab must return 409 rather than reinterpret the amount. Future-dated records, invalid calendar dates, negative/zero values, excessive precision and cross-owner categories are rejected by the server. UI and API use the same validation and date rules.

Creates use an owner-scoped idempotency key. Same key/body returns the existing expense; different details with a previously committed key return 409. An uncertain network/server outcome freezes the entered details for an identical retry or discard; it must not silently start a second create with altered details. A deleted expense keeps a request tombstone so an old retry cannot recreate it. Edit and delete require the current record version; stale mutations return 409 and preserve form values. Success feedback only follows server confirmation. Permanent deletion names the expense, amount, consequence, and lack of Undo; Keep expense is initially focused. A retry reporting 404 after deletion is treated as already removed. Closing an editor/delete dialog refreshes history to recover from conflicts or uncertain outcomes.

The history list has 25 entries per page. Search covers merchant, note and category; wildcard characters are literal. Search is debounced 300ms, IME-safe, clears immediately, and is sent by JSON body so financial text stays out of URLs. Safe category/date/sort/page state persists in URL parameters. Browser Back/Forward restores these safe filters. Requests cancel or discard stale responses. Page requests clamp to the last surviving page after deletion.

Displayed total spending covers all matching results across pages, with no income or bank balance implication. First-use empty, no-results, loading, retry, stale-results-with-error and expired-session states are separate. A session-expired editor retains its details in memory and provides sign-in in a separate tab, then retry. No financial drafts are placed in persistent browser storage.

`Dialog.tsx` is the shared native modal owner for expense forms, discard and deletion. Desktop entry uses a right-side drawer; phone uses full-screen form. Escape/Cancel on dirty forms opens the discard confirmation. Native date/calendar and select popup ownership deliberately supersedes the unimplemented authored-picker proposal below: platform rendering and locale are accepted for this English-first milestone; no popup geometry customization is promised.

`StatusMessage.tsx` owns expense inline error/success feedback. Existing Field and theme primitives are reused. No toast layer or bulk selection is introduced.

Signup collects name, email, password, and confirmation; client/server enforce applicable constraints. Passwords use the library's scrypt hash; sessions are database-backed cookies. Signup signs in immediately, without mailbox verification. Production verification/recovery awaits an email provider. The client stores no credentials or session tokens in persistent browser storage.

Successful signup/sign-in goes to `/app`. Sign-out revokes the current session and returns to `/sign-in`. Server guards both `/app` and `/api/me`; an expired session redirects to sign-in. There is no arbitrary callback URL or external redirect parameter. Generic invalid-credential failures preserve email and clear password; network failures retain input in memory. Signup error copy avoids raw server/database messages. Rate-limit errors explain when to retry.

Auth fields use app-owned validation, visible labels, first-invalid focus, `aria-invalid`, and error descriptions. Password controls expose show/hide labels and use appropriate autocomplete. Buttons prevent repeat submit. In-app auth-mode changes ask before discarding filled fields; page unload uses the browser's narrow unsaved-change mechanism. Native `<dialog>` supplies modal focus containment and focus restoration; Keep editing is initially focused.

There is no comparable pre-existing screen. Signup and sign-in use the same layout, fields, error styling, and navigation rules. Automated evidence covers desktop, phone, reduced motion, keyboard, failed requests, session lifecycle, and axe scans. Exact runtime token ownership is in DESIGN.md. Future date/select/table owners are not implemented for this auth milestone.

English UI first; user-selected currency and timezone; Gregorian transaction dates. Accessibility target: WCAG 2.2 AA. Retention periods, supported jurisdictions, and final deletion policy require an explicit product decision before launch.

## Canonical UI owners to establish

| Capability | Proposed shared owner | Contract |
|---|---|---|
| Entry form | TransactionForm | Same fields/validation in create and edit; desktop drawer and phone full-screen variants |
| Select | AccessibleSelect | Shared keyboard behavior, clear selected value, popup collision handling |
| Date | TransactionDateField | Local date value; authored calendar/typed entry with unambiguous format |
| Feedback | FormFeedback and StatusMessage | Inline failures; announced nonblocking success; no sensitive details in toasts |
| Dialog | ConfirmDialog | Managed focus, Escape/cancel, focus restoration, busy/error handling |
| History | TransactionList | Desktop table and phone rows share sorting/filtering/data behavior |
| Search/filter | TransactionFilters | Immediate clear; 300ms remote debounce; ignore stale responses |
| Theme/scrollbars | Shared theme stylesheet | One token mapping, visible global scrollbars, forced-color compatibility |

These are reusable component responsibilities. Record their actual source paths when implemented.

## Navigation and dataset state

- Desktop: Overview, Transactions, Budgets, Reports, Settings. Phone: Overview, History, Budget, More; More contains Reports and Settings.
- Default history: newest transaction date first, stable tie-break by ID; server pagination, initially 25 entries per page.
- Safe filters/sort/page may use URL state. Keep free-text merchant/note searches in memory rather than URLs or persistent browser storage; preserve them during in-app navigation.
- Filter changes reset the page; Back restores the prior list and scroll where practical.
- Show empty account, no matching results, loading, error/retry, and populated states distinctly. “No matches” offers Clear filters.
- Export explicitly chooses all history or the current filtered results, across all matching pages.
- Reports and overview use the same period definition. Category drill-down opens matching history filters.

## Flow ledger

| Operation | While pending | Success | Failure / focus |
|---|---|---|---|
| Create | Disable repeated save; retain values | Close form, refresh current screen, announce “Expense added” or “Income added” | Keep form/values; focus first invalid field or error summary; retry safely |
| Edit | Same as create | Close editor, update current screen, announce “Changes saved” | Preserve values; explain validation/conflict; restore focus on close |
| Delete | Confirmation names record; disable repeated confirmation | Close dialog, remove record, refresh totals, focus next row/list heading | Keep dialog open; show error and Retry/Cancel |
| Save budget | Stable busy button | Update cap/progress, announce “Budget saved” | Preserve cap values; inline guidance |
| Search | Retain existing results with updating status | Replace results with newest query response | Keep query and useful retry; clear cancels older requests |
| Export | Show preparation progress where needed | Download selected scope; announce completion | Retain scope choice and retry |
| Cancel/back | Detect changed form | Return to original view; restore trigger focus | Dirty form offers Keep editing / Discard changes |

Do not announce success before the server confirms it. Do not claim Undo unless the storage lifecycle supports restoration.

## Validation and sensitive inputs

- Validate positive, finite currency amounts with supported precision, required category, valid date, and suitable length limits on text.
- Use app-owned inline errors, labeled fields, noValidate forms, first-invalid focus, and server-side validation.
- Allow accessible paste and password-manager behavior. Mask secrets by default with an accessible show/hide action.
- Preserve geometry during busy/error states. Never write transaction notes, amounts, or credentials into diagnostic logs or success messages.
- Confirm currency before the first record; explain that changing it later requires a defined migration.

## Resilience and privacy consequences

- Use server-confirmed mutations. Safe retries require an idempotency key for creates; repeated clicks cannot make duplicate records.
- Cancel superseded reads or discard stale responses. Invalidate overview, budget, history, and reports after related mutations.
- Detect record-version conflicts. Show a conflict message with options to reload the latest record or review edits; do not silently overwrite.
- On expired sessions, request reauthentication. Keep the active form only in memory where feasible; persistent financial drafts need a separate privacy design.
- Offline: show a clear status; do not falsely report a saved record. Durable offline writes are deferred.
- Enforce ownership on the server. The UI cannot grant access to another user's records by changing an identifier.
- Category/payment-method archive preserves history; hard deletion of referenced labels is unavailable.
- Account deletion is separate from transaction deletion: explain data scope, request reauthentication, offer export, and show the final retention policy before confirmation. Its production lifecycle remains unresolved until that policy is agreed.

## Accessibility and responsive requirements

- Semantic links/buttons, visible focus, associated labels, text errors, announced statuses, and usable keyboard dialogs/selects.
- Chart information also available as text/table; status never relies on color alone.
- Intended 44px touch controls; test sticky navigation and virtual-keyboard focus clearance.
- Full values accessible without hover-only interactions. Long names wrap or expose a labeled detail view; currency values are never silently truncated.
- Test phone, tablet, desktop, 200% zoom, reduced motion, and long content.

## Verification at implementation

Run repository-owned formatting, type checks, build, and meaningful calculation/access-isolation tests once the stack exists. Exercise complete create/edit/refund/delete journeys, save failures/retries, session expiry, conflicts, empty/no-results states, keyboard interaction, and a narrow viewport in a browser. Compare repeated operations across Overview and Transactions.

Authentication test sources: `tests/auth.test.ts`, `tests/e2e/auth.spec.ts`, and `tests/design.test.ts`. Run the commands in README.md for current results. Financial workflow checks remain pending implementation; automated accessibility scans are not a claim of complete conformance.


## Implemented money-entry rules

Income uses positive exact minor units without an expense category. Refunds must reference an owned purchase, cannot predate it or cumulatively exceed it, and remain attached on edit. The server blocks deleting refunded purchases or changing their amount/date incompatibly. Expenses display gross totals; refunds reduce net spending in their own recorded period. Category rename updates historical labels; archive hides new selection while allowing edits to historical entries. Category modal has busy, error, success and dirty-exit states.


## Monthly overview implementation

`server/summary.ts` owns all dated-event totals. Month selection cancels superseded reads and clears old figures until the selected month loads. Previous-period comparison uses calendar months. Refunds are positive receipts that reduce net spending in their own month; the difference is recorded income minus net spending, never a bank balance. Empty months show zero totals with explicit guidance; failures offer retry. Category tables expose the exact values without relying on graphics.


## Budget implementation

Monthly overall/category caps are independent, use the same net-spending calculation as Overview, and never roll forward silently. Zero is a valid no-spending limit; null means unset. Server-owned versions detect stale changes and survive removal to avoid stale recreation. Identical one-version save retries are safe after a lost response. Saved budgets lock workspace currency. Dirty editor values remain in memory on errors; removal confirms its month/scope while preserving entries.


## Reports and export implementation

Reports reuse the overview calculation service and expose daily/month totals. CSV export uses exact money strings, positive entry amounts plus explicit signed net-spending effects, type and original-purchase linkage. Exports include all matching pages, at most 10,000 entries, with server-owned account isolation, origin/session checks, no-store responses and spreadsheet-formula escaping. History exports snapshot the current visible search/filter scope. Busy exports do not claim completion until a blob is received; status says download started, because browser disk persistence is outside the app. Monthly selectors are locked while exporting to avoid ambiguous scope.
