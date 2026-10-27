# Current development plan

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
