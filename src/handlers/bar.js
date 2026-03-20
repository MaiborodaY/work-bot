import { CONFIG } from "../GameConfig.js";
import { normalizeLang, t } from "../i18n/index.js";
import { markFunnelStep } from "../PlayerStats.js";

const CHANNEL_USERNAME = "WorldOfLifeGame";

export const barHandler = {
  match: (data) =>
    data === "go:Bar" ||
    data === "bar:tasks" ||
    data === "bar:sub" ||
    data === "bar:sub:check",

  async handle(ctx) {
    const {
      data,
      u,
      cb,
      answer,
      users,
      now,
      locations,
      env,
      sendPhoto,
      sendWithInline,
      deleteMsg,
      quests,
    } = ctx;

    const lang = normalizeLang(u?.lang || "ru");
    const tt = (key, vars = {}) => t(key, lang, vars);
    const showBarMain = async () => {
      await locations.show(u, null, "Bar");
    };

    const showBarTasks = async () => {
      await locations.show(u, null, "BarTasks");
    };

    const showSubScreen = async () => {
      const caption = tt("bar.sub.caption");
      const ik = [
        [{ text: tt("bar.sub.btn.subscribe"), url: `https://t.me/${CHANNEL_USERNAME}` }],
        [{ text: tt("bar.sub.btn.checked"), callback_data: "bar:sub:check" }],
        [{ text: tt("bar.sub.btn.back"), callback_data: "go:Bar" }],
      ];

      const fileId = CONFIG?.ASSETS?.Bar;
      const msg = cb?.message;
      const chatId = msg?.chat?.id;

      try {
        if (fileId && sendPhoto && msg) {
          if (msg.photo?.length && ctx.editPhotoMedia) {
            await ctx.editPhotoMedia(msg.chat.id, msg.message_id, fileId, caption, ik);
            return;
          }
          if (deleteMsg) await deleteMsg(msg.chat.id, msg.message_id).catch(() => {});
          await sendPhoto(chatId, fileId, caption, ik);
          return;
        }
      } catch {}

      await sendWithInline(caption, ik);
    };

    const isChannelSubscriber = async (userId) => {
      try {
        const resp = await fetch(`https://api.telegram.org/bot${env.BOT_TOKEN}/getChatMember`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ chat_id: `@${CHANNEL_USERNAME}`, user_id: userId }),
        });
        const json = await resp.json().catch(() => ({}));
        const status = json?.result?.status;
        return status === "member" || status === "creator" || status === "administrator";
      } catch {
        return false;
      }
    };

    if (data === "go:Bar") {
      await answer(cb.id);
      let needSave = markFunnelStep(u, "didBar");
      if (quests?.ensureCycles) {
        const qRes = await quests.ensureCycles(u, { persist: false });
        needSave = needSave || !!qRes?.changed;
      }
      if (needSave) await users.save(u);
      await showBarMain();
      return;
    }

    if (data === "bar:tasks") {
      await answer(cb.id);
      let needSave = markFunnelStep(u, "didBar");
      if (quests?.ensureCycles) {
        const qRes = await quests.ensureCycles(u, { persist: false });
        needSave = needSave || !!qRes?.changed;
      }
      if (needSave) await users.save(u);
      await showBarTasks();
      return;
    }

    if (data === "bar:sub") {
      await answer(cb.id);
      await showSubScreen();
      return;
    }

    if (data === "bar:sub:check") {
      const subscribed = await isChannelSubscriber(u.id);
      const todayDay = new Date().toISOString().slice(0, 10);

      if (!subscribed) {
        await answer(cb.id, tt("bar.sub.err.not_subscribed"));
        return;
      }

      if (u?.subReward?.day === todayDay) {
        u.subReward = u.subReward || { day: "", eligible: false };
        u.subReward.day = todayDay;
        u.subReward.eligible = false;
        await users.save(u);
        await answer(cb.id, tt("bar.sub.info.already_received"));
        return;
      }

      u.subReward = u.subReward || { day: "", eligible: false };
      u.subReward.day = todayDay;
      u.subReward.eligible = false;
      u.premium = Math.max(0, Math.floor(Number(u.premium) || 0)) + 1;
      if (quests?.onEvent) {
        await quests.onEvent(u, "sub_bonus_claim", {}, { persist: false, notify: true });
      }
      await users.save(u);

      await answer(cb.id, tt("bar.sub.info.ready"));
      await showSubScreen();
      return;
    }
  },
};
