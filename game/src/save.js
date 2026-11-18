// Save game to localStorage: cash, finished missions and the player's best run.
// Nothing leaves the browser.

export const SAVE_KEY = 'marlowe-bay-save-v1';

export function loadSave() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || typeof data !== 'object') return null;
    return {
      cash: typeof data.cash === 'number' ? data.cash : 0,
      missionsDone: Array.isArray(data.missionsDone) ? data.missionsDone : [],
      bestWanted: typeof data.bestWanted === 'number' ? data.bestWanted : 0,
      carsStolen: typeof data.carsStolen === 'number' ? data.carsStolen : 0,
    };
  } catch {
    return null;
  }
}

export function saveGame(data) {
  try {
    window.localStorage.setItem(SAVE_KEY, JSON.stringify({
      cash: data.cash | 0,
      missionsDone: data.missionsDone || [],
      bestWanted: data.bestWanted | 0,
      carsStolen: data.carsStolen | 0,
    }));
    return true;
  } catch {
    return false;
  }
}

export function clearSave() {
  try {
    window.localStorage.removeItem(SAVE_KEY);
  } catch {
    // Storage off: nothing to clear.
  }
}
