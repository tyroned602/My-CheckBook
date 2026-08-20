# Checkbook prototype

This is a browser prototype of the core iOS-first product loop: capture a natural-language transaction, parse it locally, confirm it quickly, save it to a local ledger, and see balances update. Data is persisted in `localStorage`; use Safari/Chrome for browser speech recognition.

## Product definition

The MVP is intentionally narrow: accounts and opening balances, income/expenses, transfers as a separate transaction type, personal/business context, transaction history, daily totals, reconciliation checkpoints, local persistence, and CSV export as the next small slice. The daily review is the organizing principle; reporting, bank sync, forecasting, subscriptions, and accounting integrations are later.

Core journeys: (1) speak → parse → confirm → save, (2) inspect account running balances, (3) filter personal/reselling/detailing, (4) reconcile an account against its real-world balance, and (5) close a day after reviewing uncertain entries.

## Recommended architecture

For the real product, use native SwiftUI + Observation on iPhone. It gives the best access to Speech framework, AVAudioSession, App Intents/Siri, Face ID, CloudKit, background tasks, and accessibility with the smallest platform surface. A cross-platform UI can come later if iPad/Android demand justifies the tradeoff.

Use SwiftData for the initial local store, with a migration path to SQLite/GRDB if sync conflict handling or larger ledgers demand it. Store money as integer minor units (`Int64` cents), never floating point. Model an immutable `JournalEntry` with one or more `Posting`s: each posting changes one account; transfers and credit-card payments are balanced entries, not expenses. A `TransactionClassification` carries context, business, category, merchant, and confidence without changing account postings. Keep reconciliation checkpoints as append-only records.

Voice should be layered: on-device Speech framework transcription first; deterministic extraction and user rules second; only ambiguous multi-transaction or low-confidence language goes to a structured-output server model. Cache aliases/rules locally and never send ledger data by default. Protect the app with LocalAuthentication and encrypted device backup/CloudKit private database; provide an explicit encrypted export and plain CSV business export.

Testing should include property-based ledger invariants (transfers net to zero, editing is reversible, no floating-point drift), parser fixtures for natural speech, SwiftData migration tests, reconciliation tests, and UI tests for the three-second capture loop.

## Important next implementation slices

1. Replace the prototype parser with a typed ledger engine supporting balanced postings, splits, transfer detection, and edit/delete.
2. Add account setup and a true daily inbox with confidence flags.
3. Add CSV export filtered by business/date range.
4. Port the proven interaction to SwiftUI and add Speech framework + Face ID.
