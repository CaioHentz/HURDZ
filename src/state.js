// Persistent game state and upgrades stored in localStorage
const STORAGE_KEY = 'tz-state-v1';

const defaultState = {
  coins: 0,            // persists across runs
  totalKills: 0,       // cumulative metric
  upgrades: {
    damage: 0,         // +damage per level
    fireRate: 0,       // -fire interval per level
    speed: 0           // +move speed per level
  },
  weapons: {
    pistol: { unlocked: true, selected: true },
    shotgun: { unlocked: false, selected: false }
  }
};

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...defaultState };
    const parsed = JSON.parse(raw);
    // Shallow merge to keep forward compatibility
    return deepMerge({ ...defaultState }, parsed);
  } catch {
    return { ...defaultState };
  }
}

function save(state) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function deepMerge(target, source) {
  for (const k of Object.keys(source)) {
    if (source[k] && typeof source[k] === 'object' && !Array.isArray(source[k])) {
      target[k] = deepMerge(target[k] || {}, source[k]);
    } else {
      target[k] = source[k];
    }
  }
  return target;
}

let state = load();

export function getState() {
  return state;
}

export function resetAllProgress() {
  state = { ...defaultState };
  save(state);
}

// Coins and kills
export function addCoins(amount) {
  state.coins = Math.max(0, Math.floor(state.coins + amount));
  save(state);
}

export function spendCoins(amount) {
  if (state.coins >= amount) {
    state.coins -= amount;
    save(state);
    return true;
  }
  return false;
}

export function addKills(n = 1) {
  state.totalKills = Math.max(0, Math.floor(state.totalKills + n));
  save(state);
}

// Upgrades
export const UPGRADE_TYPES = /** @type {const} */ (['damage', 'fireRate', 'speed']);

export function getUpgradeLevel(type) {
  return state.upgrades[type] || 0;
}

// Escalating costs per level
export function getUpgradeCost(type) {
  const level = getUpgradeLevel(type);
  const tables = {
    damage: { base: 50, mult: 1.5 },
    fireRate: { base: 60, mult: 1.6 },
    speed: { base: 40, mult: 1.4 }
  };
  const t = tables[type];
  const cost = Math.round(t.base * Math.pow(t.mult, level));
  return cost;
}

export function canUpgrade(type) {
  return state.coins >= getUpgradeCost(type);
}

export function applyUpgrade(type) {
  const cost = getUpgradeCost(type);
  if (spendCoins(cost)) {
    state.upgrades[type] = (state.upgrades[type] || 0) + 1;
    save(state);
    return true;
  }
  return false;
}

// Weapons
export function getSelectedWeapon() {
  for (const [name, info] of Object.entries(state.weapons)) {
    if (info.selected) return name;
  }
  return 'pistol';
}

export function isWeaponUnlocked(name) {
  return !!(state.weapons[name] && state.weapons[name].unlocked);
}

export function unlockWeapon(name, cost) {
  if (isWeaponUnlocked(name)) return true;
  if (spendCoins(cost)) {
    if (!state.weapons[name]) state.weapons[name] = { unlocked: true, selected: false };
    else state.weapons[name].unlocked = true;
    save(state);
    return true;
  }
  return false;
}

export function selectWeapon(name) {
  if (!isWeaponUnlocked(name)) return false;
  for (const key of Object.keys(state.weapons)) {
    state.weapons[key].selected = key === name;
  }
  save(state);
  return true;
}

// Computed stats based on upgrades and weapon
export function getComputedStats() {
  const dmgLvl = getUpgradeLevel('damage');
  const frLvl = getUpgradeLevel('fireRate');
  const spdLvl = getUpgradeLevel('speed');
  const weapon = getSelectedWeapon();

  // Shared stats
  const maxHP = 100;

  if (weapon === 'shotgun') {
    // Shotgun: burst of pellets, slower fire, lower per-pellet damage, wider spread
    const pelletCount = 5;
    const spreadDeg = 16;
    const baseInterval = 700; // ms
    const interval = Math.max(120, Math.round(baseInterval * Math.pow(0.94, frLvl)));
    return {
      weapon,
      damage: 6 + dmgLvl * 2.5,  // per pellet
      fireInterval: interval,
      playerSpeed: 200 + spdLvl * 25,
      bulletSpeed: 550,
      pelletCount,
      spreadDeg,
      bulletLifetime: 700,
      maxHP
    };
  }

  // Default pistol
  const baseInterval = 400;
  const interval = Math.max(90, Math.round(baseInterval * Math.pow(0.92, frLvl)));
  return {
    weapon: 'pistol',
    damage: 10 + dmgLvl * 4,
    fireInterval: interval,
    playerSpeed: 220 + spdLvl * 25,
    bulletSpeed: 650,
    pelletCount: 1,
    spreadDeg: 0,
    bulletLifetime: 1200,
    maxHP
  };
}

// Utility to wipe coins only (if wanting fresh currency while keeping upgrades)
export function resetCoins() {
  state.coins = 0;
  save(state);
}
