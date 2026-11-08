/** World layout constants. One "cell" is the smallest horizontal unit a room can occupy. */
export const CELL_W = 16;
export const FLOOR_H = 64;
/** Number of cells across the buildable lot. */
export const LOT_CELLS = 64;
/** Floors above ground the camera can scroll to. */
export const MAX_FLOORS = 40;
/** Floors below ground (basements). */
export const MAX_BASEMENTS = 6;
/** Empty margin (pixels) left and right of the lot. */
export const SIDE_MARGIN = 320;

export const WORLD_W = LOT_CELLS * CELL_W + SIDE_MARGIN * 2;
export const SKY_H = MAX_FLOORS * FLOOR_H + 240;
export const UNDERGROUND_H = MAX_BASEMENTS * FLOOR_H + 96;
export const WORLD_H = SKY_H + UNDERGROUND_H;
/** Y coordinate of the ground line (top of grass). */
export const GROUND_Y = SKY_H;

/** Left edge (pixels) of the buildable lot. */
export const LOT_X = SIDE_MARGIN;

/** Pixel x of a cell's left edge. */
export const cellX = (cell: number) => LOT_X + cell * CELL_W;
/** Pixel y of a floor's top edge. Floor 0 is the lobby; negative floors are basements. */
export const floorY = (floor: number) => GROUND_Y - (floor + 1) * FLOOR_H;
