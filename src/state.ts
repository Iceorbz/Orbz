import { Clock } from './sim/Clock';
import type { People } from './sim/People';
import type { Rating } from './sim/Rating';
import { Tower } from './sim/Tower';
import { Transit } from './sim/Transit';
import { activeTheme } from './themes';

/** The single tower for this prototype, shared by every scene. */
export const tower = new Tower(activeTheme);
export const clock = new Clock();
export const transit = new Transit(tower);
/** Filled in by the tower scene, which owns the monster sprites. */
export const world = { people: undefined as People | undefined, rating: undefined as Rating | undefined };

/** Tool the player has picked: 'select' (inspect), a room id, 'floor' or 'demolish'. */
export const tool = { current: 'select' as string | null };

/** What the info panel is showing. */
export type Selection = { type: 'room'; uid: number } | { type: 'monster'; id: number } | null;
