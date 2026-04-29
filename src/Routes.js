// Routes.js
export const Routes = Object.freeze({
  SQUARE: "Square",
  EARN: "Earn",
  WORK: "Work",
  PROGRESS: "Progress",
  MINI_GAMES: "MiniGames",
  CITY: "City",
  COLOSSEUM: "Colosseum",
  ONBOARDING_TO_BAR: "OnboardingToBar",
  SHOP_HUB: "ShopHub",
  SHOP: "Shop",
  INVENTORY: "Inventory",
  HOME: "Home",
  HOME_BED_UPGRADES: "HomeBedUpgrades",
  FARM: "Farm",
  MARKET: "Market",
  BUSINESS_DISTRICT: "BusinessDistrict",
  PET: "Pet",
  BAR: "Bar",
  BAR_TASKS: "BarTasks",
  BAR_NEWBIE_TASKS: "BarNewbieTasks",
  CASINO: "Casino",
  BUSINESS: "Business",
  LABOUR: "Labour",
  STOCKS: "Stocks",
  STUDY: "Study",
  GYM: "Gym",
  UPGRADES: "Upgrades",
  CITY_BOARD: "CityBoard",
  CLAN: "Clan",
  RATINGS: "Ratings",
  SYNDICATE: "Syndicate",
  FISHING: "Fishing",
  THIEF: "Thief",
  REFERRAL: "Referral",
});

export function toGoCallback(route) {
  return `go:${String(route || Routes.SQUARE)}`;
}

export function parseGoRoute(data) {
  const raw = String(data || "");
  if (!raw.startsWith("go:")) return "";
  const route = raw.slice(3).trim();
  return route || Routes.SQUARE;
}
