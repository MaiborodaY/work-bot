// AdminCommands.js
// Release 1.0
// Команды администратора: grant/setmoney + кристаллы (givegem/setgem) + полный вайп (/wipe)
export class AdminCommands {
  /**
   * deps:
   *  - users: UserStore
   *  - send: (text: string) => Promise<void>
   *  - isAdmin: (id: number|string) => boolean
   */
  constructor({ users, send, isAdmin }) {
    this.users = users;
    this.send = send;
    this.isAdmin = isAdmin;
  }

  async tryHandle(text, { fromId }) {
    if (!this.isAdmin(fromId)) return false;
// ===== /wipe <userId> — Сбросить игрока до состояния нового.
// Не сохраняем chatId, displayName очищаем. Телеметрию Stars не трогаем.


    const mWipe = text.match(/^\/wipe(?:@\w+)?\s+(\d+)\s*$/i);
    if (mWipe) {
      const targetId = Number(mWipe[1]);
      if (!Number.isFinite(targetId)) {
        await this.send("❌ Формат: /wipe <userId>");
        return true;
      }

      const current = await this.users.getOrCreate(targetId);
      // chatId НЕ сохраняем — пусть будет очищен
      
      const fresh = this.users._newUser(targetId);
      
      // displayName намеренно очищаем — при следующем /start подставится фолбэк из TG
      fresh.displayName = "";
      fresh.awaitingName = true;   // не ждём ввода
      fresh.afterNameRoute = "Square";    // чистим возможный маршрут
      
      

      // на всякий случай выключим потенц. процессы
      if (fresh.study) fresh.study.active = false;
      if (fresh.rest)  fresh.rest.active  = false;
      if (fresh.gym)   fresh.gym.active   = false;
      if (fresh.jobs)  fresh.jobs.active  = [];

      // Бар — чистый
      if (fresh.bar) {
        fresh.bar.day = "";
        fresh.bar.assigned = false;
        fresh.bar.tasks = [];
      }

      await this.users.save(fresh);

      // уведомление только администратору (игроку ничего не пишем)
      await this.send(
        "✅ Вайп выполнен.\n" +
        `Пользователь <code>${targetId}</code> сброшен до состояния нового.\n` +
        `Сохранено: displayName очищен.\n` +
        `Стартовые балансы: $${fresh.money}, ⚡${fresh.energy}/${fresh.energy_max}, 💎${fresh.premium}.`
      );
      
      return true;
    }

    // /grant <userId> <amount> — деньги +/- amount
    const mGrant = text.match(/^\/grant(?:@\w+)?\s+(\d+)\s+(-?\d+)\s*$/i);
    if (mGrant) {
      const targetId = Number(mGrant[1]);
      const amount = Number(mGrant[2]);

      if (!Number.isFinite(targetId) || !Number.isFinite(amount)) {
        await this.send("❌ Формат: /grant <userId> <amount>");
        return true;
      }
      const u = await this.users.getOrCreate(targetId);
      u.money = Math.max(0, (u.money || 0) + amount);
      await this.users.save(u);

      await this.send(
        `✅ Grant: $${amount >= 0 ? "+" + amount : amount} → <code>${targetId}</code>\n` +
        `Баланс: $${u.money}`
      );
      return true;
    }

    // /setmoney <userId> <amount> — деньги = amount
    const mSet = text.match(/^\/setmoney(?:@\w+)?\s+(\d+)\s+(\d+)\s*$/i);
    if (mSet) {
      const targetId = Number(mSet[1]);
      const value = Math.max(0, Number(mSet[2]));

      if (!Number.isFinite(targetId) || !Number.isFinite(value)) {
        await this.send("❌ Формат: /setmoney <userId> <amount>");
        return true;
      }

      const u = await this.users.getOrCreate(targetId);
      u.money = value;
      await this.users.save(u);

      await this.send(
        `✅ SetMoney для <code>${targetId}</code>\n` +
        `Новый баланс: $${u.money}`
      );
      return true;
    }

    // /givegem <userId> <amount> — кристаллы +/- amount
    const mGiveGem = text.match(/^\/givegem(?:@\w+)?\s+(\d+)\s+(-?\d+)\s*$/i);
    if (mGiveGem) {
      const targetId = Number(mGiveGem[1]);
      const amount = Number(mGiveGem[2]);

      if (!Number.isFinite(targetId) || !Number.isFinite(amount)) {
        await this.send("❌ Формат: /givegem <userId> <amount>");
        return true;
      }
      const u = await this.users.getOrCreate(targetId);
      u.premium = Math.max(0, (u.premium || 0) + amount);
      await this.users.save(u);

      await this.send(
        `✅ Gems: ${amount >= 0 ? "+" + amount : amount} 💎 → <code>${targetId}</code>\n` +
        `Баланс: 💎${u.premium}`
      );
      return true;
    }

    // /setgem <userId> <amount> — кристаллы = amount
    const mSetGem = text.match(/^\/setgem(?:@\w+)?\s+(\d+)\s+(\d+)\s*$/i);
    if (mSetGem) {
      const targetId = Number(mSetGem[1]);
      const value = Math.max(0, Number(mSetGem[2]));

      if (!Number.isFinite(targetId) || !Number.isFinite(value)) {
        await this.send("❌ Формат: /setgem <userId> <amount>");
        return true;
      }

      const u = await this.users.getOrCreate(targetId);
      u.premium = value;
      await this.users.save(u);

      await this.send(
        `✅ SetGems для <code>${targetId}</code>\n` +
        `Новый баланс: 💎${u.premium}`
      );
      return true;
    }
 // /users — вывести всех пользователей (id + ник)
 if (/^\/users(?:@\w+)?\s*$/i.test(text)) {
  // KV list может быть постраничным — пробегаем курсором
  const prefix = "u:";
  const escapeHtml = (s) =>
    String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");

  let cursor = undefined;
  const keys = [];
  try {
    // Некоторые рантаймы возвращают {keys, list_complete, cursor}
    // Делаем совместимо: крутим пока есть cursor и пока не list_complete === true
    // (если поля нет — просто одна страница)
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const res = await this.users.db.list({ prefix, cursor });
      if (res?.keys?.length) keys.push(...res.keys);
      if (!res || res.list_complete || !res.cursor) break;
      cursor = res.cursor;
    }
  } catch (e) {
    await this.send(`❌ Ошибка чтения KV: ${escapeHtml(e?.message || e)}`);
    return true;
  }

  if (!keys.length) {
    await this.send("ℹ️ Пользователи не найдены.");
    return true;
  }

  // Читаем пользователей и формируем строки
  const rows = [];
  for (const k of keys) {
    try {
      const raw = await this.users.db.get(k.name);
      const u = raw ? JSON.parse(raw) : null;
      if (u && (u.id || u.displayName)) {
        const id = u.id ?? Number(String(k.name).slice(prefix.length));
        const name = u.displayName || "(без ника)";
        rows.push({ id, name });
      }
    } catch {
      // игнорируем сломанные записи
    }
  }

  if (!rows.length) {
    await this.send("ℹ️ Пользователи не найдены.");
    return true;
  }

  // Сортировка по id
  rows.sort((a, b) => String(a.id).localeCompare(String(b.id)));

  // Рендер чанками (≈70 строк на сообщение — безопасно для лимита TG)
  const CHUNK = 70;
  for (let i = 0; i < rows.length; i += CHUNK) {
    const part = rows.slice(i, i + CHUNK);
    const body = part
      .map(r => `<code>${r.id}</code> — ${escapeHtml(r.name)}`)
      .join("\n");
    await this.send(`👥 Пользователи (${i + 1}–${i + part.length} / ${rows.length})\n${body}`);
  }
  return true;
}
    return false;
  }
}
