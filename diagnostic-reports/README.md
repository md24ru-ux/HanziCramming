# HC2 diagnostic reports

This folder stores diagnostic JSON batches uploaded by Hanzi Cramming 2 through the Supabase Edge Function `diagnostic-reports`.

Each `batch_<id>.json` file contains attempts from exactly one diagnostic algorithm version. Files are immutable; retries reuse the same batch ID and do not create duplicate reports.
