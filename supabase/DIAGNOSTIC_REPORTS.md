# HC2 diagnostic report delivery

The app stores every checked attempt in the local SQLite database. GitHub credentials are used only by the Supabase Edge Function; no GitHub token is shipped in the Android app.

## Supabase function

Deploy from the HC2 repository root:

```bash
supabase link --project-ref YOUR_SUPABASE_PROJECT_REF
supabase secrets set GITHUB_TOKEN=YOUR_FINE_GRAINED_GITHUB_TOKEN
supabase secrets set GITHUB_REPOSITORY=OWNER/REPOSITORY
supabase secrets set GITHUB_BRANCH=main
supabase secrets set GITHUB_REPORTS_PATH=diagnostic-reports
supabase functions deploy diagnostic-reports
```

The GitHub token should be a fine-grained token limited to the destination repository with **Contents: Read and write** permission. Keep it only in Supabase secrets. The destination repository, branch, and report folder are configurable and are intentionally not hard-coded in the app.

The Supabase project URL and anon key must already be available to the Expo app as `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY` (the same public settings used by the existing Supabase template).

## Delivery behavior

- Each checked attempt is saved locally first.
- At the end of an app session, the app uploads a batch when at least 5 pending attempts are available.
- At 20 pending attempts of the current algorithm version, the app forces an upload without waiting for session end.
- Old algorithm-version records are sent separately and are eligible immediately after the app starts with a newer algorithm version.
- The manual upload control drains all pending algorithm-version groups.
- Offline or failed uploads remain pending in SQLite and are retried when connectivity returns.
- Each batch is homogeneous by algorithm version. Its deterministic SHA-256 ID maps to one immutable `batch_<id>.json` file, so retries do not create duplicate reports.
- Local retention remains capped at the latest 60 attempts per character.

## GitHub report

Each JSON report contains the app name, schema version, batch ID, algorithm version, export timestamp, record count, and the full diagnostic entries.
