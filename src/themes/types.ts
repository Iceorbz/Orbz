/**
 * A theme is a swappable seasonal skin: colors, names, food and decor.
 * Game rules never hard-code these, so adding a new holiday is just a new theme file.
 */
export interface RoomDef {
  id: string;
  name: string;
  /** Width in cells. */
  width: number;
  cost: number;
  /** Main wall color of the room. */
  color: number;
  /** Accent color for trim and furniture blocks. */
  accent: number;
  kind: 'lobby' | 'home' | 'food' | 'shop' | 'office' | 'transport';
  description: string;
}

export interface Theme {
  id: string;
  title: string;
  tagline: string;
  palette: {
    skyTop: number;
    skyBottom: number;
    nightTop: number;
    nightBottom: number;
    grass: number;
    grassDark: number;
    dirt: number;
    dirtDark: number;
    stone: number;
    stoneDark: number;
    hud: number;
    hudText: string;
    accentText: string;
  };
  /** Colors used for falling ambient particles (leaves, snow, ...). */
  particleColors: number[];
  rooms: RoomDef[];
  foods: string[];
  decor: string[];
}
