import { Tower } from './sim/Tower';
import { activeTheme } from './themes';

/** The single tower for this prototype, shared by every scene. */
export const tower = new Tower(activeTheme);

/** Tool the player has picked in the build menu: a room id, 'demolish', or null for none. */
export const tool = { current: null as string | null };
