# World of Life - Admin Runbook

Last updated: 2026-04-19 (UTC)

This file documents active admin commands and when to use them.
Command parsing source: `src/AdminCommands.js`.

## 1) Quick Entry

- `/admin`
  - Prints grouped admin help in chat.

## 2) Economy and User Profile

- `/users`
  - List users summary.

- `/grant <userId> <amount>`
  - Add money.

- `/setmoney <userId> <amount>`
  - Set money to exact value.

- `/givegem <userId> <amount>`
  - Add gems.

- `/setgem <userId> <amount>`
  - Set gems to exact value.

- `/wipe <userId>`
  - Full profile reset for user (used for onboarding retests).

## 3) Indexes and Patches

- `/labour_reindex`
  - Rebuild labour free index.
  - Also patches min energy floor for indexed players where needed by current logic.

- `/admin_rebuild_ratings`
  - Rebuild rating indexes.

- `/admin_backfill_activity_today`
  - Mark useful activity today (backfill utility).

- `/admin_backfill_activity_today weekly_farm_patch`
  - Inject missing weekly farm quest into current week where applicable.

## 4) Analytics

- `/admin_referrals`
  - Referral and source stats (including start payload tracking).

- `/admin_referrals <userId>`
  - Detailed referral info for one user.

- `/admin_retention`
  - Cohort retention for last 30 days (D1/D3/D7 + cohorts).

- `/admin_funnel`
  - Onboarding/feature funnel style all-time summary.

- `/admin_new_users [limit]`
  - Newest users list (default 50, bounded in code).

- `/admin_quiz`
  - Quiz engagement stats (selection/played/perfect totals).

- `/admin_levels`
  - Player levels snapshot: avg/median/P90/max, activity 7d/30d, buckets, top-15 by level.
  - Excludes admins by default.

- `/admin_levels all`
  - Same report including admins.

## 5) Channel Posting

- Required env var: `CHANNEL_ID` (numeric `-100...`). Resolve via `/admin_channel_check`.
- `/admin_channel_preview`
  - Generate preview post (yesterday snapshot) to admin chat.

- `/admin_channel_publish`
  - Publish yesterday snapshot with duplicate guards.

- `/admin_channel_force`
  - Force publish now (bypass standard safeguards).

- `/admin_channel_check [chat]`
  - Validate bot rights and resolve channel id.
  - Example: `/admin_channel_check @WorldOfLifeGame`

## 5.1) Deep Links / Bot Username

- Required env var: `BOT_USERNAME` (without `@`).
  - Used to build links like `t.me/<bot>?start=ads_...` and referral links.

## 6) Broadcast Tools

- `/broadcast`
  - Start compose draft mode.

- `/broadcast_test`
  - Send draft to admin only.

- `/broadcast_send`
  - Send draft to all users.

- `/broadcast_status`
  - Show current run and recent history.

- `/broadcast_cancel`
  - Clear draft/compose state.

## 7) Media Utility

- `/fileid`
  - Send a photo or GIF(animation) with caption `/fileid` to extract Telegram file_id.
  - Used to update in-game media assets quickly.

## 8) Operational Notes

- Most reports are UTC-based.
- Some stats are event-driven; if a metric looks stale, verify event hook exists.
- Use preview/check commands before any force publish to channel.
- Prefer existing patch/reindex commands over manual KV edits.

## 9) Unicode Safety

Known repo risk:
- UTF-8 / Cyrillic text can be corrupted by shell-based rewrites on Windows PowerShell.

Do:
- edit text-heavy files in an editor/IDE with UTF-8;
- prefer patch-based edits for small code/doc changes;
- verify bytes before "fixing" apparently garbled text.

Do not:
- run `Get-Content ... | Set-Content ...` on source files;
- mass-rewrite `src/i18n/*.js`, `src/UiFactory.js`, `src/worker.js`, or docs through PowerShell strings;
- trust terminal mojibake as proof that file bytes are broken.

Recovery note:
- if Unicode corruption is suspected, restore file contents from git as raw bytes/blob data, then re-apply intended changes safely.
