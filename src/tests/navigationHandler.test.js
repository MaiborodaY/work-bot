import test from "node:test";
import assert from "node:assert/strict";
import { navigationHandler } from "../handlers/navigation.js";
import { Routes } from "../Routes.js";

test("navigation: go:Labour routes to Labour outside onboarding", async () => {
  const calls = [];
  const ctx = {
    data: "go:Labour",
    u: { id: "1", flags: { onboarding: false } },
    async goTo(user, place) {
      calls.push({ user, place });
    }
  };

  await navigationHandler.handle(ctx);

  assert.equal(calls.length, 1);
  assert.equal(calls[0].place, Routes.LABOUR);
});

test("navigation: go:Clan routes to Clan outside onboarding", async () => {
  const calls = [];
  const ctx = {
    data: "go:Clan",
    u: { id: "2", flags: { onboarding: false } },
    async goTo(user, place) {
      calls.push({ user, place });
    }
  };

  await navigationHandler.handle(ctx);

  assert.equal(calls.length, 1);
  assert.equal(calls[0].place, Routes.CLAN);
});

test("navigation: onboarding blocks unsupported route and redirects to Square", async () => {
  const calls = [];
  const ctx = {
    data: "go:Clan",
    u: { id: "3", flags: { onboarding: true, onboardingStep: "first_job" } },
    async goTo(user, place) {
      calls.push({ user, place });
    }
  };

  await navigationHandler.handle(ctx);

  assert.equal(calls.length, 1);
  assert.equal(calls[0].place, Routes.SQUARE);
});

test("navigation: onboarding go_gym step allows Gym route", async () => {
  const calls = [];
  const ctx = {
    data: "go:Gym",
    u: { id: "4", flags: { onboarding: true, onboardingStep: "go_gym" } },
    async goTo(user, place) {
      calls.push({ user, place });
    }
  };

  await navigationHandler.handle(ctx);

  assert.equal(calls.length, 1);
  assert.equal(calls[0].place, Routes.GYM);
});

