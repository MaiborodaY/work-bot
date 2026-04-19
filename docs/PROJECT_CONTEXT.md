# World of Life - Project Context (Agent Memory)

Last updated: 2026-04-19 (UTC)

This document is a compact source of truth for engineering context.
Read this before implementing new features or hotfixes.

## 0) Collaboration Rule (Very Important)

- Do not change gameplay/UI/logic in the repo unless the user explicitly commands it (for example: "делай", "начинай кодить", "комит и пуш").
- When the user asks a question or requests validation/ideas, propose options first and wait for an explicit "go" before editing code.

## 1) Runtime and Storage

- Platform: Cloudflare Workers.
- Primary storage: Cloudflare KV (user profiles + indexes + snapshots).
- No D1/SQL in production flow right now.
- Most daily/weekly logic is UTC-based.
- Cron: `*/5 * * * *` (see `wrangler.jsonc`). Time-sensitive mechanics are not real-time; expect up to ~5 minutes delay.
- Manual cron runner: `GET /cron-run` (worker route) for emergency runs/testing.

Key files:
- `src/worker.js` - entrypoint, routing, cron.
- `src/UserStore.js` - user normalization and persistence.
- `src/GameConfig.js` - gameplay constants and balancing.
- `src/Locations.js` - navigation/location rendering orchestration.
- `src/QuestService.js` - daily/weekly/special quests.
- `src/AdminCommands.js` - all admin tooling.

## 2) Core Product Rules (Current)

- Languages: `ru`, `uk`, `en`.
- UI strings should go through i18n layers, not hardcoded in handlers.
- Default language for unknown/unsupported Telegram locale is English.
- Arcana Hall is hidden/blocked before study level 5.
- Gym training currently gives `+5` max energy per completed training.
- Labour contracts are fixed-term and settled at contract end.
- Colosseum:
  - unlocked from `effective max energy >= 50`,
  - daily battle limit per player: `30`,
  - each win gives `+1 gem`,
  - weekly ranking and weekly rewards enabled,
  - player XP must use all-time Colosseum counters, not weekly `weekWins`.
- Player level / progression:
  - cosmetic/progression-only for now (no gameplay bonuses),
  - max level: `50`,
  - shown in own profile and public profile,
  - rewards are claim-based and only for levels reached after release,
  - old players get retroactive level, but no retroactive gem payouts.
- Farm:
  - separate economy loop,
  - net profit metrics are used in top/channels (seed cost is included).
- Theft defense:
  - business defense is now a 3-round battle,
  - base reaction window is `10 minutes`,
  - guard extends reaction window, but does not reduce success chance,
  - successful owner defense gives `+1 gem`.
- Persistent reply keyboard:
  - bottom nav uses reply keyboard, not inline buttons,
  - current buttons: `Площадь`, `Город`, `Заработок`, `Бар`, `Профиль`,
  - `/start` restores it, and hub routes also restore it once if missing.

Source of truth for balance/limits: `src/GameConfig.js` (avoid duplicating numbers in code and texts).

## 3) Encoding and Text Safety

Known historical risk: Cyrillic corruption ("кракозябры").

Rules:
- Keep source files UTF-8.
- Avoid bulk rewrites for text-heavy files unless required.
- Prefer editing text in i18n dictionaries and config keys.
- If output/terminal looks garbled, verify file bytes before replacing text.

## 4) Event-Driven Counters (Important)

A lot of UX depends on event hooks.
When adding/changing mechanics, verify both:
- counter updates (`QuestService.onEvent` / stats counters),
- user notifications (push/quest completion events).

Typical event hotspots:
- work/gym/biz/stock/thief/labour/farm/colosseum handlers.
- delayed/cron outcomes (contract end, theft resolve, weekly payouts).

Quest UX note:
- Quest completion push messages are sent only from `QuestService.onEvent(..., { notify: true })`.
- "Lazy" completion when opening a screen (cycle ensure / render-only) can update progress, but will not send a push.

## 5) Gameplay Surfaces in Code

- Jobs/Work: `src/JobService.js`, `src/handlers/work.js`
- Study/Gym/Energy: `src/StudyService.js`, `src/GymService.js`, `src/EnergyService.js`
- Business: `src/BusinessPayout.js`, `src/handlers/business.js`
- Labour market: `src/LabourService.js`
- Clans: `src/ClanService.js`
- Stocks: `src/StockService.js`
- Theft: `src/ThiefService.js`
- Colosseum: `src/ColosseumService.js`, `src/ColosseumRules.js`
- Farm: `src/FarmService.js`
- Pet: `src/PetService.js`
- Quizzes: `src/QuizService.js`, `src/GeneralQuizService.js`
- Ratings: `src/RatingService.js`
- Channel posts: `src/ChannelService.js`

## 6) Runtime Secrets / Variables

Cloudflare Workers env vars used by gameplay/ops:
- `BOT_USERNAME` - used to build deep links like `t.me/<bot>?start=...`.
- `CHANNEL_ID` - numeric `-100...` channel id for scheduled posts.

## 7) Current Analytics / Ops Signals

- Referrals and source tracking: `/admin_referrals`
- Retention/cohorts: `/admin_retention`
- Funnel: `/admin_funnel`
- Newbie path funnel/retention: `/admin_newbie`
- Quiz stats: `/admin_quiz`
- New users list: `/admin_new_users`

Analytics caveat:
- `admin_newbie` step `active/pending` should be counted only for users who actually opened newbie path (`openedDay` exists).
- `claimed` must never exceed `seen`; claim flow should record `seen` first.

Use admin commands first before adding one-off scripts.

## 8) Safe Change Checklist

Before merge:
1. Run targeted tests for changed domain (`node --test ...`).
2. Check that i18n text exists for `ru/uk/en` if user-facing.
3. Verify no admin command regression in `AdminCommands.js`.
4. Confirm cron-dependent features still work with current schedule.
5. Confirm no accidental rules drift in `GameConfig.js`.

## 9) If You Add New Features

Minimum update set:
1. `GameConfig.js` constants.
2. Service + handler wiring.
3. i18n strings (`ru/uk/en`).
4. Quest/Achievement hooks if relevant.
5. Admin observability (if feature impacts retention/economy).
6. Tests for the happy path and key edge case.
