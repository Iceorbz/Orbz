import { thanksgiving } from './thanksgiving';
import type { Theme } from './types';

/** All themes, keyed by id. Add new seasonal themes here. */
export const THEMES: Record<string, Theme> = {
  [thanksgiving.id]: thanksgiving,
};

export const activeTheme: Theme = thanksgiving;
export type { Theme, RoomDef } from './types';
