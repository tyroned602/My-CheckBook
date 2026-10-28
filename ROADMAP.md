# Checkbook improvement plan

## Stage 1: Safe sync (published; live device verification pending)

Revision-checked database writes; device/cloud choice on differing ledgers;
five recovery copies on the device; persistent sync feedback; serialized saves.
Test conflict handling, connection failure, and edits during a pending upload.
Verify real phone/desktop operation after deployment. Recovery exports contain
multiple ledger copies; they are not regular single-ledger restore files.

## Stage 2: Imports and accounting

First checkpoint implemented: duplicate-ID checks within a PDF and at save,
manual-entry matching by account/merchant/amount/date, explicit link-or-add
choices, recovery before import, and a persistent completion receipt.
Run `node tests/imports.test.cjs` from the project directory.

Second checkpoint implemented: linked two-account transfers, reversal of both
entries on removal, transfer exclusion from daily income/spending, and comma-aware
capture/transfer amount parsing. Transfer arithmetic uses cents; a full migration
of older entry/edit paths to integer-cent storage remains. Run
`node tests/transfers.test.cjs`. Legacy unpaired transfers require review.

Deduplicate within PDFs and at save time. Match manual purchases to statement
entries. Show import dates, totals, exclusions, and receipts. Add statement
balance checks. Implement paired transfers, integer-cent money storage, and
amount parsing that handles commas.

## Stage 3: Entry forms and reconciliation

First checkpoint implemented: accessible transaction/account dialogs, cash forms,
editable parsed-entry details, dated entries and comma-aware form amounts. Account
balance changes route through reconciliation. Balance confirmations recheck the
account signature, and daily completion requires fresh checks of every account.
Completed reviews persist in cloud data and regular backups. The inactive lock
button was removed. Run `node tests/forms.test.cjs`.
Second checkpoint implemented: validated backup restores with an account/balance
preview and recovery before replacement; recoverable transaction and paired-transfer
deletion; removal/restore of empty accounts; removed PayPal ID tracking to prevent
repeat imports resurrecting deleted entries; recovery-file selection. Accounts
with history are protected from removal pending an archive workflow. Run
`node tests/safety.test.cjs`. Broader mobile verification remains.

Replace pop-up prompts with accessible forms. Allow account/date/category edits
before saving. Recheck balances when confirming adjustments and record daily
review completion. Validate backups fully and make deletion recoverable. Escape
all user/imported display text. Remove or implement the inactive lock button.

## Stage 4: Category controls

Published checkpoint: editable/pausable merchant defaults with aliases, categories,
contexts, and Water subcategory; per-transaction overrides win over defaults;
transaction forms can return an entry to its merchant default. Defaults sync in
ledger data and are validated in backups. Run `node tests/rules.test.cjs`.

Separate merchant defaults from individual overrides, expose editable rules,
and provide consistent subcategory choices. Separate income, refunds, cashback.

## Stage 5: Navigation and reports

First polish checkpoint: Home/Transactions/Reports/Settings screens, persistent
navigation and sync shortcut, merchant/category/note search, account/context/date
filters, newest-date-first history, consistent category colors, improved legend
and action layout, offline/local-file status, and an update control that guards
unfinished entries. Run `node tests/navigation.test.cjs`.

Home, Transactions, Reports, Settings; search and date sorting; stable category
colors; offline and update controls; narrow-screen and Safari home-screen QA.

Ship and verify each stage separately. Keep financial data out of GitHub.

## Original roadmap (reference)

## Square and income checkpoint

Square all-activity CSV preview/import supports completed Sales and Card spend,
validates running balances, preserves original source labels, detects repeat rows
using date/details/amount/balance/type, and offers manual-entry matching. A new
Square account is created only on confirmed import with a verified zero opening.
Unsupported activity stops the import for review. No gross-sales or fee amounts
are inferred. User confirmed the initial Square sale is detailing income.

Reports combine all accounts with an Account/card vs Cash filter. Income &
deposits distinguishes earned income, refunds, cashback, transfers, and review.
Forms record Detailing/eBay/Facebook/Mercari sources and Cash/Square/Deposit
methods. Tests: `node tests/square.test.cjs` and `node tests/income.test.cjs`.

## Now

1. Make PayPal Business and Cash the primary account workflow.
2. Import PayPal transaction-history PDFs into a review inbox.
3. Keep only final posted debit-card transactions, cashback, and unusual nonzero PayPal adjustments.
4. Filter authorizations, holds, reversals, denied/voided items, and previously imported transaction IDs.
5. Require confirmation before imported transactions affect balances.

## Next

1. Add statement date-range and opening/closing-balance checks.
2. Improve merchant normalization and learned categories.
3. Add transfers between PayPal Business, checking, and cash.
4. Finish and verify Supabase device sync.
5. Replace floating-point balances with integer cents and a balanced-posting ledger.

## Later

CSV export, split transactions, reconciliation checkpoints, encrypted backups, and the native SwiftUI application.
