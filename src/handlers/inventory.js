import { InventoryService } from "../InventoryService.js";
import { normalizeLang, t } from "../i18n/index.js";
import { Routes } from "../Routes.js";

export const inventoryHandler = {
  match: (data) => String(data || "").startsWith("inv:use:"),

  async handle(ctx) {
    const { data, u, cb, answer, users, goTo } = ctx;
    const lang = normalizeLang(u?.lang || "ru");
    const tt = (key, vars = {}) => t(key, lang, vars);
    const itemId = String(data || "").split(":")[2] || "";
    const res = InventoryService.use(u, itemId);

    if (!res.ok) {
      await answer(cb.id, tt(res.code === "full_energy" ? "handler.inventory.full_energy" : "handler.inventory.not_found"));
      return;
    }

    await users.save(u);
    await answer(cb.id, tt("handler.inventory.used", { energy: res.energy, energyMax: res.energyMax }));
    await goTo(u, Routes.INVENTORY);
  }
};
