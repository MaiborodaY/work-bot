export const petHandler = {
  match: (data) =>
    data.startsWith("pet:card:") ||
    data === "pet:help" ||
    data === "pet:cancel_buy" ||
    data === "pet:confirm_buy" ||
    data === "pet:feed" ||
    data === "pet:heal" ||
    data.startsWith("pet:buy:"),

  async handle(ctx) {
    const { data, u, cb, answer, goTo, pet, locations } = ctx;
    if (!pet) {
      await answer(cb.id, "Питомец временно недоступен.");
      return;
    }

    if (data.startsWith("pet:card:")) {
      await answer(cb.id);
      const type = String(data.split(":")[2] || "");
      const view = pet.buildTypeCardView(u, type);
      await locations.media.show({
        sourceMsg: locations._sourceMsg || cb?.message || null,
        place: "Pet",
        caption: view.caption,
        keyboard: view.keyboard,
        asset: view.asset || undefined,
        policy: "auto"
      });
      locations.setSourceMessage(null);
      return;
    }

    if (data.startsWith("pet:buy:")) {
      await answer(cb.id);
      const type = String(data.split(":")[2] || "");
      const res = await pet.startBuy(u, type);
      if (!res.ok) {
        await answer(cb.id, res.error || "Не удалось начать покупку.");
      }
      await goTo(u, "Pet");
      return;
    }

    if (data === "pet:help") {
      await answer(cb.id);
      const view = pet.buildHelpView(u);
      await locations.media.show({
        sourceMsg: locations._sourceMsg || cb?.message || null,
        place: "Pet",
        caption: view.caption,
        keyboard: view.keyboard,
        policy: "auto"
      });
      locations.setSourceMessage(null);
      return;
    }

    if (data === "pet:cancel_buy") {
      await answer(cb.id);
      await pet.cancelDraft(u);
      await goTo(u, "Pet");
      return;
    }

    if (data === "pet:confirm_buy") {
      await answer(cb.id);
      const res = await pet.confirmBuy(u);
      if (!res.ok) {
        await answer(cb.id, res.error || "Не удалось купить питомца.");
      }
      await goTo(u, "Pet");
      return;
    }

    if (data === "pet:feed") {
      await answer(cb.id);
      const res = await pet.feed(u);
      if (!res.ok) {
        await answer(cb.id, res.error || "Не удалось покормить.");
      }
      await goTo(u, "Pet");
      return;
    }

    if (data === "pet:heal") {
      await answer(cb.id);
      const res = await pet.heal(u);
      if (!res.ok) {
        await answer(cb.id, res.error || "Не удалось вылечить.");
      }
      await goTo(u, "Pet");
    }
  }
};
