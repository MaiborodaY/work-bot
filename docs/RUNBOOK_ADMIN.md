# World of Life - Admin Runbook

Last updated: 2026-04-11 (UTC)

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

## 5) Channel Posting

- `/admin_channel_preview`
  - Generate preview post (yesterday snapshot) to admin chat.

- `/admin_channel_publish`
  - Publish yesterday snapshot with duplicate guards.

- `/admin_channel_force`
  - Force publish now (bypass standard safeguards).

- `/admin_channel_check [chat]`
  - Validate bot rights and resolve channel id.
  - Example: `/admin_channel_check @WorldOfLifeGame`

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

