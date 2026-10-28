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

Deduplicate within PDFs and at save time. Match manual purchases to statement
entries. Show import dates, totals, exclusions, and receipts. Add statement
balance checks. Implement paired transfers, integer-cent money storage, and
amount parsing that handles commas.

## Stage 3: Entry forms and reconciliation

Replace pop-up prompts with accessible forms. Allow account/date/category edits
before saving. Recheck balances when confirming adjustments and record daily
review completion. Validate backups fully and make deletion recoverable. Escape
all user/imported display text. Remove or implement the inactive lock button.

## Stage 4: Category controls

Separate merchant defaults from individual overrides, expose editable rules,
and provide consistent subcategory choices. Separate income, refunds, cashback.

## Stage 5: Navigation and reports

Home, Transactions, Reports, Settings; search and date sorting; stable category
colors; offline and update controls; narrow-screen and Safari home-screen QA.

Ship and verify each stage separately. Keep financial data out of GitHub.

## Original roadmap (reference)

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
