const ZONES = ["head", "body", "legs"];

export function isCombatZone(zone) {
  return ZONES.includes(String(zone || ""));
}

export function combatZoneDamage(zone) {
  switch (String(zone || "")) {
    case "head": return 3;
    case "body": return 2;
    case "legs": return 1;
    default: return 0;
  }
}

export function isCombatSelectionValid(attackZone, defenseZone) {
  return isCombatZone(attackZone) && isCombatZone(defenseZone) && String(attackZone) !== String(defenseZone);
}

export function combatDefenseOptions(attackZone) {
  const attack = String(attackZone || "");
  if (!isCombatZone(attack)) return [];
  return ZONES.filter((zone) => zone !== attack);
}

export function resolveCombatRound(left = {}, right = {}) {
  const leftAttack = String(left?.attack || "");
  const leftDefense = String(left?.defense || "");
  const rightAttack = String(right?.attack || "");
  const rightDefense = String(right?.defense || "");

  const leftValid = isCombatSelectionValid(leftAttack, leftDefense);
  const rightValid = isCombatSelectionValid(rightAttack, rightDefense);

  const leftBlocked = leftValid && rightValid && leftAttack === rightDefense;
  const rightBlocked = leftValid && rightValid && rightAttack === leftDefense;

  const leftDealt = leftValid && !leftBlocked ? combatZoneDamage(leftAttack) : 0;
  const rightDealt = rightValid && !rightBlocked ? combatZoneDamage(rightAttack) : 0;

  return {
    left: {
      attack: leftAttack,
      defense: leftDefense,
      dealt: leftDealt,
      taken: rightDealt,
      blocked: leftBlocked,
      valid: leftValid
    },
    right: {
      attack: rightAttack,
      defense: rightDefense,
      dealt: rightDealt,
      taken: leftDealt,
      blocked: rightBlocked,
      valid: rightValid
    }
  };
}

export function decideCombatWinner(leftScore, rightScore, { tieWinner = "left" } = {}) {
  const left = Math.max(0, Math.floor(Number(leftScore) || 0));
  const right = Math.max(0, Math.floor(Number(rightScore) || 0));
  if (left > right) return "left";
  if (right > left) return "right";
  return String(tieWinner || "left");
}

