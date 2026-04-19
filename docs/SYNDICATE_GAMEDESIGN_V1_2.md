# Syndicate - Game Design v1.2 (MVP)

Last updated: 2026-04-19 (UTC)
Status: approved design, not implemented yet

## 1) Feature Purpose

Syndicate is a co-op economy mechanic where two players run a timed deal with a random outcome.
Goals:
- increase social engagement,
- create a mid/late-game active money loop,
- strengthen business ownership value.

## 2) Access Rules

- Player level must be `>= 10`.
- Player must own at least one business.
- Syndicate location is always visible in City.
- If requirements are not met, open a locked screen with clear requirements.

## 3) Core Constraints

- Limit is `1 active deal per business` per player (open or active).
- Partner can accept only if they own the same business type.
- Partner stake must match creator stake (same tier amount).
- No commission in MVP.
- Open deal timeout: `24h`, then full refund to creator.
- Creator can cancel deal before partner acceptance (full refund).
- Admin users are excluded from public syndicate ratings.

## 4) Deal Flow

1. Player opens Syndicate and selects a business tab.
2. Player creates a deal with an available tier.
3. Deal is listed on open board for that business.
4. Eligible partner accepts the deal.
5. Deal becomes active and runs until resolve time.
6. On resolve, both players receive the same outcome class and payout formula.
7. Deal counts into stats and rating.

Note:
- Total lifecycle can be `open timeout + active duration`.
- Example: Shawarma can take up to `24h open + 12h active = 36h`.

## 5) Tier Availability

For each business:
- `Small` is always unlocked.
- `Medium` unlocks after `3 completed deals` on that business.
- `Large` unlocks after `10 completed deals` on that business.

Important:
- Unlock progress uses all completed outcomes (`success`, `lucky`, `fail`), not only successful deals.

## 6) Stakes by Business and Tier

| Tier | Shawarma | Stomatology | Restaurant | Courier | Fitness |
|---|---:|---:|---:|---:|---:|
| Small | 500 | 2,500 | 7,500 | 15,000 | 40,000 |
| Medium | 2,000 | 7,500 | 20,000 | 40,000 | 100,000 |
| Large | 5,000 | 15,000 | 50,000 | 100,000 | 250,000 |

## 7) Outcome Balance (MVP)

Outcome formula per player:
- `return = floor(amount * (1 + modifierPct))`
- `profit = return - amount`

| Business | Duration | Probabilities S/L/F | Modifiers S/L/F | EV per deal | EV per day |
|---|---:|---:|---:|---:|---:|
| Shawarma | 12h | 80% / 15% / 5% | +8% / +15% / -10% | +8.15% | +16.3% |
| Stomatology | 1d | 65% / 20% / 15% | +8% / +20% / -20% | +6.2% | +6.2% |
| Restaurant | 1.5d | 60% / 25% / 15% | +15% / +30% / -20% | +13.5% | +9.0% |
| Courier | 2d | 55% / 25% / 20% | +25% / +50% / -25% | +21.25% | +10.6% |
| Fitness | 3d | 50% / 25% / 25% | +40% / +80% / -30% | +32.5% | +10.8% |

EV formula:
- `EV = P(S)*S + P(L)*L + P(F)*F`

## 8) UX and Messaging

### 8.1 Main Syndicate Screen
- List only owned businesses.
- Show open deal counters per business.
- Separate entry to rating screen.

### 8.2 Business Screen
- "Your active deal" block.
- "Create deal" button.
- Open deals list sorted by newest first.
- Tier unlock progress hint, for example:
  - `Medium unlocks in X deals`
  - `Large unlocks in Y deals`

### 8.3 Outcome Presentation

Use distinct result classes:
- `✅ Successful deal`
- `🌟 Lucky deal`
- `❌ Failed deal`

Lucky must have separate, stronger success wording in UI and push.

## 9) Rating Model (Public)

Public ranking is based on weighted points, not raw deal count.

Tier points:
- Small = `1`
- Medium = `3`
- Large = `7`

Tabs:
- `All-time` by total points.
- `Weekly` by UTC-week points.

Secondary counters (not primary rank key):
- completed deals count,
- net profit.

## 10) Achievements (MVP)

- `syndicate_first`: complete first deal.
- `syndicate_10`: complete 10 deals.
- `syndicate_all_biz`: complete at least one deal in each of the 5 business types in the game.

## 11) Push Notifications

- Partner accepted:
  - `✅ Partner found - deal started.`
- Open timeout expired:
  - `ℹ️ No partner found. Money returned.`
- Deal resolved:
  - `🎯 Deal completed - check result.`
- Lucky result:
  - use dedicated lucky wording.

## 12) Explicitly Out of MVP

- 3+ participants in one deal.
- Private username-targeted deals.
- Clan deals/bonuses.
- Insurance for crystals.
- Public full history feed.

