# Expense Tracker — Website Plan

Status: proposed product and design plan; no application has been built.
Prepared: 28 October 2026.

## 1. Product goal and assumptions

Help people record everyday spending, understand where their money goes, and stay within a monthly budget.

The product should answer three questions immediately:

1. How much have I spent this month?
2. Which categories account for that spending?
3. How much of my planned spending budget remains?

Planning assumptions, open to revision:

- Personal use, with one private workspace per user. Business accounting and household collaboration are future scope.
- Responsive website: fast entry on phones, detailed review on larger screens.
- Manual entry first; cloud storage and sign-in for the production release.
- English interface initially. Users select their currency and timezone during setup; GBP examples below are illustrative.
- One currency per workspace initially. Currency is fixed after the first transaction unless a deliberate migration is designed.
- Monthly budgets follow calendar months. Dates entered for transactions are local calendar dates.
- This product records financial activity. It does not move money or provide investment advice.

## 2. Feature priorities

### Must have — first usable release

| Feature | Required behavior | Why it matters |
|---|---|---|
| Account and setup | Sign up, sign in, sign out, recovery, currency/timezone selection, starter categories | Keeps records private and gives users a usable starting point |
| Expense entry | Add amount, date, category; optional merchant, payment method, note | Makes daily recording practical |
| Income entry | Record income separately from spending | Enables a useful monthly income/outgoings summary |
| Transaction management | View details, edit, delete with confirmation; refresh affected totals after success | Lets users correct mistakes confidently |
| Categories | Starter categories plus create, rename, archive custom categories | Makes summaries meaningful |
| Transaction history | Search, date/category/type/payment filters, sort, pagination | Helps users find and review records |
| Monthly overview | Income, net expenses, income minus expenses, remaining monthly budget | Gives a clear picture without visiting several screens |
| Budgets | Optional overall monthly cap and optional category caps; show spent/remaining/over amounts | Turns tracking into a useful habit |
| Basic reports | Category breakdown, daily or weekly spending trend, prior-period comparison | Explains where spending changes |
| CSV export | Export the full history or current filtered results with an explicit scope | Gives users access to their records |
| Settings and data controls | Profile, locale/timezone, export access, account-deletion request flow | Supports ongoing use and control over data |
| Reliable, accessible experience | Responsive layout, keyboard access, clear validation, loading/empty/error states | Makes all core features usable |

Suggested categories: groceries, housing, bills, transport, eating out, shopping, health, entertainment, education, travel, and other. Let users change these.

### Recommended additions — after the core release

| Addition | Intended experience | Dependency / complexity |
|---|---|---|
| Recurring bills | Schedule bills, show upcoming items, confirm when paid | Medium; scheduled items stay separate from posted expenses |
| Receipt attachments | Attach a photo/PDF to a transaction | Medium; private file storage, upload limits, deletion policy |
| CSV import | Map columns, preview results, flag duplicates and invalid rows, then confirm import | Medium; reliable transaction validation first |
| Reusable entries | Duplicate a previous transaction or save a frequent purchase template | Low; preserve a fresh date and new record ID |
| Tags and split categories | Label purchases and divide one purchase across categories | Medium; totals must never count splits twice |
| Budget reminders | Optional in-app reminders at chosen thresholds | Medium; preferences and deduplication needed |
| Saved views | Remember useful combinations of filters | Low; searchable history first |
| Monthly summaries | A clear period recap with user-chosen delivery preferences | Medium; accurate reports first |
| Dark theme | A tested alternative color scheme | Medium; preserve contrast in charts, forms, and overlays |
| Installable web app | Home-screen installation and a focused app shell | Medium; offline writes are a separate capability |

### Future improvements — larger product expansions

| Improvement | Value | Gate before building |
|---|---|---|
| Bank connections | Reduce manual entry | Research providers, supported regions, consent, security, reconciliation, and cost |
| Receipt scanning | Extract draft amounts, dates, and merchants | Add attachments first; user reviews extraction before saving |
| Smart categorization | Suggest likely categories | Enough clean history; suggestions stay editable and explainable |
| Multiple accounts and transfers | Track cash, bank, and card activity | Define account balances, transfers, reconciliation, and credit-card payment rules |
| Multiple currencies | Support travel or international spending | Define original currency, conversion rate/source/date, and reporting currency |
| Shared household budgets | Coordinate spending with a partner or family | Invitation, ownership, access, leaving, and conflict rules |
| Savings goals | Track progress toward planned purchases | Define contributions and avoid treating transfers as spending |
| Forecasting | Estimate likely month-end spending | Sufficient history; clearly distinguish estimates from recorded values |
| Offline entry and sync | Record spending without connectivity | Durable queue, retry/idempotency, conflict resolution, device privacy |
| Business tools | Reimbursements, tax tags, approvals | Separate business discovery and jurisdiction-specific requirements |
| Native mobile apps | Deeper device integration | Evidence that the responsive website cannot meet user needs |

Future improvements to the existing product should also include simpler onboarding, faster entry, better long-history performance, clearer reports, additional languages, and stronger accessibility based on actual feedback.

## 3. Website structure

```text
Public
  Home / product explanation (small launch page)
  Sign in / Sign up / Account recovery
  Privacy information / Help

Private application
  Setup
  Overview
  Transactions
    Add transaction
    Transaction details / Edit
  Budgets
  Reports
  Settings
    Profile / Currency and timezone / Categories / Payment methods
    Export / Account and data controls
```

Keep categories inside Settings to reduce navigation clutter. Users can also create a category from the transaction form and return to their entry.

No admin dashboard, subscription pricing, social feed, or marketing blog is needed for the first release.

## 4. Screen design plan

| Screen | Primary job | Content and controls |
|---|---|---|
| Launch page | Explain the product | Short value statement, illustrative app preview, sign-up and sign-in links |
| Setup | Prepare a useful workspace | Currency, timezone, editable starter categories, optional monthly budget, first-entry prompt |
| Overview | Understand this month | Period selector, income/expenses/net summary, budget strip, category bars, recent transactions, Add expense |
| Transactions | Find and manage entries | Search, filters, result count, sortable list/table, export, add action |
| Transaction form | Record or correct an entry | Expense/income choice, prominent amount, category, date, expandable optional details, Save |
| Budgets | Set and review spending limits | Month selector, overall cap, category caps, spent/remaining values, text warnings |
| Reports | Explain spending patterns | Date range, category bars, trend chart, prior-period comparison, equivalent data table |
| Settings | Manage preferences | Small grouped sections; separate data deletion from everyday preferences |

### Desktop overview wireframe

```text
+----------------+------------------------------------------------+
| Expense Tracker| October 2026       [Month v]    [+ Add expense] |
|                |                                                |
| Overview       | Income          Expenses         Income - spend |
| Transactions   | GBP 3,000       GBP 1,240        GBP 1,760       |
| Budgets        |                                                |
| Reports        | Monthly budget                                  |
|                | [==========              ] GBP 760 remaining    |
| Settings       | GBP 1,240 spent of GBP 2,000                     |
|                |                                                |
|                | Spending by category     Spending over time     |
|                | Groceries  =======       [simple trend chart]   |
|                | Transport  ====                                 |
|                |                                                |
|                | Recent transactions                [View all]   |
|                | Date | Merchant | Category | Amount             |
+----------------+------------------------------------------------+
```

### Mobile overview wireframe

```text
+----------------------------------+
| Overview             October [v]  |
| Expenses this month               |
| GBP 1,240                         |
| Income 3,000 | Income-spend 1,760  |
|                                  |
| Monthly budget                    |
| [==========          ]            |
| GBP 760 remaining of GBP 2,000    |
|                                  |
| Spending by category              |
| Groceries    =======  GBP 320     |
| Transport    ====     GBP 180     |
|                                  |
| Recent transactions               |
| Grocery shop              -32.40  |
| Groceries · Today                 |
|                                  |
|          [+ Add expense]          |
| Overview | History | Budget | More|
+----------------------------------+
```

All figures above are sample data. The same period and calculation rules apply on both layouts.

### Responsive behavior

- Phone: one column, compact summary, transaction rows with amount aligned right, full-screen entry form. Reports and Settings appear under More.
- Tablet: two-column content where readable; navigation can collapse.
- Desktop: fixed-width sidebar, restrained content width, full transaction table, side drawer for add/edit.
- Keep Add expense easy to reach without covering content or focused fields. Filters open in a sheet on phones.
- Preserve search, filters, and scroll position when a user views a record and returns.

## 5. Visual direction

Working identity: a practical personal ledger with a distinctive monthly budget ruler.

- Cool off-white canvas, white content surfaces, deep blue text, cobalt actions, teal positive status, and red warning/error status.
- Manrope for headings; Source Sans 3 for body and interface text; tabular numerals for aligned amounts.
- Use mostly flat surfaces, subtle dividers, moderate corner rounding, and generous spacing around entry fields.
- Make the budget ruler the visual signature: a horizontal spending measure with a clear limit marker and explicit remaining/over-budget text.
- Use category bars before decorative charts: label both category and amount directly.
- Reserve bright color for actions and meaningful data. Avoid decorative gradients, excessive cards, and gamified spending scores.
- Light theme first. Detailed proposed tokens and component direction live in [DESIGN.md](DESIGN.md).

## 6. Main user journeys

### First visit

Sign up → choose currency/timezone → review categories → optionally set budget → add first expense → see the overview update. Budget setup can be skipped. Never force sample transactions into real totals.

### Daily expense entry

Add expense → enter amount → choose category → confirm date → optionally add merchant/details → Save expense → close form and update the current screen. Show “Expense added.” Keep optional fields out of the initial task path.

Target for usability testing: a returning user can add a basic expense in under 15 seconds. This is a proposed success target, not a measured result.

### Monthly review

Open Overview → select month → inspect budget and category spending → select a category → open Transactions with that month/category applied → correct an entry if needed → return with context preserved.

### Setting a budget

Open Budgets → choose month → enter an overall cap and/or category caps → Save budget → show spending against each cap. Offer explicit “Copy last month” later; do not silently repeat budgets.

### Correcting a record

Open transaction → Edit → Save changes → refresh relevant summaries. Delete requires confirmation naming the transaction; keep the dialog open if deletion fails. Archived categories remain visible on historical records.

## 7. Calculation and data rules

These are proposed product rules to settle before implementation, not verified existing behavior.

- Store amounts using exact decimal or integer minor units with currency-aware precision. Avoid floating-point arithmetic for money.
- Store transaction type separately from a positive entered amount. Income and expense totals use explicit types.
- Support an expense refund/correction linked to an expense; do not count it as new income. Attribute the refund to its recorded date and the original category.
- Net expenses = posted expenses minus expense refunds in the selected period.
- Income minus expenses = recorded income minus net expenses. Label it as a period result; it is not a bank balance or proof of savings.
- Remaining monthly budget = overall cap minus net expenses. Show a negative result as “Over budget by …”. Without an overall cap, show “Set a monthly budget”; do not invent a remaining amount.
- Category caps are independent controls. Their sum is not added to the overall cap. Explain whether the category sum is below or above the overall cap.
- Category refund totals may be negative if a prior-month purchase is refunded this month. Explain this rather than silently clamping values.
- All reports use the same transaction-date boundaries and calculation service. Audit timestamps are separate from transaction dates.
- Exclude future-dated entries from this first release. Scheduled future bills belong to the later recurring-bills feature.
- Never label a payment method as an account balance. Card and bank-transfer labels are descriptive in the first release.
- Archive categories/payment labels that have history; do not delete or orphan associated transactions.
- Charts compare equivalent elapsed periods when the selected month is incomplete; show the compared dates. Suppress percentage change when the baseline is zero.
- Export amounts, currency code, transaction type, date, category, merchant, payment method, and note; protect spreadsheet users from formula injection in text cells.

Suggested data entities: User, WorkspacePreferences, Category, PaymentMethod, Transaction, MonthlyBudget, and CategoryBudget. Each private record needs an owner. Transactions include ID, owner, type, exact amount, currency, transaction date, category reference, optional refund reference, merchant, payment method, note, created/updated timestamps, and a version for conflict detection.

## 8. Interaction, privacy, and reliability requirements

- Every screen needs loading, first-use empty, no-results, error/retry, and populated designs where applicable.
- On save failure, preserve all entered values and show a useful correction or retry action. Prevent duplicate saves and make retries safe.
- Keep sensitive search text out of URLs and telemetry by default; safe period/category/sort/page state can use URL parameters.
- Require authenticated, server-enforced ownership checks on reads, writes, exports, and files. Test with two users.
- Use managed authentication where practical, secure sessions, transport protection, and backups. Do not place transaction details in analytics, logs, or notification previews by default.
- Provide a documented export, deletion, retention, and backup-expiry policy before public launch. Jurisdiction and retention periods remain open decisions; do not invent legal promises.
- Do not promise offline saving until durable synchronization exists. Show connection status and keep unsaved input available in the active form.
- Target WCAG 2.2 AA: keyboard operation, visible/unobscured focus, labeled fields, sufficient contrast, text equivalents for charts, and errors expressed in text. Use 44px controls as the product touch-target goal. [W3C guidance](https://www.w3.org/WAI/standards-guidelines/wcag/new-in-22/).
- Shared behavior rules and recovery details live in [UX-CONTRACT.md](UX-CONTRACT.md).

## 9. Design and implementation sequence

| Phase | Work | Reviewable deliverable / completion gate |
|---|---|---|
| 1. Confirm product scope | Validate personal-use assumption, currency model, primary users, and entry fields | Agreed first-release checklist and explicit deferred features |
| 2. Map journeys | Work through setup, add/edit/refund/delete, budget, and report journeys | Complete flows including failure and empty states |
| 3. Wireframe | Overview, Transactions, entry form, Budgets, Reports, Settings | Desktop and phone wireframes with realistic example content |
| 4. Establish design system | Refine tokens, type, navigation, controls, forms, tables, overlays, charts | Shared component/state sheet and updated DESIGN.md |
| 5. Prototype and test | Link the core journeys; observe representative users performing tasks | Findings, revised prototype, and resolved usability blockers |
| 6. Build a complete vertical slice | Auth/setup → add expense → persistent history → overview | Real private records survive reload; correct totals and useful failure recovery |
| 7. Complete first-release scope | Income/refunds, categories, budgets, reports, filters, export, settings | All must-have acceptance criteria pass |
| 8. Prepare launch | Accessibility, security, responsive QA, backup restore, privacy controls | Release checklist and known limitations reviewed |
| 9. Improve from evidence | Measure entry friction, reporting use, errors, and requested features | Prioritized follow-up releases rather than adding every future feature |

Implementation shape: browser frontend, authenticated server/API, relational database, shared validation/calculations, and backup/monitoring. Add private file storage only when attachments are introduced. Choose the framework, hosting, authentication provider, and database after budget, hosting preferences, and team familiarity are known; no provider or package versions are locked by this design plan.

Estimate effort after the scope and wireframes are settled. Bank connections, shared workspaces, and offline sync require separate estimates.

## 10. Release acceptance checklist

- A new user can sign in, complete or skip optional setup, add an expense, and see it after reload.
- Expense/income/refund create, edit, and delete produce matching history, overview, budget, and report values.
- A sample ledger with income 3,000, expenses 1,300, refunds 60, and overall cap 2,000 shows income 3,000, net expenses 1,240, period result 1,760, and budget remaining 760.
- Month-end, leap-day, timezone, zero-baseline comparison, archived category, and currency-precision cases behave predictably.
- Search/filters return correct results; export contents match the explicitly selected scope.
- Slow requests, failed saves, repeat clicks/retries, expired sessions, and edit conflicts do not silently lose or duplicate records.
- One user cannot retrieve, modify, export, or infer another user's private records.
- All core journeys work by keyboard and at a 360px phone width, tablet width, desktop width, and 200% zoom; test long merchant names and large amounts.
- Charts have equivalent readable data. Budget warnings do not depend on color alone.
- Backup restoration and account/data deletion procedures are documented and verified before public launch.

## 11. Success measures and remaining choices

Proposed measures: time to first expense, time to add a returning-user expense, successful-save rate, weekly active use, budget adoption, and whether users can explain their highest spending category. Define event collection with minimal metadata and no transaction content.

Choices to confirm before building: personal versus business audience, single-user versus household needs, initial target market/currency, visual preferences, hosting budget, and deletion/retention policy. The current plan uses the assumptions in section 1 so design can move forward without prematurely expanding scope.

Next design deliverable: a clickable desktop/mobile prototype of Overview → Add expense → Transactions, followed by Budgets and Reports.
