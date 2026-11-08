import type { TowerSave } from './sim/Tower';

const KEY = 'orbz-harvest-haunt-tower-v1';

/** Reads the autosave, or null when there is none or storage is blocked. */
export function loadSave(): TowerSave | null {
  try {
    const raw = localStorage.getItem(KEY);
    const data = raw ? (JSON.parse(raw) as TowerSave) : null;
    return data?.version === 1 ? data : null;
  } catch {
    return null;
  }
}

export function writeSave(data: TowerSave) {
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
  } catch {
    // Private windows and blocked storage: the game still runs, it just won't remember.
  }
}

export function clearSave() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // Nothing to clear.
  }
}
