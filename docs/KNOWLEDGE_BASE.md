# Knowledge Base

## Функционал: Поставки для бизнеса (MVP)

### Что это
- В игре появился модуль поставок ингредиентов для бизнеса.
- Сейчас в MVP поддерживается только один бизнес: `shawarma`.
- Игрок выполняет заказ поставки (сдаёт ингредиенты из инвентаря) и получает множитель к завтрашней выплате бизнеса.

### Где это в коде
- Бизнес-логика: `src/BusinessSupplyService.js`
- UI/хендлер: `src/handlers/businessSupply.js`
- Конфиг: `src/GameConfig.js` -> `CONFIG.BUSINESS_SUPPLY.shawarma`
- Применение бонуса к выплате: `src/BusinessPayout.js`
- Кнопка входа в меню: `src/UiFactory.js` (`ui.earn.business_supply`)
- Тексты: `src/i18n/ru.js`, `src/i18n/uk.js`, `src/i18n/en.js` (`business_supply.*`)

### Пользовательский флоу (текущее поведение)
1. Игрок открывает раздел `Заработок` -> `Поставки для бизнеса`.
2. Если нет ни одного бизнеса, показывается сообщение о необходимости купить бизнес.
3. Если бизнес есть, но это не `shawarma`, показывается ограничение MVP (пока только шаверма).
4. Для `shawarma`:
- Сначала нужно открыть поставки за деньги.
- После открытия доступен заказ дня (рецепт фиксированный в конфиге).
- При наличии ингредиентов можно нажать `Выполнить поставку`.
- После выполнения показывается прогресс и бонус `xN` к завтрашней выплате.
- После получения выплаты бонус сгорает.

### Экономика и параметры (MVP)
Источник: `CONFIG.BUSINESS_SUPPLY.shawarma`
- `unlockPrice`: `10000`
- `maxSlots`: `3`
- `recipe`:
- `crop_carrot`: `2`
- `crop_tomato`: `1`
- `multipliersByOrders`:
- 1-й заказ в день: `x2`
- 2-й заказ в день: `x3`
- 3-й заказ в день: `x5`
- Расширение слотов:
- До 2 слота: нужно `progress 5`, цена `25000`
- До 3 слота: нужно `progress 10`, цена `75000`

### Внутренняя модель данных (в бизнес-энтри)
Поле хранится как `entry.supply`:
- `unlocked: boolean`
- `slots: number`
- `progress: number`
- `lastOrderDayUTC: YYYY-MM-DD`
- `ordersToday: number`
- `pendingMultiplier: number`
- `pendingBonusDayUTC: YYYY-MM-DD`

### Технические детали поведения
- Дневные ограничения:
- `ordersToday` сбрасывается при смене UTC-дня.
- Отложенный бонус:
- Бонус действует только в день выполнения (`pendingBonusDayUTC`).
- Если день сменился до клейма бизнеса, бонус очищается.
- На клейме бизнеса:
- В `BusinessPayout.applyBusinessClaim(...)` применяется `claimMultiplier(...)`.
- Сразу после клейма вызывается `consumeClaimBonus(...)`.

### Текущее ограничение MVP
- Хендлер жёстко работает только с `MVP_BIZ_ID = "shawarma"`.
- Для других бизнесов поставки пока не доступны.

### Известные узкие места / что важно при доработке
- Поставки завязаны на инвентарь фермы (`crop_carrot`, `crop_tomato`), поэтому изменение фермы напрямую влияет на доступность поставок.
- Бонус привязан к клейму на следующий UTC-день после поставки; если игрок тянет ещё дольше, бонус сгорит.
- Логика дневного состояния и бонуса обновляется лениво (через нормализацию/доступ к модулю), а не отдельным cron.
- Для масштабирования на другие бизнесы нужно снять жёсткий `MVP_BIZ_ID` в хендлере и расширить конфиг по бизнесам.

### Куда дописывать дальше
- В этот файл добавляем следующие разделы по другим механикам игры.
- Формат сохраняем: `Что это` -> `Где в коде` -> `Флоу` -> `Экономика` -> `Риски/ограничения`.

---

## Functional: Farm Market (MVP)

### What it is
- New `Market` section in `Earnings` where players manually sell farm crops from inventory.
- This is an alternative to instant sell from farm plots (`Harvest & sell`).

### Where in code
- Service: `src/MarketService.js`
- Handler: `src/handlers/market.js`
- Route: `src/Routes.js` (`Routes.MARKET`)
- Navigation button: `src/UiFactory.js` (`ui.earn.market`)
- Route rendering: `src/Locations.js` (`_buildServiceRouteRegistry`)
- Wiring: `src/worker.js` (service init + handler in callback pipeline)
- Texts: `src/i18n/ru.js`, `src/i18n/uk.js`, `src/i18n/en.js` (`market.*`)

### Flow
1. Player opens `Earnings -> Market`.
2. Market lists crop items currently in inventory with quantity and total sell value.
3. Player opens an item card and sells by quantity (`1/5/10/all`).
4. After sell, money is credited immediately, and player returns to Market.

### Economy + stats behavior
- Sell price is taken from `CONFIG.FARM.CROPS[*].sellPrice`.
- Net farm profit from market sell is counted as:
  - `sellPrice - seedPrice` per unit.
- Market sell updates the same farm net-profit stats used by farm top/rankings:
  - `stats.farmMoneyTotal`
  - `stats.farmMoneyWeek`
  - `stats.farmIncomeDays`
- If `SocialService.maybeUpdateFarmTop` is available, market sell pushes fresh farm top values.

### Current limits
- Only crop items from farm config are sellable (`crop_*` mapped to `FARM.CROPS`).
- No partial pricing logic per tier/quality yet (single fixed sell price per crop from config).
