import Phaser from 'phaser';
import type { RoomDef, Theme } from '../themes';
import { drawLobby } from './lobby';

const WOOD_DARK = 0x3b2414;
const WOOD = 0x7a5232;

/**
 * Draws a room of any kind into a container positioned at (x, y).
 * Destroying the container removes the room and its animations.
 */
export function drawRoom(
  scene: Phaser.Scene, theme: Theme, def: RoomDef, x: number, y: number, w: number, h: number,
): Phaser.GameObjects.Container {
  const box = scene.add.container(x, y);
  if (def.kind === 'lobby') {
    // The lobby draws in world space; wrap what it creates so it can be removed like other rooms.
    const before = new Set(scene.children.list);
    drawLobby(scene, theme, x, y, w, h);
    const created = scene.children.list.filter((o) => !before.has(o) && o !== box);
    created.forEach((o) => {
      const go = o as Phaser.GameObjects.Components.Transform & Phaser.GameObjects.GameObject;
      go.x -= x;
      go.y -= y;
      box.add(o);
    });
    return box;
  }

  const g = scene.add.graphics();
  box.add(g);
  const img = (key: string, ix: number, iy: number, ox = 0.5, oy = 1) =>
    box.add(scene.add.image(ix, iy, key).setOrigin(ox, oy));
  const floorTop = h - 6;

  if (def.id === 'stairs') {
    drawStairs(g, def, w, h);
    return box;
  }
  if (def.id === 'elevator') {
    drawElevator(g, def, w, h);
    return box;
  }

  // Shared shell: wall with soft vertical stripes, ceiling trim, plank floor, side walls.
  g.fillStyle(def.color, 1).fillRect(0, 0, w, h);
  for (let px = 0; px < w; px += 12) g.fillStyle(0x000000, 0.07).fillRect(px, 0, 6, h);
  g.fillStyle(WOOD_DARK, 1).fillRect(0, 0, w, 4);
  g.fillStyle(def.accent, 1).fillRect(0, 4, w, 2);
  for (let px = 0; px < w; px += 10) {
    g.fillStyle((px / 10) % 2 ? 0x5c3c24 : 0x6b4426, 1).fillRect(px, floorTop, 10, 6);
  }
  g.fillStyle(0x2a1a10, 1).fillRect(0, 0, 2, h).fillRect(w - 2, 0, 2, h);

  const window = (wx: number) => {
    g.fillStyle(WOOD_DARK, 1).fillRect(wx - 2, 12, 24, 20);
    g.fillGradientStyle(0xf2a65a, 0xf2a65a, 0xfbe3b0, 0xfbe3b0, 1).fillRect(wx, 14, 20, 16);
    g.fillStyle(0xc8532b, 1).fillRect(wx + 12, 18, 6, 4);
    g.fillStyle(WOOD_DARK, 1).fillRect(wx + 9, 14, 2, 16).fillRect(wx, 21, 20, 2);
  };
  const bunting = (from: number, to: number) => {
    const colors = [0xc8532b, 0xe08a2e, 0xf2c14e];
    for (let i = 0, px = from; px < to - 6; px += 9, i++) {
      g.fillStyle(colors[i % 3], 1).fillTriangle(px, 6, px + 7, 6, px + 3.5, 12);
    }
  };

  switch (def.id) {
    case 'crypt': {
      // Stone-block wall texture, coffin bed, rug, nightstand with candle, wreath and window.
      g.fillStyle(0x000000, 0.12);
      for (let row = 0; row < 6; row++) {
        for (let px = (row % 2) * 8; px < w; px += 16) g.fillRect(px, 6 + row * 9, 1, 9);
        g.fillRect(0, 6 + row * 9, w, 1);
      }
      window(w - 34);
      g.fillStyle(0x8f3b1f, 1).fillRect(20, floorTop - 2, 52, 2);
      img('coffin', 34, floorTop - 2);
      img('wreath', 34, 10, 0.5, 0);
      g.fillStyle(WOOD, 1).fillRect(58, floorTop - 12, 14, 12);
      img('candle', 65, floorTop - 12);
      glow(scene, box, 65, floorTop - 21, 9, 0xffd75e);
      img('pumpkinSmall', w - 14, floorTop);
      img('tombstone', 82, floorTop);
      break;
    }
    case 'feast': {
      // Long harvest table loaded with food, chairs, hanging lanterns and bunting.
      bunting(6, w - 6);
      const tx = 20;
      const tw = w - 40;
      for (let px = tx + 6; px < tx + tw - 6; px += 18) img('chair', px, floorTop);
      g.fillStyle(WOOD_DARK, 1).fillRect(tx, floorTop - 14, tw, 3);
      g.fillStyle(0xf1ead8, 1).fillRect(tx, floorTop - 16, tw, 3); // tablecloth
      g.fillStyle(0xc8532b, 1).fillRect(tx + tw / 2 - 20, floorTop - 16, 40, 3); // runner
      g.fillStyle(WOOD, 1).fillRect(tx + 4, floorTop - 11, 3, 11).fillRect(tx + tw - 7, floorTop - 11, 3, 11);
      const foods = ['pie', 'turkeyLeg', 'pumpkinSmall', 'turkey', 'candle', 'pie', 'cornucopia', 'turkeyLeg'];
      const step = tw / (foods.length + 1);
      foods.forEach((k, i) => {
        const fx = tx + step * (i + 1);
        img(k, fx, floorTop - 16);
        if (k === 'candle') glow(scene, box, fx, floorTop - 25, 10, 0xffd75e);
      });
      for (const fx of [0.25, 0.75]) {
        const lx = Math.round(w * fx);
        g.lineStyle(1, 0x2a1a10, 1).lineBetween(lx, 6, lx, 14);
        glow(scene, box, lx, 21, 12, 0xffb347);
        img('jackolantern', lx, 14, 0.5, 0);
      }
      break;
    }
    case 'bakery': {
      // Brick oven with fire, display counter of pies, shelf of pies, striped awning.
      for (let px = 0; px < w; px += 12) {
        g.fillStyle(px % 24 ? 0xf1ead8 : def.accent === 0xfbe3b0 ? 0xc8532b : def.accent, 1).fillRect(px, 6, 12, 6);
      }
      img('oven', 22, floorTop);
      glow(scene, box, 22, floorTop - 7, 10, 0xff7b2e);
      g.fillStyle(WOOD, 1).fillRect(46, floorTop - 14, w - 56, 14);
      g.fillStyle(0xbfe3ff, 0.35).fillRect(48, floorTop - 12, w - 60, 8);
      g.fillStyle(WOOD_DARK, 1).fillRect(44, floorTop - 16, w - 52, 2);
      for (let px = 56; px < w - 12; px += 18) img('pie', px, floorTop - 16);
      g.fillStyle(WOOD_DARK, 1).fillRect(44, 22, w - 52, 2);
      for (let px = 54; px < w - 12; px += 18) img('pie', px, 22);
      break;
    }
    case 'market': {
      // Striped stall awning, crates of pumpkins and corn, cornucopia display, scarecrow.
      for (let px = 0; px < w; px += 10) {
        g.fillStyle((px / 10) % 2 ? 0xf1ead8 : 0x8a9a3b, 1).fillRect(px, 6, 10, 8);
        g.fillTriangle(px, 14, px + 10, 14, px + 5, 18);
      }
      const crates: [number, string][] = [[24, 'pumpkinSmall'], [56, 'corn'], [88, 'pumpkin'], [120, 'pumpkinSmall']];
      for (const [cx, item] of crates) {
        if (cx > w - 30) break;
        img('crate', cx, floorTop);
        if (item === 'corn') {
          img('corn', cx - 4, floorTop - 10);
          img('corn', cx + 4, floorTop - 10);
        } else {
          img(item, cx - 4, floorTop - 10);
          img(item, cx + 5, floorTop - 10);
        }
      }
      g.fillStyle(WOOD_DARK, 1).fillRect(w - 46, floorTop - 12, 30, 3);
      g.fillStyle(WOOD, 1).fillRect(w - 43, floorTop - 9, 2, 9).fillRect(w - 21, floorTop - 9, 2, 9);
      img('cornucopia', w - 31, floorTop - 12);
      img('hay', w - 31, 34);
      break;
    }
    case 'office': {
      // Desks with glowing monitors, filing shelf, window, desk pumpkins.
      window(w - 34);
      img('bookshelf', 14, floorTop);
      for (let dx = 34; dx < w - 40; dx += 40) {
        img('chair', dx - 6, floorTop);
        g.fillStyle(WOOD_DARK, 1).fillRect(dx, floorTop - 12, 26, 2);
        g.fillStyle(WOOD, 1).fillRect(dx + 1, floorTop - 10, 2, 10).fillRect(dx + 23, floorTop - 10, 2, 10);
        img('monitor', dx + 9, floorTop - 12);
        img('pumpkinSmall', dx + 21, floorTop - 12);
        glow(scene, box, dx + 9, floorTop - 19, 8, 0x9ad06a);
      }
      break;
    }
  }
  return box;
}

function drawStairs(g: Phaser.GameObjects.Graphics, def: RoomDef, w: number, h: number) {
  g.fillStyle(0x3b2a20, 1).fillRect(0, 0, w, h);
  g.fillStyle(0x000000, 0.25).fillRect(0, 0, w, 4);
  const steps = 8;
  const sw = w / steps;
  const sh = h / steps;
  for (let i = 0; i < steps; i++) {
    g.fillStyle(def.accent, 1).fillRect(i * sw, h - (i + 1) * sh, sw, 2);
    g.fillStyle(def.color, 1).fillRect(i * sw, h - (i + 1) * sh + 2, sw, (i + 1) * sh - 2);
  }
  g.lineStyle(1, 0xe8e0d0, 0.8).lineBetween(0, h - 10, w, -6);
}

function drawElevator(g: Phaser.GameObjects.Graphics, def: RoomDef, w: number, h: number) {
  g.fillStyle(def.color, 1).fillRect(0, 0, w, h);
  g.fillStyle(0x000000, 0.3).fillRect(4, 0, 2, h).fillRect(w - 6, 0, 2, h);
  // Bone door frame with closed doors and a little skull lamp.
  const dx = 12;
  const dw = w - 24;
  g.fillStyle(def.accent, 1).fillRect(dx - 3, 14, dw + 6, h - 20);
  g.fillStyle(0x5a5450, 1).fillRect(dx, 17, dw / 2 - 1, h - 23).fillRect(dx + dw / 2 + 1, 17, dw / 2 - 1, h - 23);
  g.fillStyle(def.accent, 1).fillRect(w / 2 - 3, 6, 6, 5);
  g.fillStyle(0x2a1a10, 1).fillRect(w / 2 - 2, 8, 1, 1).fillRect(w / 2 + 1, 8, 1, 1);
}

/** Flickering additive glow added into a room's container. */
function glow(scene: Phaser.Scene, box: Phaser.GameObjects.Container, x: number, y: number, r: number, color: number) {
  const c = scene.add.circle(x, y, r, color, 0.25).setBlendMode(Phaser.BlendModes.ADD);
  box.add(c);
  const tween = scene.tweens.add({
    targets: c, alpha: { from: 0.15, to: 0.35 }, duration: 300 + Math.random() * 300,
    yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
  });
  c.once(Phaser.GameObjects.Events.DESTROY, () => tween.remove());
}
