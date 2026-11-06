---
version: alpha
name: Expense Tracker
description: A personal spending ledger with a clear monthly budget ruler.
colors:
  primary: "#2457D6"
  background: "#F3F6FA"
  surface: "#FFFFFF"
  text: "#172B4D"
  muted: "#52627A"
  border: "#CDD6E3"
  success: "#087F75"
  danger: "#B42336"
  primary-hover: "#1948B8"
  primary-soft: "#EDF2FF"
  success-soft: "#E5F3EE"
  danger-soft: "#FFF1F2"
  story: "#EDF2FA"
  on-primary: "#FFFFFF"
  scrollbar-thumb: "#9AAAC1"
typography:
  display:
    fontFamily: "Manrope, system-ui, sans-serif"
  sans:
    fontFamily: "Source Sans 3, system-ui, sans-serif"
  mono:
    fontFamily: "ui-monospace, monospace"
rounded:
  DEFAULT: "0.5rem"
  lg: "0.75rem"
spacing:
  control-gap: "0.5rem"
  field-gap: "1rem"
  section-gap: "1.5rem"
  page-max: "80rem"
components:
  button:
    height: "3rem"
  input:
    height: "3rem"
  card:
    rounded: "0.75rem"
---

# Expense Tracker Design System

## Overview

Design direction seeded on 28 October 2026; authentication screens implemented on 4 November 2026; expense ledger implemented on 5 November 2026. Income, budget, and reporting screens remain planned. User preferences may revise the proposal.

The reference is the useful order of a personal ledger: aligned figures, clear dates, concise categories, and enough space to correct an entry comfortably. The audience is an individual recording daily spending on a phone and reviewing a month on a larger screen. This is a product interface; the public launch page uses the same identity with lower information density.

English initially; choose currency/timezone during setup. No target market is established by the user's device timezone. Retain system font fallbacks and support long labels and future locale expansion.

The memorable element is a monthly budget ruler with a limit marker and explicit remaining/over-budget text. Forms, navigation, and history remain familiar and restrained. Avoid trading-screen density, banking balance claims, oversized promotional statistics, and reward mechanics that encourage spending.

Runtime ownership: `src/styles.css` is the canonical semantic theme; this document mirrors its accepted values and explains their role. Shared components consume CSS custom properties, never screen-local palette copies. Font files are served locally through `@fontsource` imports in `src/main.tsx`.

| Document tokens | Runtime mapping | Consumers |
|---|---|---|
| `colors.*` | `--color-*` (scrollbar thumb: `--scrollbar-thumb`) | All component styles |
| `typography.display/sans/mono` | `--font-display/body/mono` | Headings, labels, body copy |
| `rounded.DEFAULT/lg` | `--radius-default/lg` | Fields, buttons, panels |
| `spacing.control-gap/field-gap/section-gap/page-max` | `--space-control/field/section`, `--page-max` | Shared layout vocabulary |
| `components.button/input/card` | `.primary-button`, `.input-wrap`, `.welcome-card` | Auth and workspace |

Scrollbar track/hover/active reuse story/muted/primary. Hairline/translucent effects on illustrations are decorative; text and actionable controls use the semantic palette. Token changes update this document and the theme together and run `tests/design.test.ts`.

## Colors

Use background for the canvas, surface for content, text for primary information, muted for secondary labels, and border for separators. Primary identifies interactive actions and focus. Success and danger communicate status with accompanying text/icons. Validate contrast in actual component combinations; a palette alone does not establish accessibility.

Light theme is the first-release proposal. Category charts can use primary/teal shades with direct labels and distinct marks. An expanded categorical palette must be tested before use. Dark theme is deferred until its full state matrix is designed.

## Typography

Manrope: page titles and the restrained primary monthly figure. Source Sans 3: navigation, forms, lists, and explanatory text. Use tabular numerals for amounts; mono is reserved for reference IDs or utility data, not all currency values.

Proposed scale: 32px main figure, 24px page title, 18px section title, 16px body/control text, 14px secondary data. Body line height 1.5. Right-align numeric table columns and keep currency visible through labels or headers. Avoid truncating amounts.

## Layout

Use an 8px rhythm for field grouping and ledger rows; 24px between sections. Desktop sidebar: 224px. Content padding: 32px desktop, 24px tablet, 16px phone. Content maximum: 1280px. Content-led breakpoints: below 768px phone layout, 768–1023px tablet, 1024px and above desktop; verify rather than relying on widths alone.

Desktop uses a sidebar and readable table. Phone uses a single column, compact transaction rows, bottom navigation, and full-screen forms. Keep sticky controls clear of content, focus, and virtual keyboards. Reserve chart and loader geometry to avoid layout jumps. Provide visible, usable global scrollbars and respect forced-color settings.

## Elevation & Depth

Static content is flat with subtle borders. Reserve shadows for drawers, menus, and modal layers. Use one shared layer scale at implementation; popovers inside a dialog must appear above that dialog.

## Shapes

Controls use 8px radii, content surfaces 12px. Avoid making every number a separate card. Use consistent restrained line icons; give icon-only actions accessible labels and adequate target sizes.

## Components

- Buttons: explicit verbs; stable size when busy; visible focus; minimum 44px intended control height.
- Amount input: prominent, labeled, currency-aware; full numeric value remains visible.
- Transaction form: required amount/category/date first, optional details below; errors next to fields.
- Transactions: dates, merchant, category, and signed display amount; type is also readable without color.
- Budget ruler: spent, cap, and remaining/over text. If spending exceeds the cap, retain a bounded readable graphic and state the excess exactly.
- Category bars: direct labels and values, keyboard-accessible detail links, equivalent table data.
- Dialogs/drawers: clear title, focus management, close/cancel action, dirty-form protection.
- Loaders and feedback: use an unobtrusive app spinner with text, persistent error guidance, and nonblocking success status.
- Motion: short functional transitions only; respect reduced motion. No animated amount changes that obscure the saved value.
- Copy: sentence case, precise labels, and neutral language. Say “Income minus expenses” rather than “Account balance.”

### Expense ledger

`src/styles.css` extends the established theme without changing its palette/type tokens. The ledger uses a restrained single-page layout while there is only one financial workflow; adding an empty sidebar would create unused navigation. History is the main surface, with direct totals, subtle category tags, and aligned amount columns. The total always names its filter scope. No fake monthly balance or budget appears.

`SelectField.tsx` uses native selects and `Field.tsx` uses native date controls. Their closed triggers match shared field styles; the platform owns open popup appearance and keyboard interaction. `Dialog.tsx` supplies owned modal content with a desktop right-side entry drawer and full-screen phone variant. `ExpenseHistory.tsx` presents a semantic table on desktop and rearranges the same cells into rows on phones without removing actions or amounts. Long descriptions and notes wrap; amounts are never truncated.

`StatusMessage.tsx` uses existing semantic success/danger colors for inline feedback. `WorkspaceSetup.tsx` reuses controls and typography from authentication. All actual data is private user-entered data; sample content remains confined to the labeled authentication illustration.

## Do's and Don'ts

- Keep Add expense prominent across screens and consistent in wording.
- Explain budget limits and reporting periods next to the relevant values.
- Use sample content only in design/prototype contexts; identify it clearly.
- Do not display a fake remaining budget when none is set.
- Do not encode expense/refund/income distinctions using color alone.
- Do not spread one entry form across several unnecessary steps.
- Keep destructive data controls separate from ordinary preferences.


### Income, refunds and category maintenance

Shared entry forms, histories and delete dialogs own expense, income and refund flows. Text labels distinguish the entry kinds. A wrapping navigation row provides working destinations; Manage categories opens a native modal with versioned rename/archive/restore controls. Archived labels remain in history and filters. Refund forms name the original purchase and remaining refundable amount. Existing CSS tokens own all styling; platform date/select popups remain native.


### Monthly overview

`MonthlyOverview.tsx` owns a four-column definition list, a distinct income-minus-spending panel and an equivalent category table. It uses the shared semantic theme, native month input, and two-column metric reflow on phones. Category tables scroll inside their own container. No bank-balance claim or fabricated budget appears.


### Budgets

`Budgets.tsx` uses a single overall budget ruler followed by category rows. Progress is bounded from zero to 100% with exact remaining/over text. Zero caps remain distinct from absent limits. Each month and scope can be set, edited or removed in a native dialog, using shared inputs, dirty guards and confirmation. Archived categories with budgets or spending remain visible.


### Reports and data downloads

`Reports.tsx` owns native month selection, a daily report table with exact monthly totals and a CSV download action. `ExpenseHistory.tsx` exports every matching row across pages. Table regions are named/focusable for horizontal keyboard scrolling, with visible instructions. Export progress/errors/success use the shared status language. Budgets initially show overall, configured and used categories; Show all categories reveals remaining choices.
