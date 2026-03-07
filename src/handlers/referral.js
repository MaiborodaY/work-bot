export const referralHandler = {
  match: (data) => data === "ref:refresh",

  async handle(ctx) {
    const { data, u, cb, answer, goTo } = ctx;

    if (data === "ref:refresh") {
      await answer(cb.id);
      await goTo(u, "Referral");
    }
  }
};
