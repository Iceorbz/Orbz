import Phaser from 'phaser';
import { CELL_W, FLOOR_H, cellX, floorY } from '../config';
import type { Tower } from '../sim/Tower';

/** Redraws every empty floor slab: an unfinished timber frame waiting for a room. */
export function drawFloors(g: Phaser.GameObjects.Graphics, tower: Tower) {
  g.clear();
  for (const [floor, row] of tower.slabRows()) {
    const y = floorY(floor);
    let c = 0;
    while (c < row.length) {
      if (!row[c]) {
        c++;
        continue;
      }
      const start = c;
      while (c < row.length && row[c]) c++;
      const x = cellX(start);
      const w = (c - start) * CELL_W;
      g.fillStyle(0x3a2a22, 1).fillRect(x, y, w, FLOOR_H);
      // Studs and a cross brace every two cells.
      for (let px = 0; px < w; px += CELL_W * 2) {
        g.fillStyle(0x5c4232, 1).fillRect(x + px, y, 3, FLOOR_H);
        g.lineStyle(2, 0x4a3426, 1).lineBetween(x + px + 3, y + FLOOR_H - 6, x + px + CELL_W * 2, y + 4);
      }
      g.fillStyle(0x6b4a34, 1).fillRect(x, y, w, 4);
      g.fillStyle(0x7a5232, 1).fillRect(x, y + FLOOR_H - 6, w, 6);
      g.fillStyle(0x000000, 0.25).fillRect(x, y + FLOOR_H - 6, w, 1);
    }
  }
}
