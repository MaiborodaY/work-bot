import { normalizeLang, t } from "../i18n/index.js";
import { Routes } from "../Routes.js";
import { showEnergyChoicePanel } from "./energy.js";

export const farmHandler = {
  match: (data) =>
    data === "farm:refresh" ||
    data === "farm:help" ||
    data === "farm:harvest_all" ||
    data.startsWith("farm:buy_plot:") ||
    data.startsWith("farm:plant_menu:") ||
    data.startsWith("farm:plant:") ||
    data.startsWith("farm:harvest:"),

  async handle(ctx) {
    const { data, u, cb, answer, farm, locations, goTo, quests, users } = ctx;
    const lang = normalizeLang(u?.lang || "ru");
    const tt = (key, vars = {}) => t(key, lang, vars);

    if (!farm) {
      await answer(cb.id, tt("handler.farm.unavailable"));
      return;
    }

    const show = async (view) => {
      await locations.media.show({
        sourceMsg: locations._sourceMsg || cb?.message || null,
        place: "Farm",
        caption: view.caption,
        keyboard: view.keyboard,
        policy: "auto"
      });
      locations.setSourceMessage(null);
    };

    if (data === "farm:refresh") {
      await answer(cb.id);
      await goTo(u, "Farm");
      return;
    }

    if (data === "farm:help") {
      await answer(cb.id);
      const view = await farm.buildHelpView(u);
      await locations.media.show({
        sourceMsg: locations._sourceMsg || cb?.message || null,
        place: "FarmHelp",
        caption: view.caption,
        keyboard: view.keyboard,
        policy: "auto"
      });
      locations.setSourceMessage(null);
      return;
    }

    if (data === "farm:harvest_all") {
      await answer(cb.id);
      const res = await farm.harvestAll(u);
      if (!res.ok) {
        await answer(cb.id, res.error || tt("handler.common.unknown_command"));
        await goTo(u, "Farm");
        return;
      }
      const view = farm.buildHarvestAllResultView(u, res);
      await show(view);
      return;
    }

    if (data.startsWith("farm:buy_plot:")) {
      await answer(cb.id);
      const plotIndex = Number(data.split(":")[2] || 0);
      const res = await farm.buyPlot(u, plotIndex);
      if (!res.ok) {
        await answer(cb.id, res.error || tt("handler.common.unknown_command"));
        await goTo(u, "Farm");
        return;
      }
      const view = farm.buildBuyPlotResultView(u, res);
      await show(view);
      return;
    }

    if (data.startsWith("farm:plant_menu:")) {
      await answer(cb.id);
      const plotIndex = Number(data.split(":")[2] || 0);
      const view = await farm.buildPlantMenuView(u, plotIndex);
      await show(view);
      return;
    }

    if (data.startsWith("farm:plant:")) {
      await answer(cb.id);
      const parts = data.split(":");
      const plotIndex = Number(parts[2] || 0);
      const cropId = String(parts[3] || "");
      const res = await farm.plant(u, plotIndex, cropId);
      if (!res.ok) {
        if (res.code === "not_enough_energy") {
          await showEnergyChoicePanel(ctx, {
            origin: Routes.FARM,
            need: Math.max(0, Number(res?.needEnergy) || 0)
          });
          return;
        }
        await answer(cb.id, res.error || tt("handler.common.unknown_command"));
        const view = await farm.buildPlantMenuView(u, plotIndex);
        await show(view);
        return;
      }
      const view = farm.buildPlantResultView(u, res);
      let newbieCompleted = false;
      if (quests?.markNewbieAction) {
        try {
          newbieCompleted = !!quests.markNewbieAction(u, "farm_plant", { cropId });
        } catch {}
      }
      if (newbieCompleted && users?.save) {
        await users.save(u);
      }
      if (newbieCompleted) {
        await goTo(u, "BarNewbieTasks", view.caption);
        return;
      }
      await show(view);
      return;
    }

    if (data.startsWith("farm:harvest:")) {
      await answer(cb.id);
      const plotIndex = Number(data.split(":")[2] || 0);
      const res = await farm.harvest(u, plotIndex);
      if (!res.ok) {
        await answer(cb.id, res.error || tt("handler.common.unknown_command"));
        await goTo(u, "Farm");
        return;
      }
      const view = farm.buildHarvestResultView(u, res);
      await show(view);
    }
  }
};
